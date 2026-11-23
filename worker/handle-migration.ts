import { cleanHandle, cleanStoredHandles, playerNumber } from '../shared/handles';
import type { Env } from './routes';
/** Idempotent, bounded maintenance. Only accidental handle suffixes change. */
export async function cleanHandleBatch(env: Env, table: string, after = '', limit = 100) {
  if (!['users', 'r17_players', 'r17_files'].includes(table)) throw Error('Unknown handle table');
  const rows = await env.DB.prepare(
    table === 'r17_files'
      ? "SELECT user_id || ':' || day id,user_id,day,data FROM r17_files WHERE user_id || ':' || day > ? ORDER BY id LIMIT ?"
      : `SELECT id,${table === 'users' ? 'handle' : 'data'} FROM ${table} WHERE id>? ORDER BY id LIMIT ?`,
  )
    .bind(after, limit)
    .all<any>();
  let changed = 0;
  for (const row of rows.results) {
    if (table === 'users') {
      let name = cleanHandle(row.handle);
      if (name !== row.handle) {
        // The legacy table has a unique-name constraint. A real collision gets a short decimal.
        const base = name;
        for (let collision = 0; collision < 990; collision++) {
          const other = await env.DB.prepare('SELECT id FROM users WHERE handle=? AND id<>?')
            .bind(name, row.id)
            .first();
          if (!other) break;
          name = `${base} #${10 + ((playerNumber(row.id) - 10 + collision) % 990)}`;
        }
        await env.DB.prepare('UPDATE users SET handle=? WHERE id=? AND handle=?')
          .bind(name, row.id, row.handle)
          .run();
        changed++;
      }
    } else {
      const value = JSON.stringify(cleanStoredHandles(JSON.parse(row.data)));
      if (value !== row.data) {
        await (
          table === 'r17_files'
            ? env.DB.prepare(
                'UPDATE r17_files SET data=? WHERE user_id=? AND day=? AND data=?',
              ).bind(value, row.user_id, row.day, row.data)
            : env.DB.prepare('UPDATE r17_players SET data=? WHERE id=? AND data=?').bind(
                value,
                row.id,
                row.data,
              )
        ).run();
        changed++;
      }
    }
  }
  return {
    table,
    read: rows.results.length,
    changed,
    after: rows.results.at(-1)?.id || after,
    done: rows.results.length < limit,
  };
}
