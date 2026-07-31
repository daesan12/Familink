package com.ssafy.s15p11b104.domain.call.report;

import java.time.Clock;
import java.util.List;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.util.StringUtils;

import com.ssafy.s15p11b104.domain.call.entity.CallReport;
import com.ssafy.s15p11b104.domain.call.entity.CallSession;
import com.ssafy.s15p11b104.domain.call.entity.CallStatus;
import com.ssafy.s15p11b104.domain.call.report.CallReportInput.TranscriptLine;
import com.ssafy.s15p11b104.domain.call.repository.CallReportCallRepository;
import com.ssafy.s15p11b104.domain.call.repository.CallSessionRepository;
import com.ssafy.s15p11b104.domain.call.repository.CallTranscriptRepository;
import com.ssafy.s15p11b104.domain.notification.event.DomainNotificationEvent;
import com.ssafy.s15p11b104.domain.report.service.DailyReportGenerationDispatcher;
import com.ssafy.s15p11b104.domain.report.service.DailyReportWindow;

@Service
public class CallReportGenerationService {

	private final CallSessionRepository callSessionRepository;
	private final CallTranscriptRepository callTranscriptRepository;
	private final CallReportCallRepository callReportRepository;
	private final CallReportAnalyzer analyzer;
	private final DailyReportGenerationDispatcher dailyReportGenerationDispatcher;
	private final Clock applicationClock;
	private final TransactionTemplate transactionTemplate;
	private final ApplicationEventPublisher eventPublisher;

	public CallReportGenerationService(
		CallSessionRepository callSessionRepository,
		CallTranscriptRepository callTranscriptRepository,
		CallReportCallRepository callReportRepository,
		CallReportAnalyzer analyzer,
		DailyReportGenerationDispatcher dailyReportGenerationDispatcher,
		Clock applicationClock,
		TransactionTemplate transactionTemplate,
		ApplicationEventPublisher eventPublisher
	) {
		this.callSessionRepository = callSessionRepository;
		this.callTranscriptRepository = callTranscriptRepository;
		this.callReportRepository = callReportRepository;
		this.analyzer = analyzer;
		this.dailyReportGenerationDispatcher = dailyReportGenerationDispatcher;
		this.applicationClock = applicationClock;
		this.transactionTemplate = transactionTemplate;
		this.eventPublisher = eventPublisher;
	}

	public void generate(Long callSessionId) {
		GenerationTarget target = transactionTemplate.execute(status -> loadTarget(callSessionId));
		if (target == null) {
			return;
		}

		CallReportAnalysis analysis = analyzer.analyze(target.input());
		CallSession savedSession = transactionTemplate.execute(status -> saveIfAbsent(target.callSessionId(), analysis));
		if (savedSession != null && savedSession.getEndedAt() != null) {
			var reportDate = DailyReportWindow.reportDateForEndedAt(savedSession.getEndedAt());
			var reportWindow = DailyReportWindow.forReportDate(reportDate);
			if (!applicationClock.instant().isBefore(reportWindow.endExclusive())) {
				dailyReportGenerationDispatcher.dispatch(reportDate);
			}
		}
	}

	private GenerationTarget loadTarget(Long callSessionId) {
		CallSession session = callSessionRepository.findById(callSessionId).orElse(null);
		if (session == null
			|| session.getStatus() != CallStatus.COMPLETED
			|| callReportRepository.existsByCallSessionId(callSessionId)) {
			return null;
		}

		List<TranscriptLine> transcripts = callTranscriptRepository
			.findAllByCallSessionIdOrderBySequenceNumberAsc(callSessionId)
			.stream()
			.filter(transcript -> StringUtils.hasText(transcript.getContent()))
			.map(transcript -> new TranscriptLine(
				transcript.getSequenceNumber(),
				transcript.getSpeaker(),
				transcript.getContent()
			))
			.toList();
		if (transcripts.isEmpty()) {
			return null;
		}
		return new GenerationTarget(callSessionId, new CallReportInput(transcripts));
	}

	private CallSession saveIfAbsent(Long callSessionId, CallReportAnalysis analysis) {
		CallSession session = callSessionRepository.findByIdForUpdate(callSessionId).orElse(null);
		if (session == null
			|| session.getStatus() != CallStatus.COMPLETED
			|| callReportRepository.existsByCallSessionId(callSessionId)) {
			return null;
		}
		CallReport report = new CallReport(
			session,
			analysis.summary(),
			analysis.emotionCategory(),
			analysis.emotionSubcategory(),
			analysis.guardianMessage());
		callReportRepository.save(report);
		eventPublisher.publishEvent(new DomainNotificationEvent.CallReportCreated(report.getId()));
		return session;
	}

	private record GenerationTarget(Long callSessionId, CallReportInput input) {
	}
}
