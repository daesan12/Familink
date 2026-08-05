package com.ssafy.s15p11b104.domain.feed.service;

import java.net.URI;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.context.ApplicationEventPublisher;
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
import com.ssafy.s15p11b104.domain.file.service.S3ObjectKeyResolver;
import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
import com.ssafy.s15p11b104.domain.group.repository.GroupMemberRepository;
import com.ssafy.s15p11b104.domain.notification.event.DomainNotificationEvent;
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
	private final S3ObjectKeyResolver s3ObjectKeyResolver;
	private final CarnationService carnationService;
	private final ApplicationEventPublisher eventPublisher;

	public PostService(
		GroupMemberRepository groupMemberRepository,
		PostRepository postRepository,
		PostMediaRepository postMediaRepository,
		PostAnalysisRepository postAnalysisRepository,
		S3Properties s3Properties,
		S3MediaValidator s3MediaValidator,
		S3ObjectKeyResolver s3ObjectKeyResolver,
		CarnationService carnationService,
		ApplicationEventPublisher eventPublisher) {
		this.groupMemberRepository = groupMemberRepository;
		this.postRepository = postRepository;
		this.postMediaRepository = postMediaRepository;
		this.postAnalysisRepository = postAnalysisRepository;
		this.s3Properties = s3Properties;
		this.s3MediaValidator = s3MediaValidator;
		this.s3ObjectKeyResolver = s3ObjectKeyResolver;
		this.carnationService = carnationService;
		this.eventPublisher = eventPublisher;
	}

	/**
	 * 요청한 그룹마다 게시글을 만든다.
	 *
	 * <p>멤버십 확인을 두 번 한다. 먼저 잠그지 않고 확인해 비구성원 요청을 미디어 검증보다 앞서
	 * {@code 403}으로 거절하고, 미디어 검증을 마친 뒤 다시 잠그고 확인한다. 미디어 검증은 S3 객체
	 * 조회와 동영상 길이 측정을 포함해 외부 I/O에 수 초가 걸릴 수 있으므로, 그 구간에서 멤버십 행을
	 * 쥐고 있으면 같은 행을 요구하는 그룹 나가기·회원 탈퇴·내보내기·그룹 삭제가 모두 대기한다.
	 * 잠금이 필요한 구간은 검사와 쓰기 사이뿐이다.
	 *
	 * <p>쓰기를 시작하기 전에 모든 그룹의 멤버십을 한 번에 잠근다. 그룹별로 잠그면서 쓰면 앞 그룹의
	 * 게시글을 저장한 뒤에 뒤 그룹의 멤버십 행을 잠그게 되어, 잠금 획득이 쓰기 사이에 흩어진다.
	 * 잠그는 이유와 순서는 {@link #lockActiveMembers}에 있다.
	 *
	 * <p>게시글은 잠근 순서가 아니라 요청 순서대로 만들어 응답 순서를 유지한다.
	 */
	@Transactional
	public PostCreateResponse create(PostCreateRequest request, Long authenticatedUserId) {
		if (request.groupIds().size() != request.groupIds().stream().distinct().count()) {
			throw new BusinessException(ErrorCode.INVALID_REQUEST);
		}
		request.groupIds().forEach(groupId -> requireActiveMember(groupId, authenticatedUserId));
		validateMedia(request.mediaType(), request.media());
		Map<Long, GroupMember> authors = lockActiveMembers(request.groupIds(), authenticatedUserId);

		List<PostCreatedItem> createdPosts = request.groupIds().stream()
			.map(groupId -> createForGroup(groupId, authors.get(groupId), request))
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

	/**
	 * 잠그지 않고 활성 구성원인지만 확인한다. 미디어 검증보다 앞서 {@code 403}을 판정하는 데 쓴다.
	 */
	private void requireActiveMember(Long groupId, Long authenticatedUserId) {
		groupMemberRepository.findActiveByGroupIdAndUserId(groupId, authenticatedUserId)
			.orElseThrow(() -> new BusinessException(ErrorCode.FORBIDDEN));
	}

	/**
	 * 요청한 모든 그룹의 활성 멤버십 행을 잠그고 그룹 id로 찾을 수 있게 돌려준다.
	 *
	 * <p>잠그지 않으면 활성 구성원임을 읽은 뒤 그룹 나가기나 회원 탈퇴가 커밋되고, 그 다음 게시글이
	 * 저장되어 이미 떠난 구성원 명의의 게시글이 남는다. 나가기가 먼저 커밋된 경우 이 조회가 빈 결과를
	 * 돌려주므로 잠금 없는 검사와 같은 {@code 403}으로 끝난다.
	 *
	 * <p>이 API는 한 요청이 여러 그룹에 게시글을 만들므로 잠금 순서를 고정해야 한다. 정렬 기준은
	 * 요청의 {@code groupId}가 아니라 잠그는 대상인 {@code group_members.id}다. 같은 행들을 잠그는
	 * 회원 탈퇴가 그 순서를 쓰므로, {@code groupId} 순으로 잠그면 사용자가 먼저 만들어진 그룹에
	 * 나중에 가입한 경우 두 순서가 역전되어 교착한다. 순서 고정은
	 * {@link GroupMemberRepository#lockActiveIdsByGroupIdsAndUserId}가 담당한다.
	 *
	 * @throws BusinessException 어느 한 그룹의 활성 구성원이 아닌 경우 {@code 403}
	 */
	private Map<Long, GroupMember> lockActiveMembers(List<Long> groupIds, Long authenticatedUserId) {
		List<GroupMember> members = groupMemberRepository
			.findAllActiveForUpdateByGroupIdsAndUserId(groupIds, authenticatedUserId);
		if (members.size() != groupIds.size()) {
			throw new BusinessException(ErrorCode.FORBIDDEN);
		}
		return members.stream()
			.collect(Collectors.toMap(member -> member.getGroup().getId(), member -> member));
	}

	private PostCreatedItem createForGroup(Long groupId, GroupMember author, PostCreateRequest request) {
		Post post = postRepository.save(new Post(author.getGroup(), author, request.content()));
		replaceMedia(post, request.mediaType(), request.media());
		carnationService.earnForPost(author);
		eventPublisher.publishEvent(new DomainNotificationEvent.PostCreated(post.getId()));
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

	/**
	 * 조회 응답의 presigned URL이 수정 요청으로 되돌아오는 경우가 있어, 저장 전에 서명 쿼리를
	 * 제거한 만료되지 않는 canonical URL로 정규화한다.
	 */
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
				s3ObjectKeyResolver.normalizePostMediaUrl(item.fileUrl()),
				item.displayOrder(),
				item.thumbnailUrl() == null
					? null
					: s3ObjectKeyResolver.normalizePostMediaUrl(item.thumbnailUrl())))
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
				s3MediaValidator.validateThumbnail(item.thumbnailUrl());
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
