import { pingIndexNow } from '../shared/indexnow';
import { PUBLIC_ORIGIN } from '../shared/config';
// A notification failure must never turn a successful deployment into a failure.
const paths = ['/', '/archive'];
try {
  const response = await fetch(PUBLIC_ORIGIN + '/api/archive', {
    signal: AbortSignal.timeout(8000),
  });
  if (response.ok) {
    const data: any = await response.json();
    for (const category of data.categories || [])
      if (/^\d{4}-\d{2}-\d{2}$/.test(category.date)) paths.push('/archive?date=' + category.date);
  }
} catch {
  /* Home and archive can still be announced. */
}
console.log(JSON.stringify({ at: new Date().toISOString(), ...(await pingIndexNow(paths)) }));
