package com.ssafy.s15p11b104.domain.file.service;

import java.math.BigDecimal;
import java.nio.file.Path;

public interface VideoDurationProvider {

	BigDecimal durationSeconds(Path videoFile);
}
