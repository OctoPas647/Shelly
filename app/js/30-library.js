/* ================= Home: the module library ================= */
const modIcon = (m, id) => (typeof m.icon === 'string' && /[./]/.test(m.icon) ? `<img data-media="${esc(m.icon)}" alt="">` : `<span>${esc(m.icon || m.title.trim().charAt(0).toUpperCase())}</span>`);

SCREENS.library = async el => {
  const mods = await listModules(), streak = streakNow(), today = APP.days[todayKey()] || 0;
  const hour = new Date().getHours(), hello = t(hour < 5 ? 'hi.night' : hour < 12 ? 'hi.morning' : hour < 18 ? 'hi.day' : 'hi.evening');
  const cards = mods.map(({ rec, prog }) => {
    const m = prepareModule(rec.json), st = moduleStats(m, prog);
    const line = st.total ? tn('n.lessonsDone', st.total, { done: st.done }) : tn('n.exams', m.exams.length);
    return `<button class="modcard" data-open="${esc(m.id)}" style="--accent:${m.color};--accent-ink:${inkOn(m.color)}" lang="${esc(m.lang)}">
      <div class="mc-icon" data-mod="${esc(m.id)}">${modIcon(m)}</div>
      <div class="mc-main"><b>${esc(m.title)}</b>${m.subtitle ? `<small>${esc(m.subtitle)}</small>` : ''}
        ${bar(st.pct)}<span class="mc-meta" lang="${UI_LANG}">${esc(line)}${prog.xp ? ` · ${icon('bolt')}${prog.xp}` : ''}</span></div>
      ${icon('next', 'chev')}</button>`;
  }).join('');
  el.innerHTML = `
    <header class="apphead">
      <div class="brand">${esc(APP_NAME)}</div>
      <div class="head-stats">
        <span class="pill flame${streak ? ' on' : ''}" title="${esc(t('lib.streak'))}">${icon('flame')}${streak}</span>
        <span class="pill xp" title="${esc(t('lib.xp'))}">${icon('bolt')}${APP.xp}</span>
        <button class="iconbtn" data-settings aria-label="${esc(t('set.title'))}">${icon('settings')}</button>
      </div>
    </header>
    <section class="pad">
      <h1 class="hello">${esc(hello)}</h1>
      <p class="muted">${esc(mods.length ? (today ? t('lib.today', { xp: today }) : t('lib.pick')) : t('lib.emptySub'))}</p>
      ${mods.length ? `<h2 class="sec-title">${esc(t('lib.mine'))}</h2><div class="modlist">${cards}</div>` : emptyLibrary()}
      <button class="addcard" data-add>${icon('plus')}<span><b>${esc(t('lib.add'))}</b><small>${esc(t('lib.addHint'))}</small></span></button>
    </section>`;
  el.querySelectorAll('.mc-icon[data-mod]').forEach(x => hydrateMedia(x, x.dataset.mod));
  el.addEventListener('click', e => {
    const o = e.target.closest('[data-open]'); if (o) return go('module', { id: o.dataset.open });
    if (e.target.closest('[data-add]')) return pickAndAdd();
    if (e.target.closest('[data-settings]')) return go('settings');
  });
};

function emptyLibrary() {
  return `<div class="empty">
    <svg viewBox="0 0 200 140" class="empty-art" aria-hidden="true">
      <rect x="38" y="30" width="96" height="78" rx="14" class="ea-back"/><rect x="58" y="20" width="96" height="78" rx="14" class="ea-mid"/>
      <rect x="78" y="10" width="96" height="78" rx="14" class="ea-front"/><path d="M126 34v30M111 49h30" class="ea-plus"/>
      <circle cx="40" cy="118" r="5" class="ea-dot"/><circle cx="170" cy="112" r="4" class="ea-dot2"/><circle cx="182" cy="28" r="3" class="ea-dot"/>
    </svg>
    <h2>${esc(t('lib.emptyTitle'))}</h2><p>${esc(t('lib.emptyText'))}</p></div>`;
}

async function pickAndAdd() { const f = await Native.pickFile(); if (f) addModuleFlow(f); }

