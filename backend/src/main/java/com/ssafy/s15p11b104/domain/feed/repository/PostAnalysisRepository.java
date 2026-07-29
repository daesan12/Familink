package com.ssafy.s15p11b104.domain.feed.repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ssafy.s15p11b104.domain.feed.entity.AnalysisStatus;
import com.ssafy.s15p11b104.domain.feed.entity.PostAnalysis;

public interface PostAnalysisRepository extends JpaRepository<PostAnalysis, Long> {

	Optional<PostAnalysis> findByPostId(Long postId);

	@Query("""
		select post.id
		from Post post
		where post.updatedAt <= :cutoff
		and not exists (
			select analysis.id
			from PostAnalysis analysis
			where analysis.post = post
			and analysis.status = :successStatus
		)
		order by post.updatedAt asc
		""")
	List<Long> findStablePostIds(
		@Param("cutoff") Instant cutoff,
		@Param("successStatus") AnalysisStatus successStatus);

	@Modifying(clearAutomatically = true, flushAutomatically = true)
	@Query(value = """
		update post_analyses analysis
		set status = cast('SUCCESS' as analysis_status),
			summary = :summary,
			analyzed_at = :analyzedAt
		where analysis.id = :analysisId
		and exists (
			select 1
			from posts post
			where post.id = analysis.post_id
			and post.updated_at = :expectedUpdatedAt
		)
		""", nativeQuery = true)
	int completeIfPostUnchanged(
		@Param("analysisId") Long analysisId,
		@Param("expectedUpdatedAt") Instant expectedUpdatedAt,
		@Param("summary") String summary,
		@Param("analyzedAt") Instant analyzedAt);
}
