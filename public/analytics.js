// Cloudflare's injected tag is inert until these client-side exclusions pass.
(() => {
  if (
    navigator.webdriver ||
    location.hostname !== 'dibs.here' ||
    new URLSearchParams(location.search).get('no-analytics') === '1' ||
    document.querySelector('meta[name="dibs-test"]')
  )
    return;
  const config = document.querySelector('script[data-dibs-beacon]');
  if (!config) return;
  const script = document.createElement('script');
  script.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  script.defer = true;
  script.setAttribute('data-cf-beacon', config.getAttribute('data-dibs-beacon'));
  document.head.append(script);
})();
