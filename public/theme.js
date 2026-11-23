try {
  var theme = localStorage.getItem('dibs-theme');
  document.documentElement.dataset.theme = theme === 'light' || theme === 'dark' ? theme : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
} catch (_) {
  document.documentElement.dataset.theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

document.documentElement.style.colorScheme = document.documentElement.dataset.theme;
document.querySelector('meta[name=theme-color]')?.setAttribute('content', document.documentElement.dataset.theme === 'dark' ? '#16150f' : '#F1ECE2');
