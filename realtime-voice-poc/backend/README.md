# FastAPI backend

`OPENAI_API_KEY`를 Android 앱에 넣지 않고 서버에서만 보관하는 Realtime SDP 프록시입니다.

Android Emulator를 포함한 전체 Windows 재현 절차는 [테스트 재현 가이드](../docs/test-reproduction.md)를 참고합니다.

```powershell
Copy-Item .env.example .env
# .env에 OPENAI_API_KEY 입력
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

PowerShell 실행 정책으로 `Activate.ps1`를 실행할 수 없어도 가상환경의 Python을 직접 호출하면 됩니다. `run.ps1`는 가상환경과 의존성을 준비한 뒤 서버를 실행합니다.
