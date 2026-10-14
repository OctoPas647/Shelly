/* ================= Settings ================= */
SCREENS.settings = async el => {
  const s = APP.settings;
  const seg = (key, opts) => `<div class="seg" data-key="${key}">${opts.map(([v, label]) => `<button data-v="${v}" class="${s[key] === v ? 'on' : ''}">${esc(label)}</button>`).join('')}</div>`;
  const sw = key => `<button class="switch${s[key] ? ' on' : ''}" data-sw="${key}" role="switch" aria-checked="${!!s[key]}"><i></i></button>`;
  let used = '';
  try { const e = await navigator.storage.estimate(); used = fmtNum(e.usage / 1048576, UI_LANG, 1) + ' MB'; } catch (e) { }
  el.innerHTML = `${topbar(esc(t('set.title')))}<div class="pad settings">
    <section class="card"><h3>${icon('globe')}${esc(t('set.lang'))}</h3>${seg('lang', [['auto', t('set.auto')], ['bg', 'Български'], ['en', 'English']])}<p class="muted small">${esc(t('set.langHint'))}</p></section>
    <section class="card"><h3>${icon('moon')}${esc(t('set.theme'))}</h3>${seg('theme', [['auto', t('set.auto')], ['light', t('set.light')], ['dark', t('set.dark')]])}</section>
    <section class="card rows">
      <div class="row"><span>${icon('sound')}${esc(t('set.sound'))}</span>${sw('sound')}</div>
      <div class="row"><span>${icon('bolt')}${esc(t('set.motion'))}</span>${sw('motion')}</div></section>
    <section class="card"><h3>${icon('info')}${esc(t('set.about'))}</h3>
      <p><b>${esc(APP_NAME)}</b> ${esc(APP_VERSION)}</p><p class="muted small">${esc(t('set.aboutText'))}</p>
      ${used ? `<p class="muted small">${esc(t('set.storage', { n: used }))}</p>` : ''}
      <p class="sample" lang="bg">Ж ж · Д д · Л л · К к · Ц ц · Щ щ · Ю ю · Я я</p>
      <p class="muted small">${esc(t('set.fonts'))}</p></section>
    <button class="btn ghost danger-text block" data-wipe>${icon('trash')}${esc(t('set.wipe'))}</button></div>`;
  el.addEventListener('click', async e => {
    const b = e.target.closest('.seg button');
    if (b) { s[b.parentNode.dataset.key] = b.dataset.v; saveApp(); applySettings(); return refresh(); }
    const w = e.target.closest('[data-sw]');
    if (w) { s[w.dataset.sw] = !s[w.dataset.sw]; saveApp(); applySettings(); w.classList.toggle('on'); w.setAttribute('aria-checked', s[w.dataset.sw]); return; }
    if (e.target.closest('[data-wipe]') && await confirmBox(t('set.wipeTitle'), t('set.wipeText'), t('set.wipeOk'), true)) {
      (await db()).close(); dbp = null; indexedDB.deleteDatabase(DB_NAME); APP = JSON.parse(JSON.stringify(APP_DEFAULT)); setTimeout(() => location.reload(), 300);
    }
  });
};
