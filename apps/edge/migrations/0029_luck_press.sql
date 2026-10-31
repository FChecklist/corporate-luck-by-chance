-- The press record of a new-flow Luck game: who pressed in which round, and when. Only a seat number is read back, never shown with a name. Apply BEFORE deploying the code that writes it.
CREATE TABLE IF NOT EXISTS luck_press (eid TEXT NOT NULL, pid TEXT NOT NULL, g INTEGER NOT NULL, at_ms INTEGER NOT NULL, PRIMARY KEY (eid, pid, g));
