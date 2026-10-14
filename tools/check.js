/* Shelly checks (run with: python tools/build.py check)
   1. engine tests: zip, answer checking, scoring scales
   2. every module in modules/ against the module format
   3. interface text: every key exists in both languages */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const ctx = vm.createContext({ console, Blob, Response, TextEncoder, TextDecoder, DecompressionStream, CompressionStream, Intl, Set, Map });
const engine = ['00-util', '01-zip', '02-module-format', '03-scoring', '10-i18n', '12-rich'].map(f => fs.readFileSync(path.join(ROOT, 'app/js', f + '.js'), 'utf8')).join('\n;\n');
/* 12-rich needs KaTeX only for $math$; a stand-in is enough to test tables and code blocks */
vm.runInContext('globalThis.katex = { renderToString: (x, o) => "<katex" + (o.displayMode ? " display" : "") + ">" + x + "</katex>" };\n' + engine + '\n;globalThis.E = { checkModule, prepareModule, scoreTask, applyScale, parseNumber, textMatches, readZip, writeZip, STR, moduleMediaPaths, rich, fmtSig };', ctx);
const E = ctx.E;
let fails = 0;
const ok = (cond, name) => { if (!cond) { fails++; console.log('  FAIL  ' + name); } };
const eq = (a, b, name) => ok(JSON.stringify(a) === JSON.stringify(b), `${name}: got ${JSON.stringify(a)}, expected ${JSON.stringify(b)}`);

