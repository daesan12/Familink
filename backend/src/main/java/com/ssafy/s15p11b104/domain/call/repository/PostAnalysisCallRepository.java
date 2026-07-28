package com.ssafy.s15p11b104.domain.call.repository;

import java.time.Instant;
import java.util.List;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ssafy.s15p11b104.domain.feed.entity.AnalysisStatus;
import com.ssafy.s15p11b104.domain.feed.entity.PostAnalysis;

public interface PostAnalysisCallRepository extends JpaRepository<PostAnalysis, Long> {

	@Query("""
		select analysis
		from PostAnalysis analysis
		join fetch analysis.post post
		join fetch post.authorMember author
		join fetch author.user
		where post.group.id = :groupId
			and analysis.status = :status
			and post.createdAt >= :fromInclusive
			and post.createdAt < :toExclusive
		order by post.createdAt desc
		""")
	List<PostAnalysis> findSuccessfulToday(
		@Param("groupId") Long groupId,
		@Param("status") AnalysisStatus status,
		@Param("fromInclusive") Instant fromInclusive,
		@Param("toExclusive") Instant toExclusive,
		Pageable pageable
	);
}
