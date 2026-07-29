package com.ssafy.s15p11b104.domain.feed.analysis;

import java.util.List;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.s15p11b104.domain.feed.entity.MediaType;
import com.ssafy.s15p11b104.domain.feed.entity.Post;
import com.ssafy.s15p11b104.domain.feed.entity.PostMedia;
import com.ssafy.s15p11b104.domain.feed.repository.PostMediaRepository;
import com.ssafy.s15p11b104.domain.feed.repository.PostRepository;

@Service
public class PostContentInputLoader {

	private final PostRepository postRepository;
	private final PostMediaRepository postMediaRepository;
	private final ObjectProvider<MediaMimeTypeProvider> mimeTypeProvider;

	public PostContentInputLoader(
		PostRepository postRepository,
		PostMediaRepository postMediaRepository,
		ObjectProvider<MediaMimeTypeProvider> mimeTypeProvider) {
		this.postRepository = postRepository;
		this.postMediaRepository = postMediaRepository;
		this.mimeTypeProvider = mimeTypeProvider;
	}

	@Transactional(readOnly = true)
	public PostContentInput load(Long postId) {
		validatePostId(postId);

		Post post = postRepository.findById(postId).orElseThrow(this::invalidInput);
		List<PostMedia> media = postMediaRepository.findAllByPostIdOrderByDisplayOrderAsc(postId);
		if (media.isEmpty()) {
			return new PostContentInput(post.getContent(), null, List.of());
		}

		MediaMimeTypeProvider provider = mimeTypeProvider.getIfAvailable();
		if (provider == null) {
			throw invalidInput();
		}

		MediaType mediaType = media.get(0).getMediaType();
		List<PostContentMedia> contentMedia = media.stream()
			.map(item -> new PostContentMedia(
				item.getMediaType(),
				item.getFileUrl(),
				getMimeType(provider, item.getFileUrl())))
			.toList();
		return new PostContentInput(post.getContent(), mediaType, contentMedia);
	}

	private String getMimeType(MediaMimeTypeProvider provider, String mediaUri) {
		try {
			return provider.getMimeType(mediaUri);
		} catch (RuntimeException exception) {
			throw new PostContentAnalysisException(
				AnalysisFailureType.UPSTREAM_FAILURE,
				"미디어 MIME 메타데이터 조회에 실패했습니다.");
		}
	}

	private void validatePostId(Long postId) {
		if (postId == null || postId <= 0) {
			throw invalidInput();
		}
	}

	private PostContentAnalysisException invalidInput() {
		return new PostContentAnalysisException(
			AnalysisFailureType.INVALID_INPUT,
			"게시글 분석 입력이 유효하지 않습니다.");
	}
}
