package com.ssafy.s15p11b104.domain.feed.service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.s15p11b104.domain.feed.dto.ArchiveDateResponse;
import com.ssafy.s15p11b104.domain.feed.dto.ArchiveItemResponse;
import com.ssafy.s15p11b104.domain.feed.dto.PostArchiveResponse;
import com.ssafy.s15p11b104.domain.feed.dto.PostArchiveType;
import com.ssafy.s15p11b104.domain.feed.dto.PostAuthorResponse;
import com.ssafy.s15p11b104.domain.feed.dto.PostDetailResponse;
import com.ssafy.s15p11b104.domain.feed.dto.PostListItem;
import com.ssafy.s15p11b104.domain.feed.dto.PostListResponse;
import com.ssafy.s15p11b104.domain.feed.dto.PostMediaResponse;
import com.ssafy.s15p11b104.domain.feed.entity.MediaType;
import com.ssafy.s15p11b104.domain.feed.entity.Post;
import com.ssafy.s15p11b104.domain.feed.entity.PostMedia;
import com.ssafy.s15p11b104.domain.feed.entity.PostReaction;
import com.ssafy.s15p11b104.domain.feed.entity.ReactionType;
import com.ssafy.s15p11b104.domain.feed.repository.CommentRepository;
import com.ssafy.s15p11b104.domain.feed.repository.PostMediaRepository;
import com.ssafy.s15p11b104.domain.feed.repository.PostReactionRepository;
import com.ssafy.s15p11b104.domain.feed.repository.PostRepository;
import com.ssafy.s15p11b104.domain.file.service.MediaDownloadUrlProvider;
import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
import com.ssafy.s15p11b104.domain.group.repository.MemberAliasRepository;
import com.ssafy.s15p11b104.domain.group.repository.GroupMemberRepository;
import com.ssafy.s15p11b104.global.exception.BusinessException;
import com.ssafy.s15p11b104.global.exception.ErrorCode;

@Service
public class PostReadService {

	private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Seoul");

	private final GroupMemberRepository groupMemberRepository;
	private final PostRepository postRepository;
	private final PostMediaRepository postMediaRepository;
	private final PostReactionRepository postReactionRepository;
	private final CommentRepository commentRepository;
	private final MemberAliasRepository memberAliasRepository;
	private final MediaDownloadUrlProvider mediaDownloadUrlProvider;

	public PostReadService(
		GroupMemberRepository groupMemberRepository,
		PostRepository postRepository,
		PostMediaRepository postMediaRepository,
		PostReactionRepository postReactionRepository,
		CommentRepository commentRepository,
		MemberAliasRepository memberAliasRepository,
		MediaDownloadUrlProvider mediaDownloadUrlProvider) {
		this.groupMemberRepository = groupMemberRepository;
		this.postRepository = postRepository;
		this.postMediaRepository = postMediaRepository;
		this.postReactionRepository = postReactionRepository;
		this.commentRepository = commentRepository;
		this.memberAliasRepository = memberAliasRepository;
		this.mediaDownloadUrlProvider = mediaDownloadUrlProvider;
	}

	@Transactional(readOnly = true)
	public PostListResponse getPosts(Long groupId, Pageable pageable, Long authenticatedUserId) {
		GroupMember viewer = getActiveMember(groupId, authenticatedUserId);
		Page<Post> page = postRepository.findPageByGroupId(groupId, pageable);
		List<Post> posts = page.getContent();
		Map<Long, List<PostMedia>> mediaByPost = mediaByPost(posts);
		Map<Long, List<PostReaction>> reactionsByPost = reactionsByPost(posts);
		Map<Long, Long> commentCounts = commentCounts(posts);
		Map<Long, String> aliasesByTarget = aliasesByTarget(groupId, viewer, posts);
		return new PostListResponse(
			posts.stream()
				.map(post -> toListItem(post, viewer, mediaByPost, reactionsByPost, commentCounts, aliasesByTarget))
				.toList(),
			page.hasNext());
	}

	@Transactional(readOnly = true)
	public PostDetailResponse getPost(Long postId, Long authenticatedUserId) {
		Post post = getPostOrForbidden(postId);
		GroupMember viewer = getActiveMember(post.getGroup().getId(), authenticatedUserId);
		return toDetailResponse(post, viewer);
	}

