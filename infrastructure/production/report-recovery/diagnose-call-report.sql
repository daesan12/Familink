\set ON_ERROR_STOP on

\if :{?call_session_id}
\else
\echo 'call_session_id is required. Use -v call_session_id=<approved-id>.'
\quit 1
\endif

BEGIN TRANSACTION READ ONLY;

WITH target AS (
	SELECT CAST(:'call_session_id' AS BIGINT) AS call_session_id
), diagnostic AS (
	SELECT
		s.id AS call_session_id,
		s.status AS call_status,
		s.transcript_integrity_status,
		s.transcript_finalized_at,
		s.transcript_revision,
		(SELECT COUNT(*) FROM call_transcripts transcript
			WHERE transcript.call_session_id = s.id) AS transcript_count,
		(SELECT COUNT(*) FROM call_transcripts transcript
			WHERE transcript.call_session_id = s.id
				-- Spring StringUtils.hasText가 비문자로 보는 Character.isWhitespace 집합과 맞춘다.
				AND btrim(
					transcript.content,
					U&'\0009\000A\000B\000C\000D\001C\001D\001E\001F\0020\1680\2000\2001\2002\2003\2004\2005\2006\2008\2009\200A\2028\2029\205F\3000'
				) <> '') AS usable_transcript_count,
		(SELECT COUNT(*) FROM call_transcript_events event
			WHERE event.call_session_id = s.id
				AND event.status <> 'APPLIED') AS unresolved_event_count,
		request.status AS generation_request_status,
		request.input_revision AS generation_input_revision,
		request.last_failure_code AS generation_last_failure_code,
		EXISTS (
			SELECT 1 FROM call_reports report WHERE report.call_session_id = s.id
		) AS report_exists
	FROM target
	JOIN call_sessions s ON s.id = target.call_session_id
	LEFT JOIN call_report_generation_requests request ON request.call_session_id = s.id
)
SELECT
	diagnostic.*,
	(
		call_status = 'COMPLETED'
		AND transcript_integrity_status = 'COMPLETE'
		AND transcript_finalized_at IS NOT NULL
		AND usable_transcript_count > 0
		AND unresolved_event_count = 0
		AND report_exists = FALSE
		AND (
			generation_request_status IS NULL
			OR generation_request_status = 'GEMINI_FAILED'
		)
	) AS repair_eligible
FROM diagnostic;

COMMIT;