(async () => {
  /* ---------- 1. engine ---------- */
  const matura = { map: [[0, 2], [30, 2], [30, 3], [100, 6]], outOf: 100, round: 2, pass: 3, bands: [[2, 'Слаб'], [3, 'Среден'], [3.5, 'Добър'], [4.5, 'Много добър'], [5.5, 'Отличен']] };
  eq(E.applyScale(matura, 29.99, 100, 'bg').text, 'Слаб 2,00', 'matura below 30');
  eq(E.applyScale(matura, 30, 100, 'bg').text, 'Среден 3,00', 'matura at 30');
  eq(E.applyScale(matura, 100, 100, 'bg').text, 'Отличен 6,00', 'matura at 100');
  eq(E.applyScale(matura, 13, 20, 'bg').value, 4.5, 'matura rescaled 13/20 -> 65/100');
  const band = { mode: 'steps', map: [[0, 0], [10, 4], [23, 6], [30, 7], [39, 9]], round: 1 };
  eq(E.applyScale(band, 29, 40, 'en').value, 6, 'band steps');
  eq(E.applyScale(null, 3, 4, 'en').text, '75 %', 'no scale = percent');
  eq(['3,5', '7/2', '−1,25', '1 000', 'x'].map(E.parseNumber).map(v => Number.isNaN(v) ? 'NaN' : v), [3.5, 3.5, -1.25, 1000, 'NaN'], 'numbers');
  ok(E.textMatches('Kaмък.', 'камък', 'bg'), 'Latin look-alike letters accepted in a Cyrillic answer');
  ok(!E.textMatches('камък', 'Камък', 'bg', true), 'strict text keeps capitals');
  const T = (o) => ({ points: 1, media: [], ...o });
  eq(E.scoreTask(T({ type: 'choice', options: ['a', 'b'], answer: 1 }), 1, 'en').status, 'right', 'choice right');
  eq(E.scoreTask(T({ type: 'multi', points: 2, options: ['a', 'b', 'c'], answer: [0, 2], partial: true }), [0, 1], 'en').points, 0, 'multi partial: one right, one wrong');
  eq(E.scoreTask(T({ type: 'multi', points: 2, options: ['a', 'b', 'c'], answer: [0, 2], partial: true }), [0], 'en').points, 1, 'multi partial: half');
  eq(E.scoreTask(T({ type: 'gaps', points: 2, text: '[[1]] [[2]]', gaps: [{ answer: 'ът' }, { options: ['a', 'b'], answer: 1 }] }), ['ЪТ', 1], 'bg').status, 'right', 'gaps');
  eq(E.scoreTask(T({ type: 'order', items: ['a', 'b', 'c'], partial: true }), { order: [0, 2, 1], moved: true }, 'en').points, 0.3333, 'order partial');
  eq(E.scoreTask(T({ type: 'order', items: ['a', 'b'] }), { order: [0, 1], moved: false }, 'en').status, 'empty', 'order untouched counts as empty');
  eq(E.scoreTask(T({ type: 'match', points: 3, left: ['a', 'b', 'c'], right: ['1', '2', '3'] }), [0, 2, 1], 'en').points, 1, 'match partial');
  eq(E.scoreTask(T({ type: 'open', points: 5, rubric: [{ text: 'x', points: 3 }, { text: 'y', points: 2 }] }), { text: 'hi', marks: [2, 1.5] }, 'en').points, 3.5, 'open graded');
  eq(E.scoreTask(T({ type: 'open', points: 5 }), { text: 'hi', marks: null }, 'en').status, 'ungraded', 'open not graded yet');
  const zip = await E.writeZip([{ name: 'module.json', data: '{"a":"кирилица"}', compress: true }, { name: 'media/a.bin', data: new Uint8Array([7, 8, 9]) }]);
  const entries = await E.readZip(zip);
  eq(entries.map(e => e.name), ['module.json', 'media/a.bin'], 'zip names');
  eq(new TextDecoder().decode(await entries[0].read()), '{"a":"кирилица"}', 'zip text round-trip');
  /* rich text: tables and code blocks */
  const tbl = E.rich('Pins:\n| Pin | Use |\n|---|:---:|\n| `D2` | INT0 a\\|b in code: `x|y` |\n| A0 | **sense** |');
  ok(tbl.startsWith('<p>Pins:</p><div class="tablewrap"><table>'), 'table after a text line');
  ok(tbl.includes('<th style="text-align:center">Use</th>') && tbl.includes('<strong>sense</strong>') && tbl.includes('<code>x|y</code>') && tbl.includes('INT0 a|b'), 'table cells: alignment, formatting, | inside code, escaped \\|');
  const cb = E.rich('Before\n\n```cpp\nint a = 2 * 3; // $5 **not bold**\n\nfloat b = a / 2;\n```\n\nAfter $x$');
  ok(cb.includes('<pre class="codeblock" data-lang="cpp"><code>int a = 2 * 3; // $5 **not bold**\n\nfloat b = a / 2;</code></pre>'), 'code block kept literally, blank lines inside');
  ok(cb.endsWith('<p>After <katex>x</katex></p>') && !cb.includes('<p><pre'), 'code block is not wrapped in a paragraph; math after it still works');
  ok(E.rich('| not | a table |').startsWith('<p>'), 'a lone | line stays a paragraph');
  eq([E.fmtSig(0.155, 'en'), E.fmtSig(2.38095, 'en'), E.fmtSig(18000, 'en'), E.fmtSig(4.5, 'bg')], ['0.155', '2.381', '18,000', '4,5'], 'significant digits');
  /* format: code blocks and number units */
  const mini = extra => ({ format: 1, id: 'test.mod', version: '1', lang: 'en', title: 'T', units: [{ id: 'u', title: 'U', lessons: [{ id: 'l', title: 'L', ...extra }] }] });
  eq(E.checkModule(mini({ content: [{ type: 'code', code: 'void setup() {}', lang: 'cpp', file: 'blink.ino' }] })).errors, [], 'code block accepted');
  eq(E.checkModule(mini({ content: [{ type: 'code', code: '' }] })).errors.length, 1, 'empty code block rejected');
  eq(E.checkModule(mini({ content: [{ type: 'code', code: 'x', file: '../evil.sh' }] })).errors.length, 1, 'code file name with a path rejected');
  eq(E.checkModule(mini({ practice: { tasks: [{ id: 'n', type: 'number', answer: 2.5, tolerance: 0.1, unit: 'mA' }] } })).errors, [], 'number with unit accepted');
  console.log(fails ? `engine: ${fails} failed` : 'engine tests ok');

  /* ---------- 2. modules ---------- */
  const modDir = path.join(ROOT, 'modules'); let modErrors = 0;
  for (const d of fs.readdirSync(modDir).sort()) {
    const mj = path.join(modDir, d, 'module.json'); if (!fs.existsSync(mj)) continue;
    const files = new Set(), walk = (dir, pre) => fs.readdirSync(dir, { withFileTypes: true }).forEach(e => e.isDirectory() ? walk(path.join(dir, e.name), pre + e.name + '/') : files.add(pre + e.name));
    walk(path.join(modDir, d), '');
    let json; try { json = JSON.parse(fs.readFileSync(mj, 'utf8')); } catch (e) { console.log(`  ${d}: module.json is not valid JSON: ${e.message}`); modErrors++; continue; }
    const { errors, warnings } = E.checkModule(json, files);
    errors.forEach(e => console.log(`  ${d}: ERROR ${e.at}: ${e.msg}`)); warnings.forEach(w => console.log(`  ${d}: note  ${w.at}: ${w.msg}`));
    const unused = [...files].filter(f => f.startsWith('media/') && !E.moduleMediaPaths(json).has(f));
    unused.forEach(f => console.log(`  ${d}: note  ${f} is not used`));
    modErrors += errors.length;
    if (!errors.length) { const m = E.prepareModule(json); console.log(`module ${d}: ok (${m.lessonList.length} lessons, ${m.exams.length} exams, ${Object.keys(m.taskById).length} tasks${m.exams.map(x => `, "${x.title}" = ${x.max} pts`).join('')})`); }
  }
  fails += modErrors;

  /* ---------- 3. interface text ---------- */
  const code = fs.readdirSync(path.join(ROOT, 'app/js')).map(f => fs.readFileSync(path.join(ROOT, 'app/js', f), 'utf8')).join('\n');
  const used = new Set([...code.matchAll(/\btn?\('([a-zA-Z0-9.]+[a-zA-Z0-9])'/g)].map(m => m[1]).filter(k => k.includes('.')));
  ['hi.night', 'hi.morning', 'hi.day', 'hi.evening', 'pr.right1', 'pr.right2', 'pr.right3', 'pr.right4', 'imp.notZip', 'imp.zipBig', 'imp.zipLocked', 'imp.noModule', 'imp.badJson'].forEach(k => used.add(k));
  for (const lang of ['bg', 'en']) for (const k of used) if (!(k in E.STR[lang])) { fails++; console.log(`  FAIL  text "${k}" missing in ${lang}`); }
  const bg = Object.keys(E.STR.bg), en = Object.keys(E.STR.en);
  bg.filter(k => !en.includes(k)).forEach(k => { fails++; console.log(`  FAIL  "${k}" only in bg`); });
  en.filter(k => !bg.includes(k)).forEach(k => { fails++; console.log(`  FAIL  "${k}" only in en`); });
  console.log(`interface text: ${used.size} keys used, ${bg.length} defined`);
  if (fails) { console.log(`\n${fails} problem(s)`); process.exit(1); }
  console.log('all checks passed');
})();
