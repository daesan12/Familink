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
			and author.id <> :excludedAuthorMemberId
			and analysis.status = :status
			and post.createdAt >= :fromInclusive
			and post.createdAt < :toExclusive
		order by post.createdAt desc
		""")
	List<PostAnalysis> findSuccessfulTodayExcludingAuthor(
		@Param("groupId") Long groupId,
		@Param("excludedAuthorMemberId") Long excludedAuthorMemberId,
		@Param("status") AnalysisStatus status,
		@Param("fromInclusive") Instant fromInclusive,
		@Param("toExclusive") Instant toExclusive,
		Pageable pageable
	);

	@Query("""
		select analysis.summary
		from PostAnalysis analysis
		join analysis.post post
		join post.authorMember author
		where post.group.id = :groupId
			and author.id = :authorMemberId
			and author.leftAt is null
			and analysis.status = :status
		order by post.createdAt desc, post.id desc
		""")
	List<String> findRecentSuccessfulSummariesByAuthor(
		@Param("groupId") Long groupId,
		@Param("authorMemberId") Long authorMemberId,
		@Param("status") AnalysisStatus status,
		Pageable pageable
	);
}
