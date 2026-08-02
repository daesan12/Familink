ALTER TABLE call_sessions
	ADD COLUMN lease_expires_at TIMESTAMPTZ;

UPDATE call_sessions
	SET lease_expires_at = CURRENT_TIMESTAMP + INTERVAL '90 seconds'
	WHERE status IN ('CONNECTING', 'IN_PROGRESS');

CREATE INDEX idx_call_sessions_active_lease
	ON call_sessions (lease_expires_at)
	WHERE status IN ('CONNECTING', 'IN_PROGRESS');
