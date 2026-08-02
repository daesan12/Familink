package com.ssafy.s15p11b104.domain.call.controller;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
@Profile("ai-call-dev")
public class AiCallWebController {

	@GetMapping("/")
	public String redirectToAiCall() {
		return "redirect:/ai-call/";
	}

	@GetMapping({"/ai-call", "/ai-call/"})
	public String forwardToAiCallIndex() {
		return "forward:/ai-call/index.html";
	}
}
