CREATE TYPE reminder_slot AS ENUM ('DAY_BEFORE', 'HOUR_BEFORE');

ALTER TABLE notifications
	ADD COLUMN reminder_slot reminder_slot,
	ADD CONSTRAINT ck_notifications_reminder_slot_type
		CHECK (type = 'EVENT_REMINDER' OR reminder_slot IS NULL);

DROP INDEX uq_event_reminder_notification;

CREATE UNIQUE INDEX uq_event_reminder_notification
	ON notifications (receiver_user_id, related_event_id, type, reminder_slot)
	NULLS NOT DISTINCT
	WHERE type = 'EVENT_REMINDER' AND related_event_id IS NOT NULL;
