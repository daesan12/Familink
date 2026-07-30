package com.ssafy.s15p11b104.domain.report.service;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import com.ssafy.s15p11b104.domain.call.entity.CallReport;
import com.ssafy.s15p11b104.domain.call.entity.CallStatus;
import com.ssafy.s15p11b104.domain.call.repository.CallReportCallRepository;
import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
import com.ssafy.s15p11b104.domain.group.repository.GroupMemberRepository;
import com.ssafy.s15p11b104.domain.report.entity.DailyReport;
import com.ssafy.s15p11b104.domain.report.repository.DailyReportRepository;

@Service
public class DailyReportGenerationService {

	private static final Logger LOGGER = LoggerFactory.getLogger(DailyReportGenerationService.class);

	private final CallReportCallRepository callReportRepository;
	private final DailyReportRepository dailyReportRepository;
	private final GroupMemberRepository groupMemberRepository;
	private final DailyReportAnalyzer analyzer;
	private final TransactionTemplate transactionTemplate;

	public DailyReportGenerationService(
		CallReportCallRepository callReportRepository,
		DailyReportRepository dailyReportRepository,
		GroupMemberRepository groupMemberRepository,
		DailyReportAnalyzer analyzer,
		TransactionTemplate transactionTemplate
	) {
		this.callReportRepository = callReportRepository;
		this.dailyReportRepository = dailyReportRepository;
		this.groupMemberRepository = groupMemberRepository;
		this.analyzer = analyzer;
		this.transactionTemplate = transactionTemplate;
	}

	public void generate(LocalDate reportDate) {
		Objects.requireNonNull(reportDate, "reportDate must not be null");
		DailyReportWindow window = DailyReportWindow.forReportDate(reportDate);
		Map<Long, List<CallReport>> reportsByMember = callReportRepository
			.findCompletedInEndedAtRange(CallStatus.COMPLETED, window.startInclusive(), window.endExclusive())
			.stream()
			.collect(Collectors.groupingBy(
				report -> report.getCallSession().getCareReceiverMember().getId(),
				LinkedHashMap::new,
				Collectors.toList()
			));

		for (Map.Entry<Long, List<CallReport>> entry : reportsByMember.entrySet()) {
			generateForMember(reportDate, entry.getKey(), entry.getValue());
		}
	}

	private void generateForMember(LocalDate reportDate, Long careReceiverMemberId, List<CallReport> callReports) {
		try {
			if (dailyReportRepository.existsByCareReceiverMemberIdAndReportDate(careReceiverMemberId, reportDate)) {
				return;
			}

			DailyReportAnalysis analysis = analyzer.analyze(toInput(callReports));
			saveIfAbsent(reportDate, careReceiverMemberId, analysis);
		} catch (RuntimeException exception) {
			LOGGER.error(
				"일일 리포트 생성에 실패했습니다. reportDate={}, careReceiverMemberId={}, errorType={}",
				reportDate,
				careReceiverMemberId,
				exception.getClass().getSimpleName()
			);
		}
	}

	private DailyReportInput toInput(List<CallReport> callReports) {
		return new DailyReportInput(callReports.stream()
			.map(callReport -> new DailyReportInput.CallReportContext(
				callReport.getSummary(),
				callReport.getGuardianMessage()
			))
			.toList());
	}

	private void saveIfAbsent(LocalDate reportDate, Long careReceiverMemberId, DailyReportAnalysis analysis) {
		transactionTemplate.executeWithoutResult(status -> {
			GroupMember careReceiverMember = groupMemberRepository
				.findByIdForUpdate(careReceiverMemberId)
				.orElse(null);
			if (careReceiverMember == null
				|| dailyReportRepository.existsByCareReceiverMemberIdAndReportDate(careReceiverMemberId, reportDate)) {
				return;
			}

			dailyReportRepository.save(new DailyReport(
				careReceiverMember.getGroup(),
				careReceiverMember,
				reportDate,
				analysis.summary(),
				analysis.emotionCategory(),
				analysis.emotionSubcategory(),
				analysis.guardianMessage()
			));
		});
	}
}
