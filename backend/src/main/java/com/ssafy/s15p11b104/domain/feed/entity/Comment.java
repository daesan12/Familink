package com.ssafy.s15p11b104.domain.feed.entity;

import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
import com.ssafy.s15p11b104.global.entity.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "comments")
public class Comment extends BaseEntity {

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "post_id", nullable = false)
	private Post post;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "author_member_id", nullable = false)
	private GroupMember authorMember;

	@Column(nullable = false, length = 50)
	private String content;

	protected Comment() {
	}

	public Comment(Post post, GroupMember authorMember, String content) {
		this.post = post;
		this.authorMember = authorMember;
		this.content = content;
	}

	public Post getPost() {
		return post;
	}

	public GroupMember getAuthorMember() {
		return authorMember;
	}

	public String getContent() {
		return content;
	}

	public void updateContent(String content) {
		this.content = content;
	}
}
