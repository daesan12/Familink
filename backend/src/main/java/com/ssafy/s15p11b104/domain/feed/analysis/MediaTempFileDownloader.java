package com.ssafy.s15p11b104.domain.feed.analysis;

import java.io.IOException;
import java.nio.file.Path;

public interface MediaTempFileDownloader {

	Path download(String mediaUri, String mimeType) throws IOException;
}
