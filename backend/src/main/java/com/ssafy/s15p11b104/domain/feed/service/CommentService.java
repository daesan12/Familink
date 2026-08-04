package com.ssafy.s15p11b104.domain.feed.service;

import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.s15p11b104.domain.feed.dto.CommentCreateRequest;
import com.ssafy.s15p11b104.domain.feed.dto.CommentCreateResponse;
import com.ssafy.s15p11b104.domain.feed.dto.CommentListResponse;
import com.ssafy.s15p11b104.domain.feed.dto.CommentResponse;
import com.ssafy.s15p11b104.domain.feed.dto.CommentUpdateRequest;
import com.ssafy.s15p11b104.domain.feed.dto.CommentUpdateResponse;
import com.ssafy.s15p11b104.domain.feed.dto.PostAuthorResponse;
import com.ssafy.s15p11b104.domain.feed.entity.Comment;
import com.ssafy.s15p11b104.domain.feed.entity.Post;
import com.ssafy.s15p11b104.domain.feed.repository.CommentRepository;
import com.ssafy.s15p11b104.domain.feed.repository.PostRepository;
import com.ssafy.s15p11b104.domain.file.service.MediaDownloadUrlProvider;
import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
import com.ssafy.s15p11b104.domain.group.repository.GroupMemberRepository;
import com.ssafy.s15p11b104.domain.group.repository.MemberAliasRepository;
import com.ssafy.s15p11b104.domain.notification.event.DomainNotificationEvent;
import com.ssafy.s15p11b104.global.exception.BusinessException;
import com.ssafy.s15p11b104.global.exception.ErrorCode;

@Service
public class CommentService {

	private final CommentRepository commentRepository;
	private final PostRepository postRepository;
	private final GroupMemberRepository groupMemberRepository;
	private final MemberAliasRepository memberAliasRepository;
	private final ApplicationEventPublisher eventPublisher;
	private final MediaDownloadUrlProvider mediaDownloadUrlProvider;

	public CommentService(
		CommentRepository commentRepository,
		PostRepository postRepository,
		GroupMemberRepository groupMemberRepository,
		MemberAliasRepository memberAliasRepository,
		ApplicationEventPublisher eventPublisher,
		MediaDownloadUrlProvider mediaDownloadUrlProvider) {
		this.commentRepository = commentRepository;
		this.postRepository = postRepository;
		this.groupMemberRepository = groupMemberRepository;
		this.memberAliasRepository = memberAliasRepository;
		this.eventPublisher = eventPublisher;
		this.mediaDownloadUrlProvider = mediaDownloadUrlProvider;
	}

	@Transactional(readOnly = true)
	public CommentListResponse getComments(Long postId, Pageable pageable, Long authenticatedUserId) {
		Post post = getPost(postId);
		GroupMember viewer = getActiveMember(post.getGroup().getId(), authenticatedUserId);
		Page<Comment> page = commentRepository.findPageByPostId(postId, pageable);
		Map<Long, String> aliasesByTarget = page.getContent().isEmpty()
			? Map.of()
			: memberAliasRepository.findAllByGroupIdAndOwnerMemberIdAndTargetMemberIdIn(
				post.getGroup().getId(),
				viewer.getId(),
				page.getContent().stream()
					.map(comment -> comment.getAuthorMember().getId())
					.distinct()
					.toList())
				.stream()
				.collect(Collectors.toMap(
					alias -> alias.getTargetMember().getId(),
					alias -> alias.getAlias()));
		return new CommentListResponse(
			page.getContent().stream().map(comment -> toResponse(comment, aliasesByTarget)).toList(),
			page.hasNext());
	}

	@Transactional
	public CommentCreateResponse create(
		Long postId,
		CommentCreateRequest request,
		Long authenticatedUserId) {
		Post post = getPost(postId);
		GroupMember author = getActiveMemberForWrite(post.getGroup().getId(), authenticatedUserId);
		Comment comment = commentRepository.save(new Comment(post, author, request.content()));
		eventPublisher.publishEvent(new DomainNotificationEvent.CommentCreated(comment.getId()));
		return new CommentCreateResponse(
			comment.getId(), postId, comment.getContent(), comment.getCreatedAt());
	}

	@Transactional
	public CommentUpdateResponse update(
		Long commentId,
		CommentUpdateRequest request,
		Long authenticatedUserId) {
		Comment comment = getComment(commentId);
		assertAuthor(comment, authenticatedUserId);
		comment.updateContent(request.content());
		commentRepository.flush();
		return new CommentUpdateResponse(comment.getId(), comment.getContent(), comment.getUpdatedAt());
	}

	@Transactional
	public void delete(Long commentId, Long authenticatedUserId) {
		Comment comment = getComment(commentId);
		assertAuthor(comment, authenticatedUserId);
		commentRepository.delete(comment);
	}

	private CommentResponse toResponse(Comment comment, Map<Long, String> aliasesByTarget) {
		GroupMember author = comment.getAuthorMember();
		return new CommentResponse(
			comment.getId(),
			PostAuthorResponse.from(
				author,
				aliasesByTarget.getOrDefault(author.getId(), author.getUser().getName()),
				mediaDownloadUrlProvider.issueProfileImageDownloadUrl(author.getUser().getProfileImageUrl())),
			comment.getContent(),
			comment.getCreatedAt(),
			comment.getUpdatedAt());
	}

	private Post getPost(Long postId) {
		return postRepository.findWithAuthorAndGroupById(postId)
			.orElseThrow(() -> new BusinessException(ErrorCode.FORBIDDEN));
	}

	private Comment getComment(Long commentId) {
		return commentRepository.findById(commentId)
			.orElseThrow(() -> new BusinessException(ErrorCode.FORBIDDEN));
	}

	private GroupMember getActiveMember(Long groupId, Long authenticatedUserId) {
		return groupMemberRepository.findActiveByGroupIdAndUserId(groupId, authenticatedUserId)
			.orElseThrow(() -> new BusinessException(ErrorCode.FORBIDDEN));
	}

	/**
	 * 댓글을 저장하기 전에 작성자의 활성 멤버십 행을 잠그고 찾는다.
	 *
	 * <p>잠그지 않으면 활성 구성원임을 읽은 뒤 그룹 나가기나 회원 탈퇴가 커밋되고, 그 다음 댓글이
	 * 저장되어 이미 떠난 구성원 명의의 댓글이 남는다. 나가기가 먼저 커밋된 경우 이 조회가 빈 결과를
	 * 돌려주므로 잠금 없는 검사와 같은 {@code 403}으로 끝난다.
	 */
	private GroupMember getActiveMemberForWrite(Long groupId, Long authenticatedUserId) {
		return groupMemberRepository.findActiveForUpdateByGroupIdAndUserId(groupId, authenticatedUserId)
			.orElseThrow(() -> new BusinessException(ErrorCode.FORBIDDEN));
	}

	private void assertAuthor(Comment comment, Long authenticatedUserId) {
		GroupMember author = comment.getAuthorMember();
		if (!author.getUser().getId().equals(authenticatedUserId)
			|| groupMemberRepository.findActiveByGroupIdAndUserId(
				author.getGroup().getId(), authenticatedUserId)
			.map(GroupMember::getId)
			.filter(author.getId()::equals)
			.isEmpty()) {
			throw new BusinessException(ErrorCode.FORBIDDEN);
		}
	}
}
