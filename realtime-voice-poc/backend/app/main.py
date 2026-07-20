from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass
from pathlib import Path

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import Response

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

logger = logging.getLogger("realtime_voice_poc")
OPENAI_REALTIME_CALLS_URL = "https://api.openai.com/v1/realtime/calls"


@dataclass(frozen=True)
class Settings:
    openai_api_key: str
    realtime_model: str
    realtime_voice: str

    @classmethod
    def from_environment(cls) -> Settings:
        return cls(
            openai_api_key=os.getenv("OPENAI_API_KEY", "").strip(),
            realtime_model=os.getenv("OPENAI_REALTIME_MODEL", "gpt-realtime-2.1").strip(),
            realtime_voice=os.getenv("OPENAI_REALTIME_VOICE", "marin").strip(),
        )


def build_session_config(settings: Settings) -> dict[str, object]:
    return {
        "type": "realtime",
        "model": settings.realtime_model,
        "output_modalities": ["audio"],
        "instructions": (
            "한국어로 짧고 자연스럽게 대화하세요. 음성 응답은 명확하고 간결하게 하며, "
            "사용자의 말이 끝난 뒤 핵심만 답하세요. 이 앱은 응답 지연시간을 측정하는 PoC입니다."
        ),
        "audio": {
            "input": {
                "turn_detection": {
                    "type": "server_vad",
                    "threshold": 0.7,
                    "prefix_padding_ms": 300,
                    "silence_duration_ms": 900,
                    "create_response": False,
                    "interrupt_response": False,
                }
            },
            "output": {"voice": settings.realtime_voice},
        },
    }


app = FastAPI(title="Realtime Voice PoC Backend", version="1.0.0")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/realtime/session")
async def create_realtime_session(request: Request) -> Response:
    settings = Settings.from_environment()
    if not settings.openai_api_key:
        raise HTTPException(status_code=503, detail="OpenAI API key is not configured")

    content_type = request.headers.get("content-type", "").split(";", maxsplit=1)[0].lower()
    if content_type != "application/sdp":
        raise HTTPException(status_code=415, detail="Content-Type must be application/sdp")

    raw_sdp = await request.body()
    if not raw_sdp:
        raise HTTPException(status_code=400, detail="SDP offer is empty")

    try:
        sdp = raw_sdp.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=400, detail="SDP offer must be UTF-8") from exc

    files = {
        # The Realtime Calls endpoint expects SDP as a regular multipart form
        # field. A filename makes httpx encode it as a file part, which the
        # endpoint rejects as a missing `sdp` field.
        "sdp": (None, sdp, "application/sdp"),
        "session": (
            None,
            json.dumps(build_session_config(settings), ensure_ascii=False, separators=(",", ":")),
            "application/json",
        ),
    }

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(60.0, connect=10.0)) as client:
            upstream_response = await client.post(
                OPENAI_REALTIME_CALLS_URL,
                headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                files=files,
            )
    except httpx.HTTPError as exc:
        logger.warning("Realtime upstream request failed: %s", type(exc).__name__)
        raise HTTPException(status_code=502, detail="Realtime upstream is unavailable") from exc

    if upstream_response.status_code >= 400:
        logger.warning("Realtime upstream returned status %s", upstream_response.status_code)
        raise HTTPException(status_code=502, detail="Realtime upstream rejected the session")

    answer_sdp = upstream_response.text
    if not answer_sdp.strip():
        raise HTTPException(status_code=502, detail="Realtime upstream returned an empty SDP")

    return Response(content=answer_sdp, media_type="application/sdp")
