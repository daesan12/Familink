package com.ssafy.s15p11b104.domain.feed.entity;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import com.ssafy.s15p11b104.global.entity.IdentityEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "post_media")
public class PostMedia extends IdentityEntity {

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "post_id", nullable = false)
	private Post post;

	@Enumerated(EnumType.STRING)
	@JdbcTypeCode(SqlTypes.NAMED_ENUM)
	@Column(name = "media_type", nullable = false, columnDefinition = "media_type")
	private MediaType mediaType;

	@Column(name = "file_url", nullable = false, length = 500)
	private String fileUrl;

	@Column(name = "display_order", nullable = false)
	private int displayOrder;

	@Column(name = "thumbnail_url", length = 500)
	private String thumbnailUrl;

	protected PostMedia() {
	}

	public PostMedia(Post post, MediaType mediaType, String fileUrl, int displayOrder, String thumbnailUrl) {
		this.post = post;
		this.mediaType = mediaType;
		this.fileUrl = fileUrl;
		this.displayOrder = displayOrder;
		this.thumbnailUrl = thumbnailUrl;
	}

	public Post getPost() {
		return post;
	}

	public MediaType getMediaType() {
		return mediaType;
	}

	public String getFileUrl() {
		return fileUrl;
	}

	public int getDisplayOrder() {
		return displayOrder;
	}

	public String getThumbnailUrl() {
		return thumbnailUrl;
	}
}
