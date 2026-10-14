/* ================= Zip files (modules are .zip files) =================
   No libraries: the browser's own (De)CompressionStream does the deflate work.
   readZip(blob)  -> [{ name, size, read(): Promise<Uint8Array> }]
   writeZip(list) -> Blob        list: [{ name, data: Uint8Array | Blob | string, compress? }] */
const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(bytes) { let c = 0xFFFFFFFF; for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }

async function streamBytes(bytes, stream) {
  const out = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}
const inflateRaw = bytes => streamBytes(bytes, new DecompressionStream('deflate-raw'));
const deflateRaw = bytes => streamBytes(bytes, new CompressionStream('deflate-raw'));
const toBytes = async d => ArrayBuffer.isView(d) ? new Uint8Array(d.buffer, d.byteOffset, d.byteLength) : typeof d === 'string' ? new TextEncoder().encode(d) : new Uint8Array(await d.arrayBuffer());

class ZipError extends Error { constructor(code) { super(code); this.code = code; } }

async function readZip(blob) {
  const size = blob.size;
  if (size < 22) throw new ZipError('notzip');
  const tailLen = Math.min(size, 65557), tail = new DataView(await blob.slice(size - tailLen).arrayBuffer());
  let eocd = -1;
  for (let i = tailLen - 22; i >= 0; i--) if (tail.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new ZipError('notzip');
  const count = tail.getUint16(eocd + 10, true), cdSize = tail.getUint32(eocd + 12, true), cdOff = tail.getUint32(eocd + 16, true);
  if (cdOff === 0xFFFFFFFF || count === 0xFFFF) throw new ZipError('zip64');
  const cd = new DataView(await blob.slice(cdOff, cdOff + cdSize).arrayBuffer()), dec = new TextDecoder('utf-8');
  const entries = []; let p = 0;
  for (let n = 0; n < count; n++) {
    if (cd.getUint32(p, true) !== 0x02014b50) throw new ZipError('broken');
    const flags = cd.getUint16(p + 8, true), method = cd.getUint16(p + 10, true), csize = cd.getUint32(p + 20, true), usize = cd.getUint32(p + 24, true);
    const nl = cd.getUint16(p + 28, true), xl = cd.getUint16(p + 30, true), cl = cd.getUint16(p + 32, true), off = cd.getUint32(p + 42, true);
    const name = dec.decode(new Uint8Array(cd.buffer, cd.byteOffset + p + 46, nl)).replace(/\\/g, '/');
    p += 46 + nl + xl + cl;
    if (name.endsWith('/') || /(^|\/)(__MACOSX|\.DS_Store|Thumbs\.db)(\/|$)/.test(name)) continue;
    if (flags & 1) throw new ZipError('encrypted');
    entries.push({
      name, size: usize, method,
      async read() {
        const lh = new DataView(await blob.slice(off, off + 30).arrayBuffer());
        if (lh.getUint32(0, true) !== 0x04034b50) throw new ZipError('broken');
        const start = off + 30 + lh.getUint16(26, true) + lh.getUint16(28, true);
        const raw = new Uint8Array(await blob.slice(start, start + csize).arrayBuffer());
        if (method === 0) return raw;
        if (method === 8) return inflateRaw(raw);
        throw new ZipError('method');
      }
    });
  }
  return entries;
}

async function writeZip(list) {
  const parts = [], central = [], enc = new TextEncoder();
  const now = new Date(), dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1), dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  let offset = 0;
  for (const f of list) {
    const raw = await toBytes(f.data), name = enc.encode(f.name), crc = crc32(raw);
    let data = raw, method = 0;
    if (f.compress && raw.length > 64) { const z = await deflateRaw(raw); if (z.length < raw.length) { data = z; method = 8; } }
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, method, true);
    h.setUint16(10, dosTime, true); h.setUint16(12, dosDate, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, raw.length, true);
    h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
    parts.push(h.buffer, name, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, method, true);
    c.setUint16(12, dosTime, true); c.setUint16(14, dosDate, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, raw.length, true);
    c.setUint16(28, name.length, true); c.setUint32(42, offset, true);
    central.push(c.buffer, name);
    offset += 30 + name.length + data.length;
  }
  const cdSize = central.reduce((a, b) => a + (b.byteLength ?? b.length), 0), e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, list.length, true); e.setUint16(10, list.length, true); e.setUint32(12, cdSize, true); e.setUint32(16, offset, true);
  return new Blob([...parts, ...central, e.buffer], { type: 'application/zip' });
}
