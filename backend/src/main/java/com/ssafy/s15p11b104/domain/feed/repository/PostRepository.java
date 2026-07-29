package com.ssafy.s15p11b104.domain.feed.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ssafy.s15p11b104.domain.feed.entity.Post;

public interface PostRepository extends JpaRepository<Post, Long> {

	@Query("""
		select post
		from Post post
		join fetch post.group
		join fetch post.authorMember author
		join fetch author.user
		where post.id = :postId
		""")
	Optional<Post> findWithAuthorAndGroupById(@Param("postId") Long postId);
}
