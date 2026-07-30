-- 기존 TIME 값은 KST(Asia/Seoul) 벽시계 입력으로 간주해 event_date와 결합한 뒤 UTC 절대 시각으로 변환한다.
ALTER TABLE calendar_events
	ALTER COLUMN start_at TYPE TIMESTAMPTZ USING (event_date + start_at) AT TIME ZONE 'Asia/Seoul',
	ALTER COLUMN end_at TYPE TIMESTAMPTZ USING (event_date + end_at) AT TIME ZONE 'Asia/Seoul';
