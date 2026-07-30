package com.ssafy.s15p11b104.domain.call.report;

import java.util.List;

import com.ssafy.s15p11b104.domain.call.entity.SpeakerType;

public record CallReportInput(List<TranscriptLine> transcripts) {

	public CallReportInput {
		transcripts = List.copyOf(transcripts);
	}

	public record TranscriptLine(int sequenceNumber, SpeakerType speaker, String content) {
	}
}
