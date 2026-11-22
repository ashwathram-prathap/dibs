try {
  var theme = localStorage.getItem('dibs-theme');
  document.documentElement.dataset.theme = theme === 'light' || theme === 'dark' ? theme : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
} catch (_) {
  document.documentElement.dataset.theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
