package com.ssafy.s15p11b104.domain.feed.repository;

import java.util.List;
import java.util.Collection;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ssafy.s15p11b104.domain.feed.entity.PostReaction;

public interface PostReactionRepository extends JpaRepository<PostReaction, Long> {

	List<PostReaction> findAllByPostId(Long postId);

	Optional<PostReaction> findByPostIdAndGroupMemberId(Long postId, Long groupMemberId);

	@Query("""
		select reaction
		from PostReaction reaction
		join fetch reaction.groupMember member
		join fetch member.user
		where reaction.post.id in :postIds
		""")
	List<PostReaction> findAllWithMemberByPostIdIn(@Param("postIds") Collection<Long> postIds);
}
