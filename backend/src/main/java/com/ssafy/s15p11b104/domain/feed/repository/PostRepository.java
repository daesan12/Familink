package com.ssafy.s15p11b104.domain.feed.repository;

import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ssafy.s15p11b104.domain.feed.entity.Post;

import jakarta.persistence.LockModeType;

public interface PostRepository extends JpaRepository<Post, Long> {

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select post from Post post where post.id = :postId")
	Optional<Post> findByIdForUpdate(@Param("postId") Long postId);

	@Query(value = """
		select post
		from Post post
		join fetch post.group
		join fetch post.authorMember author
		join fetch author.user
		where post.group.id = :groupId
		order by post.createdAt desc
		""", countQuery = """
		select count(post)
		from Post post
		where post.group.id = :groupId
		""")
	Page<Post> findPageByGroupId(@Param("groupId") Long groupId, Pageable pageable);

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
