import { hmac, constantEqual } from './identity';
import { body } from './routes';
import type { Env } from './routes';
import type { ArchivedNote } from '../shared/feedback-archive';

export async function feedbackArchiveRoute(req: Request, env: Env) {
  if (
    !env.ADMIN_TOKEN ||
    !(await constantEqual(req.headers.get('authorization') || '', 'Bearer ' + env.ADMIN_TOKEN))
  )
    return Response.json({ message: 'Not found.' }, { status: 404 });
  if (req.method === 'GET') {
    const rows = (
      await env.DB.prepare(
        'SELECT id,user_id,text,created_at FROM feedback ORDER BY created_at,id',
      ).all<{ id: string; user_id: string; text: string; created_at: string }>()
    ).results;
    const notes: ArchivedNote[] = [];
    for (const row of rows) {
      const privacy = row.text.startsWith('Privacy question: ');
      notes.push({
        id: row.id,
        topic: privacy ? 'privacy' : 'game',
        text: privacy ? row.text.slice(18) : row.text,
        created_at: row.created_at,
        player_hash: await hmac('feedback-export:' + row.user_id, env.COOKIE_SECRET),
      });
    }
    return Response.json({ notes }, { headers: { 'cache-control': 'no-store' } });
  }
  if (req.method === 'POST') {
    const data = await body(req, 2_000_000);
    if (
      Object.keys(data).some((k) => k !== 'ids') ||
      !Array.isArray(data.ids) ||
      data.ids.length > 30000 ||
      data.ids.some((id: unknown) => typeof id !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(id)) ||
      new Set(data.ids).size !== data.ids.length
    )
      return Response.json({ message: 'Provide the exact exported note ids.' }, { status: 422 });
    let removed = 0;
    // Bind every id, never delete notes that arrived after the export snapshot.
    for (let i = 0; i < data.ids.length; i += 100) {
      const ids = data.ids.slice(i, i + 100);
      const r = await env.DB.prepare(
        `DELETE FROM feedback WHERE id IN (${ids.map(() => '?').join(',')})`,
      )
        .bind(...ids)
        .run();
      removed += r.meta.changes;
    }
    return Response.json({ removed });
  }
  return Response.json({ message: 'Method not allowed.' }, { status: 405 });
}
