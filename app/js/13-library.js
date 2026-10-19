/* ================= The module library: add, open, share, reset, remove ================= */
const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', jfif: 'image/jpeg', pjpeg: 'image/jpeg', pjp: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml', avif: 'image/avif',
  jxl: 'image/jxl', apng: 'image/apng', bmp: 'image/bmp', ico: 'image/x-icon',
  mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg', wav: 'audio/wav', flac: 'audio/flac', weba: 'audio/webm',
  mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', ogv: 'video/ogg', '3gp': 'video/3gpp', mov: 'video/quicktime', pdf: 'application/pdf', json: 'application/json' };
const mimeOf = p => MIME[(p.split('.').pop() || '').toLowerCase()] || 'application/octet-stream';
const modCache = new Map();

const emptyProgress = id => ({ format: 1, module: id, xp: 0, lessons: {}, tasks: {}, exams: [], started: new Date().toISOString() });
const hasProgress = p => !!p && (p.xp > 0 || Object.keys(p.lessons || {}).length > 0 || Object.keys(p.tasks || {}).length > 0 || (p.exams || []).length > 0);
function cleanProgress(p, id) {
  if (!isObj(p)) return null;
  return { format: 1, module: id, xp: +p.xp || 0, lessons: isObj(p.lessons) ? p.lessons : {}, tasks: isObj(p.tasks) ? p.tasks : {}, exams: Array.isArray(p.exams) ? p.exams.slice(-50) : [], started: p.started || new Date().toISOString() };
}

/* Read a .zip someone picked, before anything is installed */
async function inspectModuleFile(file) {
  let entries;
  try { entries = await readZip(file); } catch (e) { return { fatal: e.code === 'zip64' ? 'zipBig' : e.code === 'encrypted' ? 'zipLocked' : 'notZip' }; }
  let mj = entries.find(e => e.name === 'module.json'), prefix = '';
  if (!mj) { const c = entries.filter(e => /^[^/]+\/module\.json$/.test(e.name)); if (c.length === 1) { mj = c[0]; prefix = mj.name.slice(0, -11); } }
  if (!mj) return { fatal: 'noModule' };
  let json;
  try { json = JSON.parse(new TextDecoder().decode(await mj.read()).replace(/^\ufeff/, '')); } catch (e) { return { fatal: 'badJson', detail: e.message }; }
  const files = new Map(entries.filter(e => e.name.startsWith(prefix)).map(e => [e.name.slice(prefix.length), e]));
  const { errors, warnings } = checkModule(json, new Set(files.keys()));
  let progress = null;
  const pj = files.get('progress.json');
  if (pj && !errors.length) { try { const p = JSON.parse(new TextDecoder().decode(await pj.read())); if (p && p.module === json.id) progress = cleanProgress(p, json.id); } catch (e) { } }
  const existing = !errors.length ? await idb.get('modules', json.id) : null;
  const mine = existing ? await idb.get('progress', json.id) : null;
  return { json, files, errors, warnings, progress: hasProgress(progress) ? progress : null, existing, mine: hasProgress(mine) ? mine : null };
}

/* progressChoice: 'theirs' (keep the progress inside the file) | 'mine' (keep what is on this phone) | 'fresh' (start from zero) */
async function installModule(info, progressChoice, onStep) {
  const id = info.json.id, used = [...moduleMediaPaths(info.json)], now = Date.now();
  await idb.delPrefix('media', id + '\n');
  let bytes = 0, done = 0;
  for (const path of used) {
    const data = await info.files.get(path).read(); bytes += data.length;
    await idb.put('media', new Blob([data], { type: mimeOf(path) }), id + '\n' + path);
    onStep && onStep(++done / used.length);
  }
  await idb.put('modules', { id, json: info.json, installedAt: info.existing ? info.existing.installedAt : now, updatedAt: now, usedAt: now, bytes });
  if (progressChoice === 'theirs' && info.progress) await idb.put('progress', info.progress);
  else if (progressChoice === 'fresh' || !(await idb.get('progress', id))) await idb.put('progress', emptyProgress(id));
  forgetModule(id);
  if (!APP.order.includes(id)) { APP.order.unshift(id); saveApp(); }
  return id;
}

async function listModules() {
  const recs = await idb.all('modules'), progs = await idb.all('progress'), pm = new Map(progs.map(p => [p.module, p]));
  return recs.map(r => ({ rec: r, prog: pm.get(r.id) || emptyProgress(r.id) })).sort((a, b) => (b.rec.usedAt || 0) - (a.rec.usedAt || 0));
}
async function loadModule(id) {
  if (modCache.has(id)) return modCache.get(id);
  const rec = await idb.get('modules', id); if (!rec) return null;
  const m = prepareModule(rec.json); modCache.set(id, m);
  rec.usedAt = Date.now(); idb.put('modules', rec);
  return m;
}
const loadProgress = async id => (await idb.get('progress', id)) || emptyProgress(id);
const saveProgress = p => idb.put('progress', p);

async function exportModule(id, withProgress) {
  const rec = await idb.get('modules', id), list = [{ name: 'module.json', data: JSON.stringify(rec.json, null, 2), compress: true }];
  for (const key of await idb.keysPrefix('media', id + '\n')) list.push({ name: key.slice(id.length + 1), data: await idb.get('media', key) });
  if (withProgress) {
    const p = await loadProgress(id);
    list.push({ name: 'progress.json', data: JSON.stringify({ ...p, moduleVersion: rec.json.version, updated: new Date().toISOString() }, null, 1), compress: true });
  }
  return { blob: await writeZip(list), name: slug(rec.json.title) + (withProgress ? '-' + slug(t('file.withProgress')) : '') + '.zip' };
}
async function resetModule(id) { await idb.put('progress', emptyProgress(id)); await idb.del('kv', 'exam:' + id); }
async function removeModule(id) {
  await idb.delPrefix('media', id + '\n'); await idb.del('modules', id); await idb.del('progress', id); await idb.del('kv', 'exam:' + id);
  forgetModule(id); APP.order = APP.order.filter(x => x !== id); saveApp();
}

/* Media: Blob URLs, made on demand and reused */
const mediaURLs = new Map();
function forgetModule(id) { modCache.delete(id); for (const [k, u] of mediaURLs) if (k.startsWith(id + '\n')) { URL.revokeObjectURL(u); mediaURLs.delete(k); } }
async function mediaURL(id, path) {
  const k = id + '\n' + path;
  if (!mediaURLs.has(k)) { const b = await idb.get('media', k); if (!b) return ''; mediaURLs.set(k, URL.createObjectURL(b)); }
  return mediaURLs.get(k);
}
/* Elements rendered with data-media="path" get their real source here.
   A picture this phone cannot decode (for example .jxl on an older WebView) switches to its data-fallback file, or is marked missing. */
function hydrateMedia(root, id) {
  root.querySelectorAll('[data-media]').forEach(async el => {
    const fb = el.dataset.fallback;
    const url = await mediaURL(id, el.dataset.media); el.removeAttribute('data-media');
    if (!url) { el.classList.add('missing'); return; }
    if (el.dataset.poster != null) { el.poster = await mediaURL(id, el.dataset.poster); }
    if (el.tagName === 'IMG') {
      el.addEventListener('error', async () => {
        const alt = fb ? await mediaURL(id, fb) : '';
        if (alt && el.src !== alt) el.src = alt; else el.classList.add('missing');
      });
    }
    el.src = url;
  });
}
