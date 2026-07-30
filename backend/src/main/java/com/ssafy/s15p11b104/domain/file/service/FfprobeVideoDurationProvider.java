package com.ssafy.s15p11b104.domain.file.service;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.TimeUnit;

import org.springframework.stereotype.Component;

import com.ssafy.s15p11b104.domain.file.config.MediaUploadProperties;

@Component
public class FfprobeVideoDurationProvider implements VideoDurationProvider {

	private static final Duration PROCESS_TIMEOUT = Duration.ofSeconds(15);

	private final MediaUploadProperties properties;

	public FfprobeVideoDurationProvider(MediaUploadProperties properties) {
		this.properties = properties;
	}

	@Override
	public BigDecimal durationSeconds(Path videoFile) {
		List<String> command = List.of(
			properties.ffprobePath(),
			"-v", "error",
			"-show_entries", "format=duration",
			"-of", "default=noprint_wrappers=1:nokey=1",
			videoFile.toAbsolutePath().toString());

		try {
			Process process = new ProcessBuilder(command).redirectErrorStream(true).start();
			if (!process.waitFor(PROCESS_TIMEOUT.toSeconds(), TimeUnit.SECONDS)) {
				process.destroyForcibly();
				throw new IllegalStateException("ffprobe timed out");
			}
			String output = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8).trim();
			if (process.exitValue() != 0 || output.isBlank()) {
				throw new IllegalStateException("ffprobe failed: " + output);
			}
			return new BigDecimal(output.split("\\R", 2)[0].trim());
		} catch (IOException exception) {
			throw new IllegalStateException("ffprobe is not available", exception);
		} catch (InterruptedException exception) {
			Thread.currentThread().interrupt();
			throw new IllegalStateException("ffprobe was interrupted", exception);
		} catch (NumberFormatException exception) {
			throw new IllegalStateException("ffprobe returned an invalid duration", exception);
		}
	}
}
