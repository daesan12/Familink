package com.ssafy.s15p11b104.domain.feed.service;

import java.net.URI;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.s15p11b104.domain.feed.dto.PostCreateRequest;
import com.ssafy.s15p11b104.domain.feed.dto.PostCreateResponse;
import com.ssafy.s15p11b104.domain.feed.dto.PostCreatedItem;
import com.ssafy.s15p11b104.domain.feed.dto.PostMediaRequest;
import com.ssafy.s15p11b104.domain.feed.dto.PostUpdateRequest;
import com.ssafy.s15p11b104.domain.feed.dto.PostUpdateResponse;
import com.ssafy.s15p11b104.domain.feed.entity.MediaType;
import com.ssafy.s15p11b104.domain.feed.entity.Post;
import com.ssafy.s15p11b104.domain.feed.entity.PostMedia;
import com.ssafy.s15p11b104.domain.feed.repository.PostAnalysisRepository;
import com.ssafy.s15p11b104.domain.feed.repository.PostMediaRepository;
import com.ssafy.s15p11b104.domain.feed.repository.PostRepository;
import com.ssafy.s15p11b104.domain.carnation.service.CarnationService;
import com.ssafy.s15p11b104.domain.file.config.S3Properties;
import com.ssafy.s15p11b104.domain.file.service.S3MediaValidator;
import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
import com.ssafy.s15p11b104.domain.group.repository.GroupMemberRepository;
import com.ssafy.s15p11b104.global.exception.BusinessException;
import com.ssafy.s15p11b104.global.exception.ErrorCode;

@Service
public class PostService {

	private final GroupMemberRepository groupMemberRepository;
	private final PostRepository postRepository;
	private final PostMediaRepository postMediaRepository;
	private final PostAnalysisRepository postAnalysisRepository;
	private final S3Properties s3Properties;
	private final S3MediaValidator s3MediaValidator;
	private final CarnationService carnationService;

	public PostService(
		GroupMemberRepository groupMemberRepository,
		PostRepository postRepository,
		PostMediaRepository postMediaRepository,
		PostAnalysisRepository postAnalysisRepository,
		S3Properties s3Properties,
		S3MediaValidator s3MediaValidator,
		CarnationService carnationService) {
		this.groupMemberRepository = groupMemberRepository;
		this.postRepository = postRepository;
		this.postMediaRepository = postMediaRepository;
		this.postAnalysisRepository = postAnalysisRepository;
		this.s3Properties = s3Properties;
		this.s3MediaValidator = s3MediaValidator;
		this.carnationService = carnationService;
	}

	@Transactional
	public PostCreateResponse create(PostCreateRequest request, Long authenticatedUserId) {
		if (request.groupIds().size() != request.groupIds().stream().distinct().count()) {
			throw new BusinessException(ErrorCode.INVALID_REQUEST);
		}
		request.groupIds().forEach(groupId -> getActiveMember(groupId, authenticatedUserId));
		validateMedia(request.mediaType(), request.media());

		List<PostCreatedItem> createdPosts = request.groupIds().stream()
			.map(groupId -> createForGroup(groupId, authenticatedUserId, request))
			.toList();

		return new PostCreateResponse(createdPosts, createdPosts.isEmpty()
			? null
			: postRepository.findById(createdPosts.get(0).postId()).orElseThrow().getCreatedAt());
	}

	@Transactional
	public PostUpdateResponse update(Long postId, PostUpdateRequest request, Long authenticatedUserId) {
		Post post = getPost(postId);
		assertAuthor(post, authenticatedUserId);
		validateMedia(request.mediaType(), request.media());

		post.updateContent(request.content());
		postAnalysisRepository.findByPostId(postId).ifPresent(analysis -> analysis.resetToPending());
		replaceMedia(post, request.mediaType(), request.media());
		postRepository.flush();
		return new PostUpdateResponse(post.getId(), post.getUpdatedAt());
	}

	@Transactional
	public void delete(Long postId, Long authenticatedUserId) {
		Post post = getPost(postId);
		assertAuthor(post, authenticatedUserId);
		removeMedia(post);
		postRepository.delete(post);
	}

	private PostCreatedItem createForGroup(Long groupId, Long authenticatedUserId, PostCreateRequest request) {
		GroupMember author = getActiveMember(groupId, authenticatedUserId);
		Post post = postRepository.save(new Post(author.getGroup(), author, request.content()));
		replaceMedia(post, request.mediaType(), request.media());
		carnationService.earnForPost(author);
		return new PostCreatedItem(post.getId(), groupId);
	}

	private Post getPost(Long postId) {
		return postRepository.findWithAuthorAndGroupById(postId)
			.orElseThrow(() -> new BusinessException(ErrorCode.FORBIDDEN));
	}

	private void assertAuthor(Post post, Long authenticatedUserId) {
		if (!post.getAuthorMember().getUser().getId().equals(authenticatedUserId)
			|| groupMemberRepository.findActiveByGroupIdAndUserId(
				post.getGroup().getId(), authenticatedUserId)
				.map(GroupMember::getId)
				.filter(post.getAuthorMember().getId()::equals)
				.isEmpty()) {
			throw new BusinessException(ErrorCode.FORBIDDEN);
		}
	}

	private GroupMember getActiveMember(Long groupId, Long authenticatedUserId) {
		return groupMemberRepository.findActiveByGroupIdAndUserId(groupId, authenticatedUserId)
			.orElseThrow(() -> new BusinessException(ErrorCode.FORBIDDEN));
	}

	private void replaceMedia(Post post, MediaType mediaType, List<PostMediaRequest> media) {
		removeMedia(post);
		if (media == null || media.isEmpty()) {
			return;
		}
		postMediaRepository.flush();
		postMediaRepository.saveAll(media.stream()
			.map(item -> new PostMedia(
				post,
				mediaType,
				item.fileUrl(),
				item.displayOrder(),
				item.thumbnailUrl()))
			.toList());
	}

	private void removeMedia(Post post) {
		postMediaRepository.deleteAll(postMediaRepository.findAllByPostId(post.getId()));
	}

	private void validateMedia(MediaType mediaType, List<PostMediaRequest> media) {
		int count = media == null ? 0 : media.size();
		if (count == 0) {
			if (mediaType != null) {
				throw new BusinessException(ErrorCode.INVALID_REQUEST);
			}
			return;
		}
		if (mediaType == null || (mediaType == MediaType.IMAGE && (count < 1 || count > 4))
			|| (mediaType == MediaType.VIDEO && count != 1)) {
			throw new BusinessException(ErrorCode.INVALID_REQUEST);
		}

		Set<Integer> displayOrders = new HashSet<>();
		for (PostMediaRequest item : media) {
			if (!displayOrders.add(item.displayOrder())) {
				throw new BusinessException(ErrorCode.INVALID_REQUEST);
			}
			validateMediaUrl(item.fileUrl());
			s3MediaValidator.validate(mediaType, item.fileUrl());
			if (item.thumbnailUrl() != null) {
				validateMediaUrl(item.thumbnailUrl());
				s3MediaValidator.validate(MediaType.IMAGE, item.thumbnailUrl());
			}
		}
	}

	private void validateMediaUrl(String value) {
		try {
			URI uri = URI.create(value);
			if (!s3Properties.isAllowedUri(uri)) {
				throw new BusinessException(ErrorCode.INVALID_REQUEST);
			}
		} catch (IllegalArgumentException exception) {
			throw new BusinessException(ErrorCode.INVALID_REQUEST);
		}
	}
}
