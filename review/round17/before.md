# R17 baseline (R16 code)

Measured locally with D1 result metadata and SQLite-backed DO KV/alarm operations. Daily setup is reported separately. These are observed storage operations, not a claim of deployed billing/duration.

| Action | D1 read | D1 written | DO read | DO written |
|---|---:|---:|---:|---:|
| /bootstrap (200) | 0 | 0 | 3 | 4 |
| /verify-session (200) | 0 | 0 | 5 | 4 |
| /claim (201) | 96 | 22 | 7 | 8 |
| /claim (409) | 82 | 3 | 8 | 7 |
| /claim (409) | 86 | 2 | 8 | 7 |
| /claim (409) | 90 | 2 | 8 | 7 |
| /claim (201) | 141 | 13 | 8 | 8 |
| /claim (201) | 170 | 13 | 8 | 9 |
| /claim (403) | 46 | 0 | 5 | 4 |
| /leaderboard (200) | 0 | 0 | 2 | 3 |
| /events/share (200) | 0 | 0 | 4 | 5 |
| /bootstrap (200) | 44 | 0 | 5 | 3 |

Total: **55 D1 writes, 69 DO writes; 755 D1 reads**. 4 Worker HTTP requests; 9 incoming socket messages; 4.45 billed-equivalent DO requests.

| DO cause | Writes |
|---|---:|
| KV | 0 |
| KV put snapshot | 7 |
| KV put handle | 2 |
| KV put session | 15 |
| alarm | 1 |
| KV put scores | 7 |
| KV put metric | 13 |
| KV put usage | 13 |
| KV put security | 2 |
| KV put active | 11 |
| KV put cache | 3 |
| KV put summary | 1 |
| KV put platforms | 1 |

D1 causes: materializing static answers (table + ID and category indexes); claim insertion (table + unique answer, claim ID, ordinal, request, privacy, user and network indexes); count_success trigger (network rate row); strike insertion (table + composite/request indexes); first user (table + ID, handle, provider indexes); first recovery key (table + primary index); reserved reveal update. Catalog/special seeding is daily overhead, not charged per player. Attempts are already skipped on the DO path but session attempts, score shards, snapshot, certificate cache, summary ref and metric/usage/active updates still write to DO on each event.

All legacy indexes remain required until the new path passes compatibility checks. R17's proposed additive tables have only clustered primary keys: player ID for identity lookup; (category ID, user ID) for batched snapshots. No secondary indexes or triggers. The SQLite event log uses an INTEGER PRIMARY KEY, with ownership and idempotency maps reconstructed from durable events.

The baseline includes one post-completion invalid-guess request; it is rejected as a closed file. A pre-completion typo and taken-answer case will be measured separately in the final harness.
