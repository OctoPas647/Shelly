/* ================= Lesson practice: one task at a time, with feedback after each ================= */
const plain = (s, n = 90) => { const x = String(s || '').replace(/\$\$?([^$]*)\$\$?/g, '$1').replace(/[*_~`#>\\]/g, '').replace(/\[\[\d+\]\]/g, '…').replace(/\s+/g, ' ').trim(); return x.length > n ? x.slice(0, n - 1) + '…' : x; };
const statusIcon = s => icon(s === 'right' ? 'check' : s === 'partial' ? 'target' : s === 'ungraded' ? 'pen' : 'close');
const PRAISE = ['pr.right1', 'pr.right2', 'pr.right3', 'pr.right4'];

SCREENS.practice = async (el, { id, lesson }, nav) => {
  const m = await loadModule(id), l = m && m.lessonList.find(x => x.id === lesson);
  if (!l || !l.practice) return back();
  /* 'Shuffle questions' in Settings: random task order on every attempt, whatever order the module uses */
  const tasks = APP.settings.shuffle ? shuffled(l.practice.tasks) : l.practice.tasks, prog = await loadProgress(id), seed = uid(), started = Date.now();
  const P = { i: 0, phase: 'answer', res: [], resp: [], xp: 0, done: false, touched: false };
  moduleLook(el, m); el.setAttribute('lang', m.lang);
  el.innerHTML = `<header class="playbar"><button class="iconbtn" data-back aria-label="${esc(t('nav.close'))}">${icon('close')}</button>${bar(0, 'pbar')}<span class="pcount" lang="${UI_LANG}"></span></header>
    <main class="playmain"></main>
    <footer class="checkbar" lang="${UI_LANG}"><div class="verdict"></div><button class="btn accent big" data-main></button></footer>`;
  const main = el.querySelector('.playmain'), foot = el.querySelector('.checkbar'), btn = foot.querySelector('[data-main]'), verdict = foot.querySelector('.verdict');
  nav.guard = async () => P.done || !P.touched || confirmBox(t('pr.leaveTitle'), t('pr.leave'), t('pr.leaveOk'), true);
  nav.onLeave = stopMedia;
  let view = null, rub = null;

  function showTask() {
    stopMedia();
    const task = tasks[P.i]; P.phase = 'answer'; rub = null;
    view = taskView(task, m, { mode: 'practice', seed, onChange: upd });
    main.innerHTML = ''; main.appendChild(view.el); main.scrollTop = 0; window.scrollTo(0, 0);
    el.querySelector('.pcount').textContent = `${P.i + 1} / ${tasks.length}`;
    el.querySelector('.pbar i').style.width = (P.i / tasks.length * 100) + '%';
    foot.className = 'checkbar'; verdict.innerHTML = '';
    btn.textContent = task.type === 'open' ? t('pr.doneWriting') : t('pr.check');
    upd();
  }
  function upd() { if (P.phase === 'answer') { btn.disabled = !(view.ready() || tasks[P.i].type === 'order'); P.touched = P.touched || view.ready(); } }

  function check() {
    const task = tasks[P.i], resp = view.get(); P.resp[P.i] = resp; P.touched = true;
    if (task.type === 'open') {
      P.phase = 'grade'; view.show({ status: 'ungraded' });
      rub = rubricView(task, null);
      const fb = view.el.querySelector('.fb'); fb.hidden = false; fb.appendChild(rub.el);
      verdict.innerHTML = `<b>${esc(t('pr.gradeTitle'))}</b><small>${esc(t('pr.gradeHint'))}</small>`;
      btn.textContent = t('pr.saveGrade'); btn.disabled = false;
      setTimeout(() => fb.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
      return;
    }
    settle(task, scoreTask(task, resp, m.lang));
  }
  function settle(task, res) {
    const k = view.hintsUsed();
    if (k && res.points > 0) res = { ...res, points: roundTo(res.points * HINT_FACTORS[Math.min(3, k)], 2), hinted: k };
    P.res[P.i] = res; recordTask(prog, task, res);
    P.xp += res.status === 'right' ? XP.right : res.status === 'partial' ? XP.partial : 0;
    const fbHTML = view.show(res);
    sound(res.status === 'right' || res.status === 'partial' ? 'right' : 'wrong');
    foot.className = 'checkbar ' + (res.status === 'right' ? 'good' : res.status === 'partial' ? 'meh' : 'bad');
    const pts = t('pr.pts', { p: fmtPts(res.points, UI_LANG), m: fmtPts(res.max, UI_LANG) }) + (res.hinted ? ' · ' + tn('pr.hinted', res.hinted) : '');
    verdict.innerHTML = `${statusIcon(res.status)}<span><b>${esc(res.status === 'right' ? t(PRAISE[Math.random() * PRAISE.length | 0]) : res.status === 'partial' ? t('pr.partial') : res.status === 'empty' ? t('pr.empty') : t('pr.wrong'))}</b><small>${esc(pts)}</small></span>`;
    P.phase = 'next'; btn.disabled = false; btn.textContent = P.i === tasks.length - 1 ? t('pr.finish') : t('pr.next');
    if (fbHTML || task.explain) setTimeout(() => view.el.querySelector('.fb:not([hidden])')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);
  }
  btn.addEventListener('click', () => {
    if (P.phase === 'answer') return check();
    if (P.phase === 'grade') { const task = tasks[P.i], r = { text: P.resp[P.i].text, marks: rub.get() }; P.resp[P.i] = r; rub.el.querySelectorAll('button').forEach(b => b.disabled = true); return settle(task, scoreTask(task, r, m.lang)); }
    if (P.phase === 'next') { if (++P.i < tasks.length) showTask(); else finish(); }
  });
  main.addEventListener('submit-answer', () => { if (P.phase === 'answer' && !btn.disabled) check(); });

  async function finish() {
    const pts = sum(P.res.map(r => r.points)), max = sum(tasks.map(x => x.points)), share = max ? pts / max : 0;
    const newly = finishLesson(prog, l, share); if (newly) P.xp += XP.lesson;
    addXP(prog, P.xp); await saveProgress(prog); P.done = true;
    const passed = share >= l.practice.pass, scale = m.scales[l.practice.scale], sc = scale ? applyScale(scale, pts, max, m.lang) : null;
    if (passed) { sound('done'); confetti(); }
    const secs = (Date.now() - started) / 1000, right = P.res.filter(r => r.status === 'right').length;
    el.querySelector('.playbar').outerHTML = topbar(esc(l.title), { closeIcon: true });
    foot.remove();
    main.innerHTML = `<div class="result pad">
      <div class="res-hero${passed ? ' pass' : ''}">${ring(share, Math.round(share * 100) + '%', 'big')}
        <h1 lang="${UI_LANG}">${esc(newly ? t('pr.lessonDone') : passed ? t('pr.good') : t('pr.keepGoing'))}</h1>
        <p class="res-main">${sc ? `<b>${esc(sc.text)}</b> · ` : ''}<span lang="${UI_LANG}">${esc(t('pr.pts', { p: fmtPts(pts, UI_LANG), m: fmtPts(max, UI_LANG) }))}</span></p>
        ${!passed ? `<p class="muted" lang="${UI_LANG}">${esc(t('pr.need', { p: Math.round(l.practice.pass * 100) }))}</p>` : ''}
        <div class="res-stats" lang="${UI_LANG}"><span>${icon('bolt')}+${P.xp} XP</span><span>${icon('check')}${right} / ${tasks.length}</span><span>${icon('clock')}${fmtClock(secs)}</span></div></div>
      <h2 class="sec-title" lang="${UI_LANG}">${esc(t('pr.review'))}</h2>
      <ol class="res-list">${tasks.map((x, i) => `<li><button data-rev="${i}" class="st-${P.res[i].status}">${statusIcon(P.res[i].status)}<span>${esc(plain(x.prompt || x.text) || t('task.n', { n: i + 1 }))}</span><small lang="${UI_LANG}">${fmtPts(P.res[i].points, UI_LANG)}/${fmtPts(x.points, UI_LANG)}</small></button></li>`).join('')}</ol>
      <div class="res-actions" lang="${UI_LANG}"><button class="btn ghost" data-again>${icon('reset')}${esc(t('pr.again'))}</button><button class="btn accent" data-out>${esc(t('pr.toModule'))}</button></div></div>`;
    main.querySelector('[data-again]').onclick = () => go('practice', { id, lesson }, { replace: true });
    main.querySelector('[data-out]').onclick = () => backTo('module');
    main.addEventListener('click', e => { const r = e.target.closest('[data-rev]'); if (r) reviewTask(m, tasks[+r.dataset.rev], P.resp[+r.dataset.rev], P.res[+r.dataset.rev], seed); });
  }
  showTask();
};

/* One task with the learner's answer, the right answer and the explanation, in a sheet */
function reviewTask(m, task, resp, res, seed) {
  const v = taskView(task, m, { mode: 'review', response: resp, seed });
  v.show(res);
  if (task.type === 'open' && resp && resp.marks) { const r = rubricView(task, resp.marks); r.el.querySelectorAll('button').forEach(b => b.disabled = true); const fb = v.el.querySelector('.fb'); fb.hidden = false; fb.appendChild(r.el); }
  sheet({ title: t('pr.pts', { p: fmtPts(res.points, UI_LANG), m: fmtPts(res.max, UI_LANG) }), wide: true, onMount: s => { s.querySelector('.sheet-body').appendChild(v.el); }, actions: [{ id: 'x', label: t('btn.close'), kind: 'primary' }] }).then(stopMedia);
}
