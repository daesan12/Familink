package com.ssafy.s15p11b104.domain.feed.repository;

import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ssafy.s15p11b104.domain.feed.entity.Comment;

public interface CommentRepository extends JpaRepository<Comment, Long> {

	long countByPostId(Long postId);

	@Query("""
		select comment.post.id, count(comment.id)
		from Comment comment
		where comment.post.id in :postIds
		group by comment.post.id
		""")
	List<Object[]> countByPostIds(@Param("postIds") Collection<Long> postIds);
}
