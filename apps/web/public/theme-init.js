// Aplica el tema guardado antes de pintar para evitar el parpadeo.
(function () {
  try {
    var stored = JSON.parse(localStorage.getItem('campus-ui') || '{}');
    var theme = (stored.state && stored.state.theme) || 'dark';
    if (theme === 'system') theme = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
  } catch (e) {
    document.documentElement.dataset.theme = 'dark';
  }
})();
