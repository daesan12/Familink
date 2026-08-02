ALTER TABLE notifications
	ADD COLUMN source_event_key VARCHAR(160);

CREATE UNIQUE INDEX uq_notifications_receiver_source_event
	ON notifications (receiver_user_id, source_event_key)
	WHERE source_event_key IS NOT NULL;
