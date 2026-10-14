/* ================= Exam simulation =================
   intro -> run (timed, no feedback, navigator, flags) -> grade (rubrics for written tasks) -> result -> review
   The run is saved as it goes (kv "exam:<module id>"), so closing the app does not lose a four-hour exam.
   Time keeps running while the app is closed, like in the real exam room. */
function examItems(x) {
  const out = []; x.parts.forEach((p, pi) => p.tasks.forEach(task => out.push({ task, part: pi, n: out.length + 1 })));
  return out;
}
const examTimedParts = x => x.parts.some(p => p.minutes);

SCREENS.exam = async (el, params, nav) => {
  const m = await loadModule(params.id); if (!m) return home();
  moduleLook(el, m); el.setAttribute('lang', m.lang);
  if (params.record != null) {
    const p = await loadProgress(m.id), rec = p.exams[params.record];
    const x = rec && m.exams.find(e => e.id === rec.exam); if (!x) return back();
    return examResult(el, m, x, rec, false);
  }
  let st = params.resume ? await idb.get('kv', 'exam:' + m.id) : null;
  const x = m.exams.find(e => e.id === (st ? st.exam : params.exam)); if (!x) return back();
  if (!st) return examIntro(el, m, x, nav);
  examRun(el, m, x, st, nav);
};

function examIntro(el, m, x, nav) {
  const timed = examTimedParts(x);
  el.innerHTML = `${topbar(esc(x.title))}<div class="pad exam-intro">
    <div class="intro-hero"><span class="ex-ic big">${icon('layers')}</span><h1>${esc(x.title)}</h1>
      <p class="muted" lang="${UI_LANG}">${[x.minutes ? t('ex.minutes', { n: x.minutes }) : null, tn('n.tasks', x.count), t('ex.points', { n: fmtPts(x.max, UI_LANG) })].filter(Boolean).map(esc).join(' · ')}</p></div>
    ${x.description ? `<div class="rt card">${rich(x.description)}</div>` : ''}
    <table class="parts"><tbody>${x.parts.map(p => `<tr><td><b>${esc(p.title || '')}</b></td><td lang="${UI_LANG}">${esc(tn('n.tasks', p.tasks.length))}</td><td lang="${UI_LANG}">${esc(t('ex.points', { n: fmtPts(sum(p.tasks.map(q => q.points)), UI_LANG) }))}</td><td lang="${UI_LANG}">${p.minutes ? esc(t('ex.minutes', { n: p.minutes })) : ''}</td></tr>`).join('')}</tbody></table>
    <ul class="rules" lang="${UI_LANG}">
      <li>${icon('clock')}${esc(x.minutes ? t('ex.rule.time', { n: x.minutes }) : t('ex.rule.notime'))}</li>
      ${timed ? `<li>${icon('layers')}${esc(t('ex.rule.parts'))}</li>` : ''}
      <li>${icon('eye')}${esc(t('ex.rule.nofeedback'))}</li>
      ${x.parts.some(p => p.tasks.some(q => q.type === 'open')) ? `<li>${icon('pen')}${esc(t('ex.rule.selfgrade'))}</li>` : ''}
      <li>${icon('download')}${esc(t('ex.rule.saved'))}</li></ul>
    <button class="btn accent big block" data-go lang="${UI_LANG}">${esc(t('ex.begin'))}</button></div>`;
  el.querySelector('[data-go]').onclick = async () => {
    const st = { exam: x.id, seed: uid(), started: Date.now(), partStarts: [Date.now()], part: 0, i: 0, answers: {}, flags: [], phase: 'run', marks: {} };
    await idb.put('kv', st, 'exam:' + m.id);
    go('exam', { id: m.id, resume: true }, { replace: true });
  };
}

