/* ================= A module's own page: exams, units and lessons, and the module menu ================= */
const blockKinds = l => [...new Set(l.content.map(b => b.type).filter(x => ['image', 'audio', 'video'].includes(x)))];

SCREENS.module = async (el, { id }, nav) => {
  const m = await loadModule(id);
  if (!m) { toast(t('mod.gone')); return home(); }
  const p = await loadProgress(id), st = moduleStats(m, p), running = await idb.get('kv', 'exam:' + id);
  moduleLook(el, m);
  const runningExam = running && m.exams.find(x => x.id === running.exam);
  const examCard = x => {
    const best = st.best[x.id], scale = m.scales[x.scale], tries = p.exams.filter(e => e.exam === x.id).length;
    const res = best ? applyScale(scale, best.points, best.max, m.lang) : null;
    return `<div class="examcard">
      <div class="ex-top"><span class="ex-ic">${icon('layers')}</span><div><b>${esc(x.title)}</b>
        <small lang="${UI_LANG}">${[x.minutes ? t('ex.minutes', { n: x.minutes }) : null, tn('n.tasks', x.count), t('ex.points', { n: fmtPts(x.max, UI_LANG) })].filter(Boolean).map(esc).join(' · ')}</small></div></div>
      ${x.description ? `<p class="ex-desc">${richInline(x.description)}</p>` : ''}
      <div class="ex-bottom">${res ? `<button class="best" data-history="${esc(x.id)}" lang="${UI_LANG}">${icon('trophy')}<span>${esc(t('ex.best'))}: <b lang="${esc(m.lang)}">${esc(res.text)}</b> · ${esc(tn('n.tries', tries))}</span></button>` : `<span class="muted small" lang="${UI_LANG}">${esc(t('ex.never'))}</span>`}
        <button class="btn accent small" data-exam="${esc(x.id)}">${esc(t('ex.start'))}</button></div></div>`;
  };
  let n = 0;
  const unitHTML = m.units.map(u => {
    const done = u.lessons.filter(l => lessonState(p, l).done).length;
    return `<section class="unit"><div class="unit-head"><div><small class="kicker">${esc(t('mod.unit', { n: m.units.indexOf(u) + 1 }))}</small><h2>${esc(u.title)}</h2>${u.description ? `<p>${richInline(u.description)}</p>` : ''}</div>${ring(u.lessons.length ? done / u.lessons.length : 0, `${done}/${u.lessons.length}`, 'small')}</div>
      <ol class="path">${u.lessons.map(l => {
        const s = lessonState(p, l), k = ++n, tasks = l.practice ? l.practice.tasks.length : 0;
        return `<li><button class="lesson${s.done ? ' done' : s.runs ? ' tried' : ''}" data-lesson="${esc(l.id)}">
          <span class="node">${s.done ? icon('check') : k}</span>
          <span class="l-main"><b>${esc(l.title)}</b>${l.summary ? `<small>${richInline(l.summary)}</small>` : ''}
            <span class="chips" lang="${UI_LANG}">${l.content.length ? `<i>${icon('book')}${esc(t('mod.lessonChip'))}</i>` : ''}${blockKinds(l).map(k2 => `<i>${icon(k2 === 'image' ? 'image' : k2 === 'audio' ? 'sound' : 'play')}</i>`).join('')}${tasks ? `<i>${icon('pen')}${esc(tn('n.tasks', tasks))}</i>` : ''}${s.runs ? `<i class="score">${Math.round(s.best * 100)}%</i>` : ''}</span></span>
        </button></li>`;
      }).join('')}</ol></section>`;
  }).join('');
  el.setAttribute('lang', m.lang);
  el.innerHTML = `
    <div class="hero">
      ${topbar('', { right: `<button class="iconbtn" data-menu aria-label="${esc(t('mod.menu'))}">${icon('more')}</button>`, cls: 'on-accent' })}
      <div class="hero-body"><div class="hero-icon">${modIcon(m)}</div><div class="hero-text"><h1>${esc(m.title)}</h1>${m.subtitle ? `<p>${esc(m.subtitle)}</p>` : ''}</div>
      ${ring(st.pct, Math.round(st.pct * 100) + '%', 'on-accent')}</div>
      <div class="hero-stats" lang="${UI_LANG}">${st.total ? `<span>${icon('book')}${esc(tn('n.lessonsDone', st.total, { done: st.done }))}</span>` : ''}${m.exams.length ? `<span>${icon('layers')}${esc(tn('n.examsDone', p.exams.length))}</span>` : ''}<span>${icon('bolt')}${p.xp || 0} XP</span></div>
    </div>
    <div class="pad">
      ${runningExam ? `<button class="resume" data-resume lang="${UI_LANG}">${icon('clock')}<span><b>${esc(t('ex.resume'))}</b><small lang="${esc(m.lang)}">${esc(runningExam.title)}</small></span>${icon('next')}</button>` : ''}
      ${m.exams.length ? `<h2 class="sec-title" lang="${UI_LANG}">${esc(t('mod.exams'))}</h2>${m.exams.map(examCard).join('')}` : ''}
      ${m.units.length ? `<h2 class="sec-title" lang="${UI_LANG}">${esc(t('mod.lessons'))}</h2>${unitHTML}` : ''}
    </div>`;
  hydrateMedia(el, m.id);
  el.addEventListener('click', e => {
    const a = e.target.closest('[data-lesson],[data-exam],[data-history],[data-menu],[data-resume]'); if (!a) return;
    if (a.dataset.lesson) return go('lesson', { id, lesson: a.dataset.lesson });
    if (a.dataset.exam) return startExam(m, a.dataset.exam, !!runningExam);
    if (a.dataset.history) return examHistory(m, p, a.dataset.history);
    if (a.hasAttribute('data-resume')) return go('exam', { id, resume: true });
    if (a.hasAttribute('data-menu')) return moduleMenu(m, p);
  });
};

