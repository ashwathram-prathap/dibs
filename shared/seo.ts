import {
  GAME_DESCRIPTION,
  GAME_EXPLANATION,
  LIMIT_EXPLANATION,
  BACKUP_EXPLANATION,
  FINISH_EXPLANATION,
  SCHEDULE_EXPLANATION,
  GOLDEN_EXPLANATION,
  RESERVED_EXPLANATION,
} from './copy';
import { edition } from './time';
export const HOME_TITLE = 'Dibs | A daily game: call it first, it’s yours';
export const HOME_DESCRIPTION = GAME_DESCRIPTION;
export const escapeHtml = (value: unknown) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
export function archiveTitle(c: { date: string; name: string }) {
  const date = new Date(c.date + 'T12:00:00Z').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return `Dibs #${edition(c.date)}: ${c.name} (${date}) | Who claimed what`;
}
export const rulesHtml = `<h1>Dibs</h1><p>${GAME_EXPLANATION}</p><p>${LIMIT_EXPLANATION}</p><h2>How to play</h2><p>${FINISH_EXPLANATION}</p><p>${SCHEDULE_EXPLANATION}</p><p>${RESERVED_EXPLANATION}</p><h2>Frequently asked questions</h2><h3>What's a golden ticket?</h3><p>${GOLDEN_EXPLANATION}</p><h3>Is it free?</h3><p>Yes, for players 13 and up.</p><p><a href="/about">Rules and privacy</a> · <a href="/archive">Past results</a></p>`;
export const privacyHtml =
  '<h2>Privacy</h2><p>A random ID cookie keeps your identity for one year. Claims and strikes remain in the public game record. Use this code to get your claims back on another device or browser; we store only its hash. IP addresses are hashed with a daily rotating salt and cleared after two days. Anonymous share and arrival totals have no player names or IP addresses and are kept as long-term game statistics. Missing-answer submissions contain only the normalized answer, category, date and count and are kept for 90 days. Private feedback is kept for 90 days. Browser sessions expire after 30 days; private backups are retained for 30 days. Nothing is sold or used for ads.</p><p><a href="/#file-settings">Delete my data</a> permanently removes your handle, backup code, streak and feedback. Past claims remain as Withdrawn player, without a link between days. Private backups expire within 30 days. For privacy questions use Send feedback and choose Privacy question. No reply channel is collected. Dibs is for players 13 and up.</p><h2>Sources</h2><p>GeoNames (CC BY), Princeton WordNet, GBIF Backbone Taxonomy (CC BY 4.0), USDA NRCS PLANTS (public plant data), Mammal Diversity Database (CC BY 4.0), IOC World Bird List (CC BY 3.0), Open Food Facts (ODbL), ISO 3166 data (MIT), Wikipedia contributors (CC BY-SA 4.0), Wikidata (CC0), OurAirports (public domain), NASA/JPL small-body data, and Wikipedia pageviews. <a href="/data/licenses.txt">Full licenses and attribution</a>.</p><h2>Golden-ticket commitment</h2><p>The clerk commits to each draw before opening. The closed-day archive publishes the seed and answer IDs for SHA-256 verification.</p>';

export function homeStructuredData(origin: string) {
  const person = { '@type': 'Person', name: 'Ashwathram Prathap' };
  return [
    {
      '@type': 'WebSite',
      name: 'Dibs',
      url: origin,
      description: HOME_DESCRIPTION,
      author: person,
    },
    {
      '@type': 'VideoGame',
      name: 'Dibs',
      description: HOME_DESCRIPTION,
      url: origin,
      genre: 'Word game',
      gamePlatform: 'Web browser',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: 0, priceCurrency: 'USD' },
      publisher: person,
      author: person,
    },
  ];
}
export function archiveDescription(c: { date: string; name: string }) {
  return `Dibs results for ${c.name} on ${c.date}. See which answers were claimed and who claimed them.`;
}
export function sitemap(origin: string, categories: { date: string }[] = [], staging = false) {
  const validDate = (d: unknown): d is string =>
    typeof d === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(d) &&
    Number.isFinite(Date.parse(d)) &&
    new Date(d).toISOString().slice(0, 10) === d;
  const dates = [...new Set(categories.map((c) => c?.date).filter(validDate))].sort();
  const entries = staging
    ? []
    : [
        { loc: '/', lastmod: '2026-11-23' },
        { loc: '/about', lastmod: '2026-11-23' },
        { loc: '/archive', lastmod: dates.at(-1) || '2026-11-23' },
        ...dates.map((date) => ({ loc: '/archive?date=' + date, lastmod: date })),
      ];
  return (
    '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    entries
      .map(
        (e) => `<url><loc>${escapeHtml(origin + e.loc)}</loc><lastmod>${e.lastmod}</lastmod></url>`,
      )
      .join('') +
    '</urlset>'
  );
}
