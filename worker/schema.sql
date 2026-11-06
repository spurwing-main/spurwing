-- One row per question asked in an FAQ list's ask box.
CREATE TABLE IF NOT EXISTS questions (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	asked_at TEXT NOT NULL,
	page TEXT NOT NULL,
	question TEXT NOT NULL,
	answered INTEGER NOT NULL,
	answer TEXT NOT NULL,
	sources TEXT NOT NULL,
	ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS questions_asked_at ON questions (asked_at);
