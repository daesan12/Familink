package com.ssafy.s15p11b104.domain.feed.repository;

import java.util.List;
import java.util.Collection;

import org.springframework.data.jpa.repository.JpaRepository;

import com.ssafy.s15p11b104.domain.feed.entity.PostMedia;

public interface PostMediaRepository extends JpaRepository<PostMedia, Long> {

	List<PostMedia> findAllByPostId(Long postId);

	List<PostMedia> findAllByPostIdOrderByDisplayOrderAsc(Long postId);

	List<PostMedia> findAllByPostIdInOrderByPostIdAscDisplayOrderAsc(Collection<Long> postIds);
}
