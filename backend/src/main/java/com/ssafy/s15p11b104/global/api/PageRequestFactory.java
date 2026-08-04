package com.ssafy.s15p11b104.global.api;

import java.util.List;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import com.ssafy.s15p11b104.global.exception.BusinessException;
import com.ssafy.s15p11b104.global.exception.ErrorCode;

/** 목록 API가 외부 정렬과 과도한 페이지 크기를 사용하지 않도록 검증한다. */
public final class PageRequestFactory {

	public static final int DEFAULT_PAGE = 0;
	public static final int DEFAULT_SIZE = 20;
	public static final int MAX_SIZE = 100;

	private PageRequestFactory() {
	}

	public static Pageable fixed(Integer page, Integer size, List<String> sort, Sort fixedSort) {
		int resolvedPage = page == null ? DEFAULT_PAGE : page;
		int resolvedSize = size == null ? DEFAULT_SIZE : size;
		if (resolvedPage < 0 || resolvedSize < 1 || resolvedSize > MAX_SIZE || (sort != null && !sort.isEmpty())) {
			throw new BusinessException(ErrorCode.INVALID_REQUEST);
		}
		return PageRequest.of(resolvedPage, resolvedSize, fixedSort);
	}
}
