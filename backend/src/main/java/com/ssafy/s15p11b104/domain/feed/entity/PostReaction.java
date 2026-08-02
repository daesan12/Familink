package com.ssafy.s15p11b104.domain.feed.entity;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
import com.ssafy.s15p11b104.global.entity.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "post_reactions")
public class PostReaction extends BaseEntity {

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "post_id", nullable = false)
	private Post post;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "group_member_id", nullable = false)
	private GroupMember groupMember;

	@Enumerated(EnumType.STRING)
	@JdbcTypeCode(SqlTypes.NAMED_ENUM)
	@Column(name = "reaction_type", nullable = false, columnDefinition = "reaction_type")
	private ReactionType reactionType;

	protected PostReaction() {
	}

	public PostReaction(Post post, GroupMember groupMember, ReactionType reactionType) {
		this.post = post;
		this.groupMember = groupMember;
		this.reactionType = reactionType;
	}

	public Post getPost() {
		return post;
	}

	public GroupMember getGroupMember() {
		return groupMember;
	}

	public ReactionType getReactionType() {
		return reactionType;
	}

	public void changeReactionType(ReactionType reactionType) {
		this.reactionType = reactionType;
	}
}
