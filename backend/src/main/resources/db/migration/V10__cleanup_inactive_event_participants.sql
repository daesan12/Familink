ALTER TABLE calendar_events
	ADD COLUMN participants_specified BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE calendar_events event
SET participants_specified = TRUE
WHERE EXISTS (
	SELECT 1
	FROM event_participants participant
	WHERE participant.event_id = event.id
);

DELETE FROM event_participants participant
USING group_members member, calendar_events event
WHERE participant.group_member_id = member.id
	AND participant.event_id = event.id
	AND member.group_id = event.group_id
	AND member.left_at IS NOT NULL;

CREATE INDEX idx_event_participants_group_member
	ON event_participants (group_member_id);
