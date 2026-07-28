package com.ssafy.s15p11b104.domain.call.entity;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import com.ssafy.s15p11b104.global.entity.CreatedAtEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "call_transcripts")
public class CallTranscript extends CreatedAtEntity {

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "call_session_id", nullable = false)
	private CallSession callSession;

	@Enumerated(EnumType.STRING)
	@JdbcTypeCode(SqlTypes.NAMED_ENUM)
	@Column(nullable = false, columnDefinition = "speaker_type")
	private SpeakerType speaker;

	@Column(nullable = false, columnDefinition = "TEXT")
	private String content;

	@Column(name = "sequence", nullable = false)
	private int sequenceNumber;

	@Column(name = "openai_item_id", length = 100)
	private String openaiItemId;

	protected CallTranscript() {
	}

	public CallTranscript(CallSession callSession, SpeakerType speaker, String content, int sequenceNumber) {
		this.callSession = callSession;
		this.speaker = speaker;
		this.content = content;
		this.sequenceNumber = sequenceNumber;
	}

	public CallSession getCallSession() {
		return callSession;
	}

	public SpeakerType getSpeaker() {
		return speaker;
	}

	public String getContent() {
		return content;
	}

	public int getSequenceNumber() {
		return sequenceNumber;
	}

	public String getOpenaiItemId() {
		return openaiItemId;
	}
}
