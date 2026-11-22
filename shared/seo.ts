import { edition } from './time';
export const HOME_TITLE = 'Dibs | the daily race to claim answers before anyone else';
export const HOME_DESCRIPTION =
  'One daily category. Three dibs. Five strikes. Think of an answer and claim it before anyone else. Free to play, with a new drop at 9 PM ET.';
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
export const rulesHtml =
  '<h1>Dibs</h1><p>The daily race to claim answers before anyone else.</p><h2>How to play</h2><p>One category opens each day. Type an answer and call dibs. The first player to claim it owns it for the day. You have three dibs and five strikes. Taken answers cost a strike; unknown answers do not. The ten most popular answers belong to the Registry.</p><h2>Frequently asked questions</h2><h3>When does the category drop?</h3><p>Every day at 9 PM Eastern time (Toronto).</p><h3>What’s a golden ticket?</h3><p>A secret randomly selected answer. Claim one to earn a gold stamp. The archive reveals the draw after the day closes.</p><h3>Is it free?</h3><p>Yes. Dibs is free to play, for players 13 and up.</p><p><a href="/about">Office notice and privacy</a> · <a href="/archive">Closed registers</a></p>';
export const privacyHtml =
  '<h2>Privacy</h2><p>A random ID cookie keeps your identity for one year. Claims and strikes remain in the public game record. A hashed file key restores your identity in another browser. IP addresses are hashed with a daily rotating salt and cleared after two days. Anonymous share and arrival counts have no player names or IP addresses. Missing-answer submissions contain only the normalized answer, category, date and count and are kept for 90 days. Browser sessions expire after 30 days; private backups are retained for 30 days. Nothing is sold or used for ads.</p><p>Privacy contact: privacy@dibs.here (mailbox awaiting owner setup).</p><h2>Sources</h2><p>GeoNames (CC BY), Princeton WordNet, IOC World Bird List (CC BY 3.0), Open Food Facts (ODbL), ISO 3166 data (MIT), and Wikipedia pageviews. <a href="/data/licenses.txt">Full licenses and attribution</a>.</p><h2>Golden-ticket commitment</h2><p>The clerk commits to each draw before opening. The closed-day archive publishes the seed and answer IDs for SHA-256 verification.</p>';