	@Transactional(readOnly = true)
	public PostArchiveResponse getArchive(
		Long groupId,
		LocalDate date,
		String type,
		Long authenticatedUserId) {
		getActiveMember(groupId, authenticatedUserId);
		PostArchiveType archiveType = parseType(type);
		List<Post> posts = postRepository.findPageByGroupId(groupId, Pageable.unpaged()).getContent();
		Map<Long, List<PostMedia>> mediaByPost = mediaByPost(posts);
		Map<LocalDate, List<ArchiveItemResponse>> grouped = new LinkedHashMap<>();

		for (Post post : posts) {
			LocalDate postDate = post.getCreatedAt().atZone(BUSINESS_ZONE).toLocalDate();
			if (date != null && !date.equals(postDate)) {
				continue;
			}
			ArchiveItemResponse item = toArchiveItem(
				post, archiveType, mediaByPost.getOrDefault(post.getId(), List.of()));
			if (item == null) {
				continue;
			}
			grouped.computeIfAbsent(postDate, ignored -> new ArrayList<>()).add(item);
		}

		return new PostArchiveResponse(grouped.entrySet().stream()
			.map(entry -> new ArchiveDateResponse(entry.getKey(), entry.getValue()))
			.toList());
	}

	private PostListItem toListItem(
		Post post,
		GroupMember viewer,
		Map<Long, List<PostMedia>> mediaByPost,
		Map<Long, List<PostReaction>> reactionsByPost,
		Map<Long, Long> commentCounts,
		Map<Long, String> aliasesByTarget) {
		List<PostReaction> reactions = reactionsByPost.getOrDefault(post.getId(), List.of());
		return new PostListItem(
			post.getId(),
			authorOf(post, viewer, aliasesByTarget),
			post.getContent(),
			mediaOf(mediaByPost.getOrDefault(post.getId(), List.of())),
			reactionCounts(reactions),
			myReaction(reactions, post.getGroup().getId(), viewer.getUser().getId()),
			commentCounts.getOrDefault(post.getId(), 0L),
			post.getCreatedAt());
	}

	private PostDetailResponse toDetailResponse(Post post, GroupMember viewer) {
		return new PostDetailResponse(
			post.getId(),
			post.getGroup().getId(),
			authorOf(post, viewer),
			post.getContent(),
			mediaOf(post),
			reactionCounts(postReactionRepository.findAllByPostId(post.getId())),
			commentRepository.countByPostId(post.getId()),
			post.getCreatedAt(),
			post.getUpdatedAt());
	}

	private PostAuthorResponse authorOf(Post post, GroupMember viewer) {
		GroupMember author = post.getAuthorMember();
		String displayName = memberAliasRepository
			.findByGroupIdAndOwnerMemberIdAndTargetMemberId(
				post.getGroup().getId(), viewer.getId(), author.getId())
			.map(alias -> alias.getAlias())
			.orElse(author.getUser().getName());
		return PostAuthorResponse.from(author, displayName);
	}

	private PostAuthorResponse authorOf(Post post, GroupMember viewer, Map<Long, String> aliasesByTarget) {
		GroupMember author = post.getAuthorMember();
		String displayName = aliasesByTarget.getOrDefault(author.getId(), author.getUser().getName());
		return PostAuthorResponse.from(author, displayName);
	}

	private ArchiveItemResponse toArchiveItem(
		Post post,
		PostArchiveType requestedType,
		List<PostMedia> media) {
		PostArchiveType actualType = media.isEmpty()
			? PostArchiveType.TEXT
			: media.get(0).getMediaType() == MediaType.IMAGE ? PostArchiveType.IMAGE : PostArchiveType.VIDEO;
		if (requestedType != null && requestedType != actualType) {
			return null;
		}
		PostMedia firstMedia = media.isEmpty() ? null : media.get(0);
		return new ArchiveItemResponse(
			post.getId(),
			actualType,
			firstMedia == null || firstMedia.getThumbnailUrl() == null
				? null
				: mediaDownloadUrlProvider.issueDownloadUrl(firstMedia.getThumbnailUrl()),
			post.getContent());
	}