function examRun(el, m, x, st, nav) {
  const items = examItems(x), timed = examTimedParts(x), save = () => (st.done ? null : idb.put('kv', st, 'exam:' + m.id));
  let saveT = 0; const saveSoon = () => { clearTimeout(saveT); saveT = setTimeout(save, 400); };
  let view = null, tick = 0;
  const partDeadline = pi => (x.parts[pi].minutes && st.partStarts[pi] ? st.partStarts[pi] + x.parts[pi].minutes * 60000 : Infinity);
  const totalDeadline = () => (x.minutes ? st.started + x.minutes * 60000 : Infinity);
  const firstOf = pi => items.findIndex(it => it.part === pi), lastOf = pi => items.map(it => it.part).lastIndexOf(pi);
  const reachable = i => !timed || items[i].part === st.part;

  nav.onLeave = () => { clearInterval(tick); clearTimeout(saveT); save(); stopMedia(); };
  nav.guard = async () => st.phase !== 'run' || (await sheet({ title: t('ex.leaveTitle'), body: `<p>${esc(t('ex.leave'))}</p>`, actions: [{ id: 'stay', label: t('ex.stay'), kind: 'primary' }, { id: 'go', label: t('ex.leaveOk') }] })) === 'go';

  /* Catch up with time that passed while the app was closed */
  function catchUp() {
    const now = Date.now();
    if (now >= totalDeadline()) return finishRun(true);
    while (timed && now >= partDeadline(st.part)) {
      if (st.part >= x.parts.length - 1) return finishRun(true);
      const end = partDeadline(st.part); st.part++; st.partStarts[st.part] = end; st.i = firstOf(st.part);
    }
    return false;
  }
  if (st.phase === 'grade') return examGrade(el, m, x, st, nav);
  if (catchUp()) return;

  el.innerHTML = `<header class="exambar"><button class="iconbtn" data-back aria-label="${esc(t('nav.close'))}">${icon('close')}</button>
      <div class="eb-mid" lang="${UI_LANG}"><b></b><small></small></div><span class="timer" lang="${UI_LANG}"></span>
      <button class="iconbtn" data-flag aria-label="${esc(t('ex.flag'))}">${icon('flag')}</button><button class="iconbtn" data-nav aria-label="${esc(t('ex.navigator'))}">${icon('grid')}</button></header>
    <main class="exammain pad"></main>
    <footer class="exambottom" lang="${UI_LANG}"><button class="btn ghost" data-prev>${icon('back')}${esc(t('ex.prev'))}</button><button class="btn accent" data-next></button></footer>`;
  const main = el.querySelector('.exammain');

  function show(i) {
    stopMedia();
    st.i = i; saveSoon();
    const it = items[i], p = x.parts[it.part];
    view = taskView(it.task, m, { mode: 'exam', response: st.answers[i], seed: st.seed, onChange: () => { st.answers[i] = view.get(); saveSoon(); } });
    main.innerHTML = (i === firstOf(it.part) && (p.instructions || x.parts.length > 1) ? `<div class="part-intro"><b>${esc(p.title || '')}</b>${p.instructions ? `<div class="rt">${rich(p.instructions)}</div>` : ''}</div>` : '')
      + `<div class="tasknum" lang="${UI_LANG}">${esc(t('task.n', { n: it.n }))}<span>${esc(tn('n.points', it.task.points, { n: fmtPts(it.task.points, UI_LANG) }))}</span></div>`;
    main.appendChild(view.el); window.scrollTo(0, 0);
    el.querySelector('.eb-mid b').textContent = p.title || x.title;
    el.querySelector('.eb-mid small').textContent = t('ex.taskOf', { n: it.n, of: items.length });
    el.querySelector('[data-flag]').classList.toggle('on', st.flags.includes(i));
    el.querySelector('[data-prev]').disabled = i === 0 || !reachable(i - 1);
    const nb = el.querySelector('[data-next]'), lastHere = timed ? i === lastOf(st.part) : i === items.length - 1;
    nb.innerHTML = lastHere ? (timed && st.part < x.parts.length - 1 ? esc(t('ex.endPart')) : esc(t('ex.submit'))) : esc(t('ex.next')) + icon('next');
    nb.dataset.end = lastHere ? '1' : '';
  }
  function clock() {
    if (catchUpLive()) return;
    const left = Math.min(partDeadline(st.part), totalDeadline()) - Date.now(), tm = el.querySelector('.timer');
    if (!tm) return;
    if (left === Infinity) { tm.innerHTML = icon('clock') + fmtClock((Date.now() - st.started) / 1000); return; }
    tm.innerHTML = icon('clock') + fmtClock(left / 1000); tm.classList.toggle('low', left < 5 * 60000);
  }
  function catchUpLive() {
    const now = Date.now();
    if (now >= totalDeadline()) { toast(t('ex.timeUp')); finishRun(true); return true; }
    if (timed && now >= partDeadline(st.part)) {
      if (st.part >= x.parts.length - 1) { toast(t('ex.timeUp')); finishRun(true); return true; }
      toast(t('ex.partTimeUp')); st.part++; st.partStarts[st.part] = now; save(); show(firstOf(st.part));
    }
    return false;
  }
  async function endPart() {
    const unanswered = items.filter((it, i) => it.part === st.part && !isAnswered(it.task, st.answers[i])).length;
    if (!(await confirmBox(t('ex.endPartTitle'), (unanswered ? tn('ex.unanswered', unanswered) + ' ' : '') + t('ex.endPartText'), t('ex.endPart')))) return;
    st.part++; st.partStarts[st.part] = Date.now(); save(); show(firstOf(st.part));
  }
  async function submit() {
    const unanswered = items.filter((it, i) => reachable(i) && !isAnswered(it.task, st.answers[i])).length, flagged = st.flags.filter(reachable).length;
    const text = [unanswered ? tn('ex.unanswered', unanswered) : '', flagged ? tn('ex.flagged', flagged) : '', t('ex.submitText')].filter(Boolean).join(' ');
    if (await confirmBox(t('ex.submitTitle'), text, t('ex.submit'))) finishRun(false);
  }
  function finishRun() { clearInterval(tick); st.phase = 'grade'; st.ended = Math.min(Date.now(), totalDeadline()); save(); examGrade(el, m, x, st, nav); return true; }

  function navigator() {
    const body = x.parts.map((p, pi) => `<div class="navpart"><b>${esc(p.title || '')}</b><div class="navgrid">${items.map((it, i) => it.part !== pi ? '' :
      `<button data-act="${i}" class="${[isAnswered(it.task, st.answers[i]) ? 'done' : '', st.flags.includes(i) ? 'flag' : '', i === st.i ? 'cur' : '', reachable(i) ? '' : 'locked'].join(' ')}"${reachable(i) ? '' : ' disabled'}>${it.n}</button>`).join('')}</div></div>`).join('');
    sheet({ title: t('ex.navigator'), body: `<p class="navlegend" lang="${UI_LANG}"><i class="done"></i>${esc(t('ex.answered'))}<i class="flag"></i>${esc(t('ex.flagged0'))}</p>${body}`, actions: [{ id: 'submit', label: t('ex.submitNow'), kind: 'primary' }] })
      .then(v => { if (v === 'submit') submit(); else if (v != null) show(+v); });
  }

  el.querySelector('.exambar').addEventListener('click', e => {
    if (e.target.closest('[data-flag]')) { const k = st.flags.indexOf(st.i); k >= 0 ? st.flags.splice(k, 1) : st.flags.push(st.i); e.target.closest('[data-flag]').classList.toggle('on', k < 0); saveSoon(); }
    if (e.target.closest('[data-nav]')) navigator();
  });
  el.querySelector('[data-prev]').onclick = () => { if (st.i > 0 && reachable(st.i - 1)) show(st.i - 1); };
  el.querySelector('[data-next]').onclick = e => {
    if (!e.currentTarget.dataset.end) return show(st.i + 1);
    timed && st.part < x.parts.length - 1 ? endPart() : submit();
  };
  show(reachable(st.i) ? st.i : firstOf(st.part));
  clock(); tick = setInterval(clock, 1000);
}

