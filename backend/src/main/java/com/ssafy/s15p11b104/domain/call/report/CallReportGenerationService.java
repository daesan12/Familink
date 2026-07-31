package com.ssafy.s15p11b104.domain.call.report;

import java.util.List;

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

@Service
public class CallReportGenerationService {

	private final CallSessionRepository callSessionRepository;
	private final CallTranscriptRepository callTranscriptRepository;
	private final CallReportCallRepository callReportRepository;
	private final CallReportAnalyzer analyzer;
	private final TransactionTemplate transactionTemplate;

	public CallReportGenerationService(
		CallSessionRepository callSessionRepository,
		CallTranscriptRepository callTranscriptRepository,
		CallReportCallRepository callReportRepository,
		CallReportAnalyzer analyzer,
		TransactionTemplate transactionTemplate
	) {
		this.callSessionRepository = callSessionRepository;
		this.callTranscriptRepository = callTranscriptRepository;
		this.callReportRepository = callReportRepository;
		this.analyzer = analyzer;
		this.transactionTemplate = transactionTemplate;
	}

	public void generate(Long callSessionId) {
		GenerationTarget target = transactionTemplate.execute(status -> loadTarget(callSessionId));
		if (target == null) {
			return;
		}

		CallReportAnalysis analysis = analyzer.analyze(target.input());
		transactionTemplate.executeWithoutResult(status -> saveIfAbsent(target.callSessionId(), analysis));
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

	private void saveIfAbsent(Long callSessionId, CallReportAnalysis analysis) {
		CallSession session = callSessionRepository.findByIdForUpdate(callSessionId).orElse(null);
		if (session == null
			|| session.getStatus() != CallStatus.COMPLETED
			|| callReportRepository.existsByCallSessionId(callSessionId)) {
			return;
		}
		callReportRepository.save(new CallReport(
			session,
			analysis.summary(),
			analysis.emotionCategory(),
			analysis.emotionSubcategory(),
			analysis.guardianMessage()
		));
	}

	private record GenerationTarget(Long callSessionId, CallReportInput input) {
	}
}
