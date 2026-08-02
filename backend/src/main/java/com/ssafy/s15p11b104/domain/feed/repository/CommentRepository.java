package com.ssafy.s15p11b104.domain.feed.repository;

import java.util.Collection;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ssafy.s15p11b104.domain.feed.entity.Comment;

public interface CommentRepository extends JpaRepository<Comment, Long> {

	@Query(value = """
		select comment
		from Comment comment
		join fetch comment.authorMember author
		join fetch author.user
		where comment.post.id = :postId
		order by comment.createdAt asc
		""", countQuery = """
		select count(comment)
		from Comment comment
		where comment.post.id = :postId
		""")
	Page<Comment> findPageByPostId(@Param("postId") Long postId, Pageable pageable);

	long countByPostId(Long postId);

	@Query("""
		select comment.post.id, count(comment.id)
		from Comment comment
		where comment.post.id in :postIds
		group by comment.post.id
		""")
	List<Object[]> countByPostIds(@Param("postIds") Collection<Long> postIds);
}
