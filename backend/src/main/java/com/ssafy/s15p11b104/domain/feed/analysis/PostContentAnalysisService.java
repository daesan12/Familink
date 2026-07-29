package com.ssafy.s15p11b104.domain.feed.analysis;

import org.springframework.stereotype.Service;

import com.ssafy.s15p11b104.domain.feed.service.PostAnalysisGateway;

@Service
public class PostContentAnalysisService implements PostAnalysisGateway {

	private final PostContentInputLoader inputLoader;
	private final PostContentAnalyzer analyzer;

	public PostContentAnalysisService(PostContentInputLoader inputLoader, PostContentAnalyzer analyzer) {
		this.inputLoader = inputLoader;
		this.analyzer = analyzer;
	}

	@Override
	public String analyze(Long postId) {
		return analyzer.analyze(inputLoader.load(postId));
	}
}
