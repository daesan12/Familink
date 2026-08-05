\set ON_ERROR_STOP on

\if :{?call_session_id}
\else
\echo 'call_session_id is required. Use -v call_session_id=<approved-id>.'
\quit 1
\endif

BEGIN;

\unset eligible_call_session_id
\unset eligible_transcript_revision
\unset requeued_call_session_id

SELECT
	s.id AS eligible_call_session_id,
	s.transcript_revision AS eligible_transcript_revision
FROM call_sessions s
LEFT JOIN call_report_generation_requests request ON request.call_session_id = s.id
WHERE s.id = CAST(:'call_session_id' AS BIGINT)
	AND s.status = 'COMPLETED'
	AND s.transcript_integrity_status = 'COMPLETE'
	AND s.transcript_finalized_at IS NOT NULL
	AND EXISTS (
		SELECT 1
		FROM call_transcripts transcript
		WHERE transcript.call_session_id = s.id
			-- Spring StringUtils.hasText가 비문자로 보는 Character.isWhitespace 집합과 맞춘다.
			AND btrim(
				transcript.content,
				U&'\0009\000A\000B\000C\000D\001C\001D\001E\001F\0020\1680\2000\2001\2002\2003\2004\2005\2006\2008\2009\200A\2028\2029\205F\3000'
			) <> ''
	)
	AND NOT EXISTS (
		SELECT 1
		FROM call_transcript_events event
		WHERE event.call_session_id = s.id
			AND event.status <> 'APPLIED'
	)
	AND NOT EXISTS (
		SELECT 1
		FROM call_reports report
		WHERE report.call_session_id = s.id
	)
	AND (request.call_session_id IS NULL OR request.status = 'GEMINI_FAILED')
FOR UPDATE OF s
\gset

\if :{?eligible_call_session_id}
INSERT INTO call_report_generation_requests (
	call_session_id,
	status,
	input_revision,
	claim_token,
	claim_expires_at,
	last_failure_code,
	last_failed_at,
	created_at,
	updated_at
)
VALUES (
	:eligible_call_session_id,
	'PENDING',
	:eligible_transcript_revision,
	NULL,
	NULL,
	NULL,
	NULL,
	CURRENT_TIMESTAMP,
	CURRENT_TIMESTAMP
)
ON CONFLICT (call_session_id) DO UPDATE
SET status = 'PENDING',
	input_revision = EXCLUDED.input_revision,
	claim_token = NULL,
	claim_expires_at = NULL,
	last_failure_code = NULL,
	last_failed_at = NULL,
	updated_at = CURRENT_TIMESTAMP
WHERE call_report_generation_requests.status = 'GEMINI_FAILED'
RETURNING call_session_id AS call_session_id
\gset requeued_

\if :{?requeued_call_session_id}
SELECT call_session_id, status, input_revision, updated_at
FROM call_report_generation_requests
WHERE call_session_id = :requeued_call_session_id;
COMMIT;
\else
\echo 'The request changed concurrently and was not requeued.'
ROLLBACK;
\quit 1
\endif
\else
\echo 'The session is missing, not approved for repair by its current data, or already has a non-failed request.'
ROLLBACK;
\quit 1
\endif