/* The whole "someone gave me a module file" flow */
async function addModuleFlow(file) {
  const wait = waitSheet(t('imp.reading'));
  let info;
  try { info = await inspectModuleFile(file); } catch (e) { info = { fatal: 'notZip' }; }
  wait.close();
  if (info.fatal) return sheet({ title: t('imp.cantTitle'), body: `<p>${esc(t('imp.' + info.fatal))}</p>${info.detail ? `<p class="muted small">${esc(info.detail)}</p>` : ''}`, actions: [{ id: 'ok', label: t('btn.ok'), kind: 'primary' }] });
  if (info.errors.length) {
    const list = info.errors.slice(0, 10).map(e => `<li><code>${esc(e.at)}</code> ${esc(e.msg)}</li>`).join('');
    return sheet({ title: t('imp.brokenTitle'), body: `<p>${esc(t('imp.broken', { title: info.json.title || '?' }))}</p><ul class="errlist">${list}</ul>${info.errors.length > 10 ? `<p class="muted small">${esc(t('imp.more', { n: info.errors.length - 10 }))}</p>` : ''}`, actions: [{ id: 'ok', label: t('btn.ok'), kind: 'primary' }] });
  }
  const j = info.json, m = prepareModule(j);
  const facts = [tn('n.lessons', m.lessonList.length), tn('n.exams', m.exams.length), tn('n.tasks', Object.keys(m.taskById).length)].join(' · ');
  const progLine = p => { const s = moduleStats(m, p); return t('imp.progLine', { done: s.done, total: s.total, exams: p.exams.length, xp: p.xp }); };
  let body = `<div class="modpreview" style="--accent:${m.color};--accent-ink:${inkOn(m.color)}" lang="${esc(m.lang)}"><div class="mc-icon">${modIcon(m)}</div><div><b>${esc(m.title)}</b>${m.subtitle ? `<small>${esc(m.subtitle)}</small>` : ''}<small lang="${UI_LANG}">${esc(facts)}</small></div></div>`;
  if (j.author) body += `<p class="muted small">${esc(t('mod.by', { a: j.author }))} · ${esc(t('mod.version', { v: j.version }))}</p>`;
  let actions, title;
  if (info.existing) {
    title = t('imp.updateTitle');
    body += `<p>${esc(t('imp.update', { from: info.existing.json.version, to: j.version }))}</p>`;
    if (info.progress) {
      body += `<div class="progbox"><b>${esc(t('imp.fileHas'))}</b><span>${esc(progLine(info.progress))}</span></div>`;
      if (info.mine) body += `<div class="progbox"><b>${esc(t('imp.youHave'))}</b><span>${esc(progLine(info.mine))}</span></div>`;
      actions = [{ id: 'mine', label: t('imp.keepMine'), kind: 'primary' }, { id: 'theirs', label: t('imp.useTheirs') }, { id: 'fresh', label: t('imp.fresh') }];
    } else actions = [{ id: 'mine', label: t('imp.updateKeep'), kind: 'primary' }, { id: 'fresh', label: t('imp.updateFresh') }];
  } else if (info.progress) {
    title = t('imp.withProgTitle');
    body += `<p>${esc(t('imp.withProg'))}</p><div class="progbox"><b>${esc(t('imp.fileHas'))}</b><span>${esc(progLine(info.progress))}</span></div>`;
    actions = [{ id: 'theirs', label: t('imp.continueTheirs'), kind: 'primary' }, { id: 'fresh', label: t('imp.fresh') }];
  } else {
    title = t('imp.addTitle');
    if (j.description) body += `<p lang="${esc(m.lang)}">${esc(j.description)}</p>`;
    actions = [{ id: 'fresh', label: t('imp.add'), kind: 'primary' }];
  }
  if (info.warnings.length) body += `<p class="muted small">${esc(tn('imp.warnings', info.warnings.length))}</p>`;
  const choice = await sheet({ title, body, actions: [...actions, { id: 'cancel', label: t('btn.cancel') }] });
  if (!choice || choice === 'cancel') return;
  const prog = waitSheet(t('imp.installing'), true);
  try { await installModule(info, choice, f => prog.set(f)); }
  catch (e) { prog.close(); return sheet({ title: t('imp.cantTitle'), body: `<p>${esc(t('imp.storeFail'))}</p><p class="muted small">${esc(e.message || e)}</p>`, actions: [{ id: 'ok', label: t('btn.ok'), kind: 'primary' }] }); }
  prog.close();
  toast(info.existing ? t('imp.updated') : t('imp.added'), 'good');
  home(); go('module', { id: j.id });
}

/* A small non-dismissable sheet with a spinner or a progress bar */
function waitSheet(text, withBar) {
  let api = { close() { }, set() { } };
  sheet({ body: `<div class="waiting"><div class="spinner"></div><p>${esc(text)}</p>${withBar ? bar(0, 'wbar') : ''}</div>`, dismiss: false, onMount: (s, o) => {
    api = { close: () => o.close(null), set: f => { const i = s.querySelector('.wbar i'); if (i) i.style.width = clamp(f, 0, 1) * 100 + '%'; } };
  } });
  return { close: () => api.close(), set: f => api.set(f) };
}

/* Files arriving from Android ("Open with…" or "Share to…") come in base64 chunks */
window.__incoming = (() => {
  let parts = [], name = '';
  return {
    begin(n) { parts = []; name = n || 'module.zip'; },
    chunk(b64) { const s = atob(b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); parts.push(u); },
    end() { const f = new File(parts, name, { type: 'application/zip' }); parts = []; const go2 = () => addModuleFlow(f); root ? go2() : setTimeout(go2, 500); }
  };
})();
