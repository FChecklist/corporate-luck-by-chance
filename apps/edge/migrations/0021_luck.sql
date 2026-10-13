-- Corporate Luck by Chance: sealed seed, frozen seat list (nicknames), phones' result votes. Safe to repeat. test/migrations.test.ts keeps this identical to LUCK_SCHEMA.
CREATE TABLE IF NOT EXISTS luck_t (eid TEXT PRIMARY KEY, commit_hash TEXT NOT NULL, secret TEXT, state TEXT NOT NULL DEFAULT 'open', opts TEXT, seed TEXT, players INTEGER, start_ms INTEGER, end_ms INTEGER, result TEXT, ended_ms INTEGER);
CREATE TABLE IF NOT EXISTS luck_p (eid TEXT NOT NULL, pid TEXT NOT NULL, seat INTEGER NOT NULL, name TEXT NOT NULL, PRIMARY KEY (eid, pid));
CREATE INDEX IF NOT EXISTS luck_p_seat ON luck_p (eid, seat);
CREATE TABLE IF NOT EXISTS luck_v (eid TEXT NOT NULL, pid TEXT NOT NULL, digest TEXT NOT NULL, payload TEXT NOT NULL, at_ms INTEGER NOT NULL, PRIMARY KEY (eid, pid));
