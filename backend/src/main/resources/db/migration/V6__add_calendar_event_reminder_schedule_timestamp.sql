ALTER TABLE calendar_events
	ADD COLUMN reminder_schedule_updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE calendar_events
	SET reminder_schedule_updated_at = updated_at;
