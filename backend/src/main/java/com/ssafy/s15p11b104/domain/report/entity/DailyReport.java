package com.ssafy.s15p11b104.domain.report.entity;

import java.time.LocalDate;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import com.ssafy.s15p11b104.domain.group.entity.FamilyGroup;
import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
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
@Table(name = "daily_reports")
public class DailyReport extends CreatedAtEntity {

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "group_id", nullable = false)
	private FamilyGroup group;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "care_receiver_member_id", nullable = false)
	private GroupMember careReceiverMember;

	@Column(name = "report_date", nullable = false)
	private LocalDate reportDate;

	@Column(nullable = false, length = 200)
	private String summary;

	@Enumerated(EnumType.STRING)
	@JdbcTypeCode(SqlTypes.NAMED_ENUM)
	@Column(name = "emotion_category", nullable = false, columnDefinition = "emotion_category")
	private EmotionCategory emotionCategory;

	@Column(name = "emotion_subcategory", nullable = false, length = 50)
	private String emotionSubcategory;

	@Column(name = "guardian_message", length = 200)
	private String guardianMessage;

	protected DailyReport() {
	}

	public DailyReport(FamilyGroup group, GroupMember careReceiverMember, LocalDate reportDate,
		String summary, EmotionCategory emotionCategory, String emotionSubcategory) {
		this.group = group;
		this.careReceiverMember = careReceiverMember;
		this.reportDate = reportDate;
		this.summary = summary;
		this.emotionCategory = emotionCategory;
		this.emotionSubcategory = emotionSubcategory;
	}

	public FamilyGroup getGroup() {
		return group;
	}

	public GroupMember getCareReceiverMember() {
		return careReceiverMember;
	}

	public LocalDate getReportDate() {
		return reportDate;
	}

	public String getSummary() {
		return summary;
	}

	public EmotionCategory getEmotionCategory() {
		return emotionCategory;
	}

	public String getEmotionSubcategory() {
		return emotionSubcategory;
	}

	public String getGuardianMessage() {
		return guardianMessage;
	}
}
