-- 여러 날에 걸친 일정을 지원하기 위해 event_date를 시작 날짜로 재정의하고 종료 날짜 컬럼을 추가한다.
-- 기존 행은 모두 하루짜리 일정이므로 종료 날짜를 시작 날짜와 같게 채운 뒤 NOT NULL로 승격한다.
ALTER TABLE calendar_events ADD COLUMN end_date DATE;

UPDATE calendar_events SET end_date = event_date WHERE end_date IS NULL;

ALTER TABLE calendar_events ALTER COLUMN end_date SET NOT NULL;

-- 날짜 쌍의 순서만 DB에서 강제한다. 날짜 쌍과 시각 쌍의 정합성은 AT TIME ZONE이 STABLE 함수라
-- CHECK로 표현할 수 없으므로 서버가 start_at·end_at에서 날짜를 파생하는 단일 경로로 보장한다.
ALTER TABLE calendar_events
	ADD CONSTRAINT ck_calendar_event_date_range CHECK (end_date >= event_date);
