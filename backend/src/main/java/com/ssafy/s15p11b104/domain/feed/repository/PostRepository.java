package com.ssafy.s15p11b104.domain.feed.repository;

import java.util.List;
import java.util.Optional;
import java.time.Instant;

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
		order by post.createdAt desc, post.id desc
		""", countQuery = """
		select count(post)
		from Post post
		where post.group.id = :groupId
		""")
	Page<Post> findPageByGroupId(@Param("groupId") Long groupId, Pageable pageable);

	@Query(value = """
		select post
		from Post post
		join fetch post.group
		join fetch post.authorMember author
		join fetch author.user
		where post.group.id = :groupId
		  and post.createdAt >= :startAt
		  and post.createdAt < :endAt
		  and (:memberId is null or post.authorMember.id = :memberId)
		  and (
			:type is null
			or (:type = 'TEXT' and not exists (select media.id from PostMedia media where media.post.id = post.id))
			or (:type = 'IMAGE' and exists (select media.id from PostMedia media where media.post.id = post.id and str(media.mediaType) = 'IMAGE'))
			or (:type = 'VIDEO' and exists (select media.id from PostMedia media where media.post.id = post.id and str(media.mediaType) = 'VIDEO'))
		  )
		order by post.createdAt desc, post.id desc
		""", countQuery = """
		select count(post)
		from Post post
		where post.group.id = :groupId
		  and post.createdAt >= :startAt
		  and post.createdAt < :endAt
		  and (:memberId is null or post.authorMember.id = :memberId)
		  and (
			:type is null
			or (:type = 'TEXT' and not exists (select media.id from PostMedia media where media.post.id = post.id))
			or (:type = 'IMAGE' and exists (select media.id from PostMedia media where media.post.id = post.id and str(media.mediaType) = 'IMAGE'))
			or (:type = 'VIDEO' and exists (select media.id from PostMedia media where media.post.id = post.id and str(media.mediaType) = 'VIDEO'))
		  )
		""")
	Page<Post> findArchivePage(
		@Param("groupId") Long groupId,
		@Param("startAt") Instant startAt,
		@Param("endAt") Instant endAt,
		@Param("memberId") Long memberId,
		@Param("type") String type,
		Pageable pageable);

	@Query("""
		select post
		from Post post
		join fetch post.group
		join fetch post.authorMember author
		join fetch author.user
		where post.id = :postId
		""")
	Optional<Post> findWithAuthorAndGroupById(@Param("postId") Long postId);

	@Query("""
		select post.authorMember.id as memberId, count(post) as postCount
		from Post post
		where post.group.id = :groupId
		  and post.createdAt >= :startAt
		  and post.createdAt < :endAt
		group by post.authorMember.id
		""")
	List<PostCount> countByAuthorMember(
		@Param("groupId") Long groupId,
		@Param("startAt") Instant startAt,
		@Param("endAt") Instant endAt);

	interface PostCount {

		Long getMemberId();

		long getPostCount();
	}
}