async function startExam(m, examId, busy) {
  if (busy && !(await confirmBox(t('ex.replaceTitle'), t('ex.replace'), t('ex.startNew'), true))) return;
  if (busy) await idb.del('kv', 'exam:' + m.id);
  go('exam', { id: m.id, exam: examId });
}

function examHistory(m, p, examId) {
  const x = m.exams.find(e => e.id === examId), scale = m.scales[x.scale];
  const rows = p.exams.map((r, i) => [r, i]).filter(([r]) => r.exam === examId).reverse().map(([r, i]) => {
    const res = applyScale(scale, r.points, r.max, m.lang);
    return `<button class="histrow" data-act="${i}"><span><b lang="${esc(m.lang)}">${esc(res.text)}</b><small>${esc(new Date(r.at).toLocaleString(UI_LANG, { dateStyle: 'medium', timeStyle: 'short' }))} · ${esc(t('ex.pts', { p: fmtPts(r.points, UI_LANG), m: fmtPts(r.max, UI_LANG) }))}</small></span>${icon('next')}</button>`;
  }).join('');
  sheet({ title: x.title, body: `<div class="histlist">${rows}</div>` }).then(v => { if (v != null) go('exam', { id: m.id, exam: examId, record: +v }); });
}

async function moduleMenu(m, p) {
  const v = await sheet({ title: m.title, body: '', actions: [
    { id: 'share', label: t('mod.share'), icon: 'share', kind: 'ghost row' },
    { id: 'about', label: t('mod.about'), icon: 'info', kind: 'ghost row' },
    { id: 'reset', label: t('mod.reset'), icon: 'reset', kind: 'ghost row' },
    { id: 'remove', label: t('mod.remove'), icon: 'trash', kind: 'ghost row danger-text' }] });
  if (v === 'share') shareFlow(m, p);
  if (v === 'about') aboutModule(m);
  if (v === 'reset' && await confirmBox(t('mod.resetTitle'), t('mod.resetText'), t('mod.resetOk'), true)) { await resetModule(m.id); toast(t('mod.resetDone')); refresh(); }
  if (v === 'remove' && await confirmBox(t('mod.removeTitle'), t('mod.removeText', { title: m.title }), t('mod.removeOk'), true)) { await removeModule(m.id); toast(t('mod.removed')); home(); }
}

async function shareFlow(m, p) {
  const st = moduleStats(m, p), has = hasProgress(p);
  let withProg = false;
  const body = `<p>${esc(t('share.text'))}</p>
    <div class="choices">
      <label class="choice"><input type="radio" name="sp" value="0" checked><span><b>${esc(t('share.blank'))}</b><small>${esc(t('share.blankHint'))}</small></span></label>
      <label class="choice${has ? '' : ' disabled'}"><input type="radio" name="sp" value="1"${has ? '' : ' disabled'}><span><b>${esc(t('share.mine'))}</b><small>${esc(has ? t('imp.progLine', { done: st.done, total: st.total, exams: p.exams.length, xp: p.xp }) : t('share.nothing'))}</small></span></label>
    </div>`;
  const acts = [{ id: 'save', label: t('share.save'), icon: 'download' }, { id: 'send', label: t('share.send'), icon: 'share', kind: 'primary' }];
  const v = await sheet({ title: t('mod.share'), body, actions: Native.canSend() ? acts : [{ ...acts[0], kind: 'primary' }], onMount: s => s.addEventListener('change', e => { withProg = e.target.value === '1'; }) });
  if (!v) return;
  const wait = waitSheet(t('share.packing'));
  try { const { blob, name } = await exportModule(m.id, withProg); wait.close(); await Native.saveFile(blob, name, v === 'send' ? 'share' : 'save'); }
  catch (e) { wait.close(); toast(t('share.fail')); console.error(e); }
}

async function aboutModule(m) {
  const rec = await idb.get('modules', m.id), mb = (rec.bytes || 0) / 1048576;
  const rows = [[t('about.author'), m.author || '—'], [t('about.version'), m.version], [t('about.lang'), langName(m.lang)], [t('about.content'), [tn('n.units', m.units.length), tn('n.lessons', m.lessonList.length), tn('n.exams', m.exams.length), tn('n.tasks', Object.keys(m.taskById).length)].join(' · ')],
    [t('about.media'), mb ? fmtNum(mb, UI_LANG, mb < 10 ? 1 : 0) + ' MB' : '—'], [t('about.added'), new Date(rec.installedAt).toLocaleDateString(UI_LANG, { dateStyle: 'medium' })], ['ID', m.id]];
  sheet({ title: m.title, body: `${m.description ? `<p lang="${esc(m.lang)}">${richInline(m.description)}</p>` : ''}<dl class="facts">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`, actions: [{ id: 'ok', label: t('btn.ok'), kind: 'primary' }] });
}
const langName = code => { try { return new Intl.DisplayNames([UI_LANG], { type: 'language' }).of(code); } catch (e) { return code; } };
