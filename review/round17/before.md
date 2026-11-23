# R17 baseline: exact R16 tag

Same scenario on `r16-done`: load, verify, typo, six accepted guesses (three claims, one taken strike and two reserved strikes), leaderboard, share and return. A separate control player establishes the taken answer before counters reset. D1 values come from result `meta`; DO SQL uses cursor rowsRead/rowsWritten and SQLite-backed KV/alarm operations are counted. Instrumentation adds IO, so its duration is not a billing measurement.

| Action / status | D1 read | D1 written | DO read | DO written | API Worker requests | DO requests |
|---|---:|---:|---:|---:|---:|---:|
| /bootstrap / 200 | 55 | 0 | 3 | 5 | 1 | 1 |
| socket upgrade / 101 | 0 | 0 | 0 | 0 | 1 | 1 |
| /verify-session / 200 | 0 | 0 | 5 | 4 | 0 | 0.05 |
| typo / 422 | 3 | 0 | 5 | 4 | 0 | 0.05 |
| claim / 201 | 98 | 22 | 7 | 8 | 0 | 0.05 |
| strike / 409 | 95 | 2 | 8 | 7 | 0 | 0.05 |
| reserved / 409 | 90 | 3 | 8 | 7 | 0 | 0.05 |
| reserved / 409 | 94 | 2 | 8 | 7 | 0 | 0.05 |
| claim / 201 | 145 | 13 | 8 | 8 | 0 | 0.05 |
| claim / 201 | 174 | 13 | 8 | 9 | 0 | 0.05 |
| /leaderboard / 200 | 0 | 0 | 2 | 3 | 1 | 1 |
| /events/share / 200 | 0 | 0 | 4 | 5 | 0 | 0.05 |
| /bootstrap / 200 | 46 | 0 | 5 | 3 | 1 | 1 |

Total: **55 D1 + 70 DO = 125 durable writes**, 800 D1 reads, 71 DO reads. Four HTTP/API Worker requests (including socket upgrade), nine incoming socket messages, 4.45 billed-equivalent DO requests. Each proxied HTTP request also invokes Pages Functions; conservatively eight account Worker invocations per game.

| DO write cause | Rows |
|---|---:|
| KV | 0 |
| KV put snapshot | 7 |
| KV put handle | 1 |
| KV put session | 14 |
| KV put metric | 12 |
| KV put usage | 12 |
| KV put security | 2 |
| KV put active | 11 |
| KV put cache | 3 |
| KV put scores | 6 |
| KV put summary | 1 |
| KV put platforms | 1 |

The initial daily special/catalog setup costs 74 D1 writes and 38 reads in this run. The DO setup counter (14 writes) also includes the control player's first claim and must not be described as pure daily overhead. Prior rough runs used a different action order; the final matched comparison above supersedes them.

## Every durable write path

| Cause | R16 | R17 normal game |
|---|---|---|
| Identity | users table plus identity/handle/provider uniqueness; recovery_keys plus uniqueness | identity is included in first durable event and its file mirror; signed cookie needs no row |
| Claim | claims row; claim ID/answer/ordinal/request/privacy/user/network indexes; sparse answer row and indexes | one DO events INSERT; eventual latest-file mirror |
| Taken / reserved strike | strikes row and composite/request uniqueness; house_words reveal | one DO events INSERT; eventual latest-file mirror |
| Streak / points | scans and cached score/session rewrites | event payload contains exact points and once-per-day streak date; mirrored together |
| Triggers / network counters | count_success updates rate_limits | in-memory rate checks; no new claims/strikes/attempts rows in legacy tables |
| Sessions / request replay | repeated DO session KV snapshots | signed cookie; request replay stored in the accepted event |
| Attempts / verification | DO security/session KV updates | memory plus signed session token |
| Public snapshot / score cache / active users | DO snapshot, scores, active KV writes | memory, one final D1 board snapshot at close |
| Share / arrival / metrics | DO metric, usage, platform counters | unused per-player share/arrival writes dropped |
| Alarms | DO alarm setup | no new DO alarms; minute cron plus production in-memory timer |
| Administrative / privacy operations | deletion, hiding, voiding, recovery and audit tables | explicit administrative rewrites; excluded from the normal six-guess workload, never silently free |

## Index decisions

New path: `events.seq INTEGER PRIMARY KEY` orders replay without a secondary index; `r17_files PRIMARY KEY(user_id,day) WITHOUT ROWID` supports the latest identity/streak lookup and replaces separate user/day indexes; `r17_players.id WITHOUT ROWID` is retained for explicit rerolls/administrative identity overrides; `r17_boards.category_id WITHOUT ROWID` stores final boards. No new secondary indexes or triggers.

Legacy indexes are retained for rollback and old records; normal R17 game traffic does not write to them. Identity/handle/provider and recovery uniqueness preserve existing accounts; answer ID/category/key indexes preserve legacy lookup and golden proof; claims ID/answer/ordinal uniqueness, user/date, request replay, privacy cleanup and IP window indexes preserve old API/admin behavior; strike/request uniqueness preserves old replay; attempt and share-day indexes preserve the legacy fallback; schedule status/date, slug/date, schedule log and feedback-created indexes support unchanged administration. Removing these would compromise the retained R16 fallback without reducing R17 per-game writes. Legacy triggers remain installed but are never fired by new journal claims.
