-- One row per question asked in an FAQ list's ask box. Times are UTC.
CREATE TABLE IF NOT EXISTS questions (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	asked_at TEXT NOT NULL,
	question_id TEXT,        -- made by the page; also Clarity's ai_faq_question_id tag and the gateway's metadata
	conversation_id TEXT,    -- one per ask box per page view; ties follow-ups together
	turn INTEGER,            -- 1 for the first question in a conversation
	page TEXT NOT NULL,
	question TEXT NOT NULL,
	answered INTEGER NOT NULL,
	answer TEXT NOT NULL,
	sources TEXT NOT NULL,   -- JSON list of the cited page URLs
	first_word_ms INTEGER,
	ms INTEGER NOT NULL,     -- until the answer finished
	clarity_user TEXT,       -- Clarity's visitor ID, once cookies are accepted
	clarity_session TEXT,    -- Clarity's session ID, once cookies are accepted
	ray_id TEXT,             -- Cloudflare's request ID
	country TEXT,
	user_agent TEXT,
	model TEXT
);

CREATE INDEX IF NOT EXISTS questions_asked_at ON questions (asked_at);
CREATE INDEX IF NOT EXISTS questions_question_id ON questions (question_id);