	private List<PostMediaResponse> mediaOf(Post post) {
		return postMediaRepository.findAllByPostIdOrderByDisplayOrderAsc(post.getId()).stream()
			.map(this::toMediaResponse)
			.toList();
	}

	private List<PostMediaResponse> mediaOf(List<PostMedia> media) {
		return media.stream().map(this::toMediaResponse).toList();
	}

	private PostMediaResponse toMediaResponse(PostMedia media) {
		return new PostMediaResponse(
			media.getId(),
			media.getMediaType(),
			mediaDownloadUrlProvider.issueDownloadUrl(media.getFileUrl()),
			media.getThumbnailUrl() == null
				? null
				: mediaDownloadUrlProvider.issueDownloadUrl(media.getThumbnailUrl()),
			media.getDisplayOrder());
	}

	private Map<Long, List<PostMedia>> mediaByPost(List<Post> posts) {
		if (posts.isEmpty()) {
			return Map.of();
		}
		return postMediaRepository.findAllByPostIdInOrderByPostIdAscDisplayOrderAsc(
				posts.stream().map(Post::getId).toList())
			.stream()
			.collect(Collectors.groupingBy(media -> media.getPost().getId()));
	}

	private Map<Long, List<PostReaction>> reactionsByPost(List<Post> posts) {
		if (posts.isEmpty()) {
			return Map.of();
		}
		return postReactionRepository.findAllWithMemberByPostIdIn(posts.stream().map(Post::getId).toList())
			.stream()
			.collect(Collectors.groupingBy(reaction -> reaction.getPost().getId()));
	}

	private Map<Long, Long> commentCounts(List<Post> posts) {
		if (posts.isEmpty()) {
			return Map.of();
		}
		Map<Long, Long> counts = new HashMap<>();
		commentRepository.countByPostIds(posts.stream().map(Post::getId).toList())
			.forEach(row -> counts.put((Long)row[0], (Long)row[1]));
		return counts;
	}

	private Map<Long, String> aliasesByTarget(Long groupId, GroupMember viewer, List<Post> posts) {
		if (posts.isEmpty()) {
			return Map.of();
		}
		return memberAliasRepository.findAllByGroupIdAndOwnerMemberIdAndTargetMemberIdIn(
				groupId,
				viewer.getId(),
				posts.stream().map(post -> post.getAuthorMember().getId()).distinct().toList())
			.stream()
			.collect(Collectors.toMap(alias -> alias.getTargetMember().getId(), alias -> alias.getAlias()));
	}

	private Map<ReactionType, Long> reactionCounts(List<PostReaction> reactions) {
		Map<ReactionType, Long> counts = new EnumMap<>(ReactionType.class);
		for (ReactionType type : ReactionType.values()) {
			counts.put(type, 0L);
		}
		reactions.forEach(reaction -> counts.merge(reaction.getReactionType(), 1L, Long::sum));
		return counts;
	}

	private ReactionType myReaction(List<PostReaction> reactions, Long groupId, Long authenticatedUserId) {
		return reactions.stream()
			.filter(reaction -> reaction.getGroupMember().getGroup().getId().equals(groupId))
			.filter(reaction -> reaction.getGroupMember().getUser().getId().equals(authenticatedUserId))
			.map(PostReaction::getReactionType)
			.findFirst()
			.orElse(null);
	}

	private GroupMember getActiveMember(Long groupId, Long authenticatedUserId) {
		return groupMemberRepository.findActiveByGroupIdAndUserId(groupId, authenticatedUserId)
			.orElseThrow(() -> new BusinessException(ErrorCode.FORBIDDEN));
	}

	private Post getPostOrForbidden(Long postId) {
		return postRepository.findWithAuthorAndGroupById(postId)
			.orElseThrow(() -> new BusinessException(ErrorCode.FORBIDDEN));
	}

	private PostArchiveType parseType(String type) {
		if (type == null || type.isBlank()) {
			return null;
		}
		try {
			return PostArchiveType.valueOf(type.trim().toUpperCase());
		} catch (IllegalArgumentException exception) {
			throw new BusinessException(ErrorCode.INVALID_REQUEST);
		}
	}
}
