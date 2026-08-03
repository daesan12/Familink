package com.ssafy.s15p11b104.domain.feed.analysis;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.ssafy.s15p11b104.domain.file.service.MediaDownloadUrlProvider;

@Component
public class HttpMediaTempFileDownloader implements MediaTempFileDownloader {

	private final MediaDownloadUrlProvider downloadUrlProvider;
	private final HttpClient httpClient;
	private final Duration timeout;

	@Autowired
	public HttpMediaTempFileDownloader(
		MediaDownloadUrlProvider downloadUrlProvider,
		@Value("${gemini.analysis.media-download-timeout:60s}") Duration timeout
	) {
		this(downloadUrlProvider, HttpClient.newBuilder().connectTimeout(timeout).build(), timeout);
	}

	HttpMediaTempFileDownloader(
		MediaDownloadUrlProvider downloadUrlProvider,
		HttpClient httpClient,
		Duration timeout
	) {
		this.downloadUrlProvider = downloadUrlProvider;
		this.httpClient = httpClient;
		this.timeout = timeout;
	}

	@Override
	public Path download(String mediaUri, String mimeType) throws IOException {
		Path temporaryFile = Files.createTempFile("familink-gemini-media-", suffix(mimeType));
		try {
			String downloadUrl = downloadUrlProvider.issueDownloadUrl(mediaUri);
			HttpRequest request = HttpRequest.newBuilder(URI.create(downloadUrl))
				.GET()
				.timeout(timeout)
				.build();
			HttpResponse<Path> response = httpClient.send(request, HttpResponse.BodyHandlers.ofFile(temporaryFile));
			if (response.statusCode() < 200 || response.statusCode() >= 300) {
				throw new IOException("Media download failed with HTTP " + response.statusCode());
			}
			return temporaryFile;
		} catch (InterruptedException exception) {
			Thread.currentThread().interrupt();
			deleteQuietly(temporaryFile);
			throw new IOException("Media download was interrupted", exception);
		} catch (IOException | RuntimeException exception) {
			deleteQuietly(temporaryFile);
			throw exception;
		}
	}

	private String suffix(String mimeType) {
		return switch (mimeType) {
			case "image/jpeg" -> ".jpg";
			case "image/png" -> ".png";
			case "image/webp" -> ".webp";
			case "video/mp4" -> ".mp4";
			default -> ".bin";
		};
	}

	private void deleteQuietly(Path path) {
		try {
			Files.deleteIfExists(path);
		} catch (IOException ignored) {
			// The caller receives the original download failure.
		}
	}
}