/* After the run: the learner grades their written answers with each task's rubric */
function examGrade(el, m, x, st, nav) {
  const items = examItems(x), save = () => (st.done ? null : idb.put('kv', st, 'exam:' + m.id));
  nav.guard = null;
  const open = items.map((it, i) => [it, i]).filter(([it, i]) => it.task.type === 'open' && isAnswered(it.task, st.answers[i]));
  if (!open.length) return examFinish(el, m, x, st, nav);
  el.innerHTML = `${topbar(esc(t('ex.gradeTitle')), { noBack: true })}<div class="pad grade" lang="${UI_LANG}">
    <p class="lead">${esc(t('ex.gradeIntro'))}</p><div class="gradelist"></div>
    <button class="btn accent big block" data-done>${esc(t('ex.seeResult'))}</button></div>`;
  const list = el.querySelector('.gradelist');
  for (const [it, i] of open) {
    const task = it.task, card = h(`<section class="card gradecard"><div class="tasknum">${esc(t('task.n', { n: it.n }))}<span>${esc(tn('n.points', task.points, { n: fmtPts(task.points, UI_LANG) }))}</span></div>
      <details class="gprompt" lang="${esc(m.lang)}"><summary>${esc(plain(task.prompt, 120))}</summary><div class="rt">${rich(task.prompt || '')}</div></details>
      <div class="yours"><b>${esc(t('ex.yourAnswer'))}</b><div class="answertext" lang="${esc(m.lang)}">${esc(st.answers[i].text)}</div><small>${esc(tn('n.words', wordCount(st.answers[i].text)))}</small></div>
      ${task.answer ? `<details class="model"><summary>${esc(t('task.model'))}</summary><div class="rt" lang="${esc(m.lang)}">${rich(task.answer)}</div></details>` : ''}</section>`);
    const r = rubricView(task, st.marks[i], v => { st.marks[i] = v; save(); });
    if (!st.marks[i]) st.marks[i] = r.get();
    card.appendChild(r.el); list.appendChild(card);
  }
  save();
  el.querySelector('[data-done]').onclick = () => examFinish(el, m, x, st, nav);
}

