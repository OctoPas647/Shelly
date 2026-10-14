/* ================= Start ================= */
(async function boot() {
  root = document.getElementById('app');
  try { await loadApp(); } catch (e) { console.error(e); }
  applySettings();
  history.replaceState({ d: 1 }, '');
  NAV.push({ screen: 'library', params: {} });
  render();
  if (window.AndroidFiles && window.AndroidFiles.ready) window.AndroidFiles.ready();
})();
