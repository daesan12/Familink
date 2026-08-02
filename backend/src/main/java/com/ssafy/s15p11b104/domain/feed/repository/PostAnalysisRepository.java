package com.ssafy.s15p11b104.domain.feed.repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.repository.query.Param;

import com.ssafy.s15p11b104.domain.feed.entity.PostAnalysis;

import jakarta.persistence.LockModeType;

public interface PostAnalysisRepository extends JpaRepository<PostAnalysis, Long> {

	Optional<PostAnalysis> findByPostId(Long postId);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select analysis from PostAnalysis analysis where analysis.post.id = :postId")
	Optional<PostAnalysis> findByPostIdForUpdate(@Param("postId") Long postId);

	@Query(value = """
		select post.id
		from posts post
		left join post_analyses analysis on analysis.post_id = post.id
		where post.updated_at <= :cutoff
		and (
			analysis.id is null
			or (
				analysis.status = 'PENDING'
				and analysis.attempt_count < :maxAttempts
				and (analysis.claim_expires_at is null or analysis.claim_expires_at <= :now)
			)
			or (
				analysis.status = 'FAILED'
				and analysis.attempt_count < :maxAttempts
				and analysis.next_attempt_at is not null
				and analysis.next_attempt_at <= :now
				and analysis.claim_token is null
			)
			or (
				analysis.status = 'PENDING'
				and analysis.attempt_count >= :maxAttempts
				and analysis.claim_expires_at <= :now
			)
		)
		order by post.updated_at asc, post.id asc
		""", nativeQuery = true)
	List<Long> findCandidatePostIds(
		@Param("cutoff") Instant cutoff,
		@Param("now") Instant now,
		@Param("maxAttempts") int maxAttempts,
		Pageable pageable);
}