async function examFinish(el, m, x, st, nav) {
  const items = examItems(x), answers = items.map((it, i) => (it.task.type === 'open' && st.answers[i] ? { text: st.answers[i].text, marks: st.marks[i] || null } : st.answers[i] ?? null));
  const results = items.map((it, i) => scoreTask(it.task, answers[i], m.lang));
  const points = roundTo(sum(results.map(r => r.points)), 2), max = x.max;
  const prog = await loadProgress(m.id), scale = m.scales[x.scale], res = applyScale(scale, points, max, m.lang);
  const rec = { exam: x.id, at: new Date().toISOString(), points, max, value: res.value, secs: Math.round(((st.ended || Date.now()) - st.started) / 1000), seed: st.seed, answers };
  results.forEach((r, i) => recordTask(prog, items[i].task, r));
  prog.exams.push(rec); if (prog.exams.length > 50) prog.exams.shift();
  addXP(prog, XP.exam + Math.round(res.pct * 60));
  st.done = true; await saveProgress(prog); await idb.del('kv', 'exam:' + m.id);
  nav.guard = null;
  if (res.pass !== false && res.pct >= 0.5) { sound('done'); confetti(); }
  examResult(el, m, x, rec, true);
}

function examResult(el, m, x, rec, fresh) {
  const items = examItems(x), scale = m.scales[x.scale], res = applyScale(scale, rec.points, rec.max, m.lang);
  const results = items.map((it, i) => scoreTask(it.task, rec.answers[i], m.lang));
  const parts = x.parts.map((p, pi) => { const r = results.filter((_, i) => items[i].part === pi); return { p, pts: sum(r.map(q => q.points)), max: sum(p.tasks.map(q => q.points)) }; });
  el.innerHTML = `${topbar(esc(x.title), { closeIcon: true })}<div class="pad result">
    <div class="res-hero exam${res.pass === false ? ' fail' : ' pass'}">
      <small class="kicker" lang="${UI_LANG}">${esc(scale && scale.title ? scale.title : t('ex.result'))}</small>
      <div class="big-result">${esc(res.text)}</div>
      <p class="res-main" lang="${UI_LANG}">${esc(t('ex.pts', { p: fmtPts(rec.points, UI_LANG), m: fmtPts(rec.max, UI_LANG) }))}${res.pass != null ? ` · <b>${esc(res.pass ? t('ex.passed') : t('ex.failed'))}</b>` : ''}</p>
      <div class="res-stats" lang="${UI_LANG}"><span>${icon('clock')}${fmtClock(rec.secs)}</span><span>${icon('check')}${results.filter(r => r.status === 'right').length} / ${items.length}</span><span>${icon('target')}${Math.round(res.pct * 100)}%</span></div>
      <small class="muted" lang="${UI_LANG}">${esc(new Date(rec.at).toLocaleString(UI_LANG, { dateStyle: 'medium', timeStyle: 'short' }))}</small></div>
    ${parts.length > 1 ? `<div class="card partbars">${parts.map(q => `<div class="pb"><span>${esc(q.p.title || '')}</span>${bar(q.max ? q.pts / q.max : 0)}<b lang="${UI_LANG}">${fmtPts(q.pts, UI_LANG)}/${fmtPts(q.max, UI_LANG)}</b></div>`).join('')}</div>` : ''}
    <h2 class="sec-title" lang="${UI_LANG}">${esc(t('ex.review'))}</h2>
    ${x.parts.map((p, pi) => `<h3 class="part-h">${esc(p.title || '')}</h3><ol class="res-list">${items.map((it, i) => it.part !== pi ? '' : `<li><button data-rev="${i}" class="st-${results[i].status}">${statusIcon(results[i].status)}<span><i class="qn">${it.n}.</i> ${esc(plain(it.task.prompt || it.task.text) || '')}</span><small lang="${UI_LANG}">${fmtPts(results[i].points, UI_LANG)}/${fmtPts(it.task.points, UI_LANG)}</small></button></li>`).join('')}</ol>`).join('')}
    <div class="res-actions" lang="${UI_LANG}"><button class="btn accent block" data-back>${esc(t('pr.toModule'))}</button></div></div>`;
  window.scrollTo(0, 0);
  el.addEventListener('click', e => { const r = e.target.closest('[data-rev]'); if (r) { const i = +r.dataset.rev; reviewTask(m, items[i].task, rec.answers[i], results[i], rec.seed); } });
}
