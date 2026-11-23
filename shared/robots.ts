// Search exclusion belongs in noindex headers; preview bots still need HTML and images.
export function robots(origin: string, staging = false) {
  const previews = 'Allow: /api/og\nAllow: /summary/\nAllow: /c/\nAllow: /certificate/\n';
  const privatePaths = 'Disallow: /api/\nDisallow: /admin\nDisallow: /stats\n';
  return (
    'User-agent: *\n' +
    (staging ? 'Disallow: /\n' : 'Allow: /\n' + privatePaths) +
    previews +
    '\n' +
    ['LinkedInBot', 'facebookexternalhit', 'Twitterbot', 'Slackbot', 'Discordbot']
      .map((bot) => 'User-agent: ' + bot + '\n' + privatePaths + previews + 'Allow: /$\n')
      .join('\n') +
    (staging ? '' : '\nSitemap: ' + origin + '/sitemap.xml\n')
  );
}
