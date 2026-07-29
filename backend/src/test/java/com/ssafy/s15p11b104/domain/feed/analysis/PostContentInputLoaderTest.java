package com.ssafy.s15p11b104.domain.feed.analysis;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;

import com.ssafy.s15p11b104.domain.feed.entity.MediaType;
import com.ssafy.s15p11b104.domain.feed.entity.Post;
import com.ssafy.s15p11b104.domain.feed.entity.PostMedia;
import com.ssafy.s15p11b104.domain.feed.repository.PostMediaRepository;
import com.ssafy.s15p11b104.domain.feed.repository.PostRepository;

@ExtendWith(MockitoExtension.class)
class PostContentInputLoaderTest {

	@Mock
	private PostRepository postRepository;

	@Mock
	private PostMediaRepository postMediaRepository;

	@Mock
	private ObjectProvider<MediaMimeTypeProvider> mimeTypeProvider;

	@Test
	void textPostDoesNotRequireMimeProvider() {
		String content = AnalysisTestFixtures.content();
		Post post = post(content);
		when(postRepository.findById(1L)).thenReturn(Optional.of(post));
		when(postMediaRepository.findAllByPostIdOrderByDisplayOrderAsc(1L)).thenReturn(List.of());

		PostContentInput input = loader().load(1L);

		assertThat(input.content()).isEqualTo(content);
		assertThat(input.mediaType()).isNull();
		assertThat(input.media()).isEmpty();
	}

	@Test
	void mediaPostWithoutMimeProviderIsInvalidInput() {
		Post post = post(AnalysisTestFixtures.content());
		PostMedia media = mock(PostMedia.class);
		when(postRepository.findById(1L)).thenReturn(Optional.of(post));
		when(postMediaRepository.findAllByPostIdOrderByDisplayOrderAsc(1L)).thenReturn(List.of(media));
		when(mimeTypeProvider.getIfAvailable()).thenReturn(null);

		assertThatThrownBy(() -> loader().load(1L))
			.isInstanceOfSatisfying(PostContentAnalysisException.class, exception ->
				assertThat(exception.getType()).isEqualTo(AnalysisFailureType.INVALID_INPUT));
	}

	@Test
	void mimeProviderFailureIsUpstreamFailure() {
		Post post = post(AnalysisTestFixtures.content());
		PostMedia media = media(MediaType.IMAGE, AnalysisTestFixtures.mediaUri("https", "jpg"));
		when(postRepository.findById(1L)).thenReturn(Optional.of(post));
		when(postMediaRepository.findAllByPostIdOrderByDisplayOrderAsc(1L)).thenReturn(List.of(media));
		MediaMimeTypeProvider provider = mock(MediaMimeTypeProvider.class);
		when(mimeTypeProvider.getIfAvailable()).thenReturn(provider);
		when(provider.getMimeType(media.getFileUrl())).thenThrow(new IllegalStateException("metadata failure"));

		assertThatThrownBy(() -> loader().load(1L))
			.isInstanceOfSatisfying(PostContentAnalysisException.class, exception ->
				assertThat(exception.getType()).isEqualTo(AnalysisFailureType.UPSTREAM_FAILURE));
	}

	@Test
	void missingPostIsInvalidInput() {
		when(postRepository.findById(99L)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> loader().load(99L))
			.isInstanceOfSatisfying(PostContentAnalysisException.class, exception ->
				assertThat(exception.getType()).isEqualTo(AnalysisFailureType.INVALID_INPUT));
	}

	private PostContentInputLoader loader() {
		return new PostContentInputLoader(postRepository, postMediaRepository, mimeTypeProvider);
	}

	private Post post(String content) {
		return mock(Post.class, invocation -> {
			if (invocation.getMethod().getName().equals("getContent")) {
				return content;
			}
			return null;
		});
	}

	private PostMedia media(MediaType mediaType, String fileUrl) {
		PostMedia media = mock(PostMedia.class);
		when(media.getMediaType()).thenReturn(mediaType);
		when(media.getFileUrl()).thenReturn(fileUrl);
		return media;
	}
}
