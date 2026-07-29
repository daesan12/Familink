package com.ssafy.s15p11b104.domain.feed.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.ssafy.s15p11b104.domain.feed.entity.PostAnalysis;

public interface PostAnalysisRepository extends JpaRepository<PostAnalysis, Long> {

	Optional<PostAnalysis> findByPostId(Long postId);
}
