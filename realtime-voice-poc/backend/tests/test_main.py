from __future__ import annotations

import json

import httpx
from fastapi.testclient import TestClient

from app import main


def test_health() -> None:
    with TestClient(main.app) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_realtime_session_forwards_raw_sdp_and_session(monkeypatch) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("OPENAI_REALTIME_MODEL", "test-model")
    monkeypatch.setenv("OPENAI_REALTIME_VOICE", "marin")
    captured: dict[str, object] = {}

    class FakeAsyncClient:
        def __init__(self, **kwargs) -> None:
            captured["client_kwargs"] = kwargs

        async def __aenter__(self) -> FakeAsyncClient:
            return self

        async def __aexit__(self, exc_type, exc, traceback) -> None:
            return None

        async def post(self, url: str, **kwargs) -> httpx.Response:
            captured["url"] = url
            captured.update(kwargs)
            return httpx.Response(200, text="v=0\r\no=- answer\r\n")

    monkeypatch.setattr(main.httpx, "AsyncClient", FakeAsyncClient)

    with TestClient(main.app) as client:
        response = client.post(
            "/realtime/session",
            content="v=0\r\no=- offer\r\n",
            headers={"content-type": "application/sdp"},
        )

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/sdp"
    assert response.text.startswith("v=0")
    assert captured["url"] == main.OPENAI_REALTIME_CALLS_URL
    assert captured["headers"] == {"Authorization": "Bearer test-key"}

    files = captured["files"]
    assert isinstance(files, dict)
    assert files["sdp"] == (None, "v=0\r\no=- offer\r\n", "application/sdp")
    session_part = files["session"]
    assert session_part[0] is None
    assert session_part[2] == "application/json"
    session = json.loads(session_part[1])
    assert session["type"] == "realtime"
    assert session["model"] == "test-model"
    assert session["audio"]["input"]["turn_detection"]["type"] == "server_vad"
    assert session["audio"]["input"]["turn_detection"]["threshold"] == 0.7
    assert session["audio"]["input"]["turn_detection"]["silence_duration_ms"] == 900
    assert session["audio"]["input"]["turn_detection"]["create_response"] is False
    assert session["audio"]["input"]["turn_detection"]["interrupt_response"] is False
    assert session["audio"]["output"]["voice"] == "marin"


def test_realtime_session_does_not_expose_missing_api_key(monkeypatch) -> None:
    secret = "sk-secret-value"
    monkeypatch.setenv("OPENAI_API_KEY", "")

    with TestClient(main.app) as client:
        response = client.post(
            "/realtime/session",
            content="v=0",
            headers={"content-type": "application/sdp"},
        )

    assert response.status_code == 503
    assert secret not in response.text
    assert "not configured" in response.text


def test_realtime_session_maps_upstream_error_without_body(monkeypatch) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")

    class FakeAsyncClient:
        def __init__(self, **kwargs) -> None:
            pass

        async def __aenter__(self) -> FakeAsyncClient:
            return self

        async def __aexit__(self, exc_type, exc, traceback) -> None:
            return None

        async def post(self, url: str, **kwargs) -> httpx.Response:
            return httpx.Response(401, text="Bearer test-key is invalid")

    monkeypatch.setattr(main.httpx, "AsyncClient", FakeAsyncClient)

    with TestClient(main.app) as client:
        response = client.post(
            "/realtime/session",
            content="v=0",
            headers={"content-type": "application/sdp"},
        )

    assert response.status_code == 502
    assert "test-key" not in response.text
    assert "rejected" in response.text


def test_realtime_session_rejects_invalid_content_type(monkeypatch) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")

    with TestClient(main.app) as client:
        response = client.post("/realtime/session", content="v=0")

    assert response.status_code == 415


def test_realtime_session_rejects_empty_sdp(monkeypatch) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")

    with TestClient(main.app) as client:
        response = client.post(
            "/realtime/session",
            content=b"",
            headers={"content-type": "application/sdp"},
        )

    assert response.status_code == 400
