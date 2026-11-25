-- "Yes, notify me when this game begins" (push-notify.ts, corporate-push): one flag on a game's row so the message "the game has begun" goes out once per game, even if two starts race.
-- It is set only when the push service's address and admin key are both configured on the site; NULL means nothing was handed to the push service for this game. Applied by wrangler once (like the other ALTER migrations); not applied anywhere by this change.
-- test/migrations.test.ts keeps this identical to PUSH_SCHEMA.
ALTER TABLE luck_t ADD COLUMN push_sent_ms INTEGER;
