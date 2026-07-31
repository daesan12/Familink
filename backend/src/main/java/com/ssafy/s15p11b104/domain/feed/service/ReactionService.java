package com.ssafy.s15p11b104.domain.feed.service;

import java.util.EnumMap;
import java.util.Map;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.s15p11b104.domain.feed.dto.ReactionRequest;
import com.ssafy.s15p11b104.domain.feed.dto.ReactionResponse;
import com.ssafy.s15p11b104.domain.feed.entity.Post;
import com.ssafy.s15p11b104.domain.feed.entity.PostReaction;
import com.ssafy.s15p11b104.domain.feed.entity.ReactionType;
import com.ssafy.s15p11b104.domain.feed.repository.PostReactionRepository;
import com.ssafy.s15p11b104.domain.feed.repository.PostRepository;
import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
import com.ssafy.s15p11b104.domain.group.repository.GroupMemberRepository;
import com.ssafy.s15p11b104.domain.notification.event.DomainNotificationEvent;
import com.ssafy.s15p11b104.global.exception.BusinessException;
import com.ssafy.s15p11b104.global.exception.ErrorCode;

@Service
public class ReactionService {

	private final PostRepository postRepository;
	private final PostReactionRepository postReactionRepository;
	private final GroupMemberRepository groupMemberRepository;
	private final ApplicationEventPublisher eventPublisher;

	public ReactionService(
		PostRepository postRepository,
		PostReactionRepository postReactionRepository,
		GroupMemberRepository groupMemberRepository,
		ApplicationEventPublisher eventPublisher) {
		this.postRepository = postRepository;
		this.postReactionRepository = postReactionRepository;
		this.groupMemberRepository = groupMemberRepository;
		this.eventPublisher = eventPublisher;
	}

	@Transactional
	public ReactionResponse react(Long postId, ReactionRequest request, Long authenticatedUserId) {
		Post post = postRepository.findWithAuthorAndGroupById(postId)
			.orElseThrow(() -> new BusinessException(ErrorCode.FORBIDDEN));
		GroupMember member = groupMemberRepository
			.findActiveForUpdateByGroupIdAndUserId(post.getGroup().getId(), authenticatedUserId)
			.orElseThrow(() -> new BusinessException(ErrorCode.FORBIDDEN));

		PostReaction reaction = postReactionRepository
			.findByPostIdAndGroupMemberId(postId, member.getId())
			.orElse(null);
		ReactionType selectedType = request.reactionType();
		ReactionType responseType;
		if (reaction == null) {
			reaction = postReactionRepository.save(new PostReaction(post, member, selectedType));
			eventPublisher.publishEvent(new DomainNotificationEvent.ReactionCreated(reaction.getId()));
			responseType = selectedType;
		} else if (reaction.getReactionType() == selectedType) {
			postReactionRepository.delete(reaction);
			responseType = null;
		} else {
			reaction.changeReactionType(selectedType);
			responseType = selectedType;
		}

		postReactionRepository.flush();
		return new ReactionResponse(postId, responseType, counts(postId));
	}

	private Map<ReactionType, Long> counts(Long postId) {
		Map<ReactionType, Long> counts = new EnumMap<>(ReactionType.class);
		for (ReactionType type : ReactionType.values()) {
			counts.put(type, 0L);
		}
		postReactionRepository.findAllByPostId(postId)
			.forEach(reaction -> counts.merge(reaction.getReactionType(), 1L, Long::sum));
		return counts;
	}
}
