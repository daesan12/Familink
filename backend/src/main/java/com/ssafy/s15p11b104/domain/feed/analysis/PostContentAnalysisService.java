package com.ssafy.s15p11b104.domain.feed.analysis;

import org.springframework.stereotype.Service;

@Service
public class PostContentAnalysisService {

	private final PostContentInputLoader inputLoader;
	private final PostContentAnalyzer analyzer;

	public PostContentAnalysisService(PostContentInputLoader inputLoader, PostContentAnalyzer analyzer) {
		this.inputLoader = inputLoader;
		this.analyzer = analyzer;
	}

	public String analyze(Long postId) {
		return analyzer.analyze(inputLoader.load(postId));
	}
}
