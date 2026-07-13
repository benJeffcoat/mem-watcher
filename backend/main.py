from __future__ import annotations

import asyncio
from collections import deque
from contextlib import suppress
from dataclasses import dataclass, field
from datetime import datetime, timezone
import re
from typing import Any
from uuid import uuid4

import asyncssh
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


PROMPT_RE = re.compile(r"(?m)^[^\r\n]*>\s*$")
RAMFREE_PERCENT_RE = re.compile(r"(\d+)\s+percent of memory in use", re.IGNORECASE)
RAMFREE_TOTAL_RE = re.compile(r"(\d+)\s+total bytes of physical memory", re.IGNORECASE)
RAMFREE_USED_RE = re.compile(r"(\d+)\s+bytes actually used", re.IGNORECASE)
RAMFREE_FREE_RE = re.compile(r"(\d+)\s+bytes free", re.IGNORECASE)


class ConnectRequest(BaseModel):
    host: str = Field(min_length=1)
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)
    port: int = Field(default=22, ge=1, le=65535)


class ProcessInfo(BaseModel):
    pid: int
    name: str
    command: str
    rss_bytes: int
    pss_bytes: int
    user_percent: float
    sys_percent: float


class MemorySnapshot(BaseModel):
    used_percent: float
    total_bytes: int
    used_bytes: int
    free_bytes: int


class DeviceSnapshot(BaseModel):
    connected: bool
    host: str
    prompt: str
    timestamp: str | None
    uptime: str | None
    memory: MemorySnapshot | None
    processes: list[ProcessInfo]
    error: str | None
    history: list[dict[str, Any]]


class SessionResponse(BaseModel):
    session_id: str
    snapshot: DeviceSnapshot


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_size_to_bytes(value: str) -> int:
    text = value.strip().lower()
    multiplier = 1024
    if text.endswith("g"):
        return int(float(text[:-1]) * 1024 * 1024 * 1024)
    if text.endswith("m"):
        return int(float(text[:-1]) * 1024 * 1024)
    if text.endswith("k"):
        return int(float(text[:-1]) * 1024)
    return int(float(text) * multiplier)


def _parse_percent(value: str) -> float:
    return float(value.strip().replace("%", ""))


def _parse_ramfree(output: str) -> MemorySnapshot:
    percent_match = RAMFREE_PERCENT_RE.search(output)
    total_match = RAMFREE_TOTAL_RE.search(output)
    used_match = RAMFREE_USED_RE.search(output)
    free_match = RAMFREE_FREE_RE.search(output)
    if not percent_match or not total_match or not used_match or not free_match:
        raise ValueError("Could not parse RAMFree output.")
    return MemorySnapshot(
        used_percent=float(percent_match.group(1)),
        total_bytes=int(total_match.group(1)),
        used_bytes=int(used_match.group(1)),
        free_bytes=int(free_match.group(1)),
    )


def _parse_taskstat(output: str) -> list[ProcessInfo]:
    processes: list[ProcessInfo] = []
    header_seen = False
    for raw_line in output.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if line.lower().startswith("pid") and "command" in line.lower():
            header_seen = True
            continue
        if not header_seen or not line[0].isdigit():
            continue
        parts = re.split(r"\s+", line, maxsplit=13)
        if len(parts) < 14:
            continue
        try:
            rss_bytes = _parse_size_to_bytes(parts[9])
            pss_bytes = _parse_size_to_bytes(parts[11])
            process = ProcessInfo(
                pid=int(parts[0]),
                name=parts[12],
                command=parts[13],
                rss_bytes=rss_bytes,
                pss_bytes=pss_bytes,
                user_percent=_parse_percent(parts[3]),
                sys_percent=_parse_percent(parts[4]),
            )
        except ValueError:
            continue
        if process.rss_bytes <= 0:
            continue
        processes.append(process)
    processes.sort(key=lambda item: item.rss_bytes, reverse=True)
    return processes


def _parse_uptime(output: str) -> str | None:
    for raw_line in output.splitlines():
        line = raw_line.strip()
        if not line or line.endswith(">"):
            continue
        if line.lower().startswith("uptime"):
            continue
        return line
    return None


@dataclass
class MonitorSession:
    session_id: str
    request: ConnectRequest
    poll_interval_seconds: int = 10
    prompt: str = ""
    conn: asyncssh.SSHClientConnection | None = None
    process: asyncssh.SSHClientProcess[Any] | None = None
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    task: asyncio.Task[None] | None = None
    connected: bool = False
    last_error: str | None = None
    last_snapshot_at: str | None = None
    memory: MemorySnapshot | None = None
    processes: list[ProcessInfo] = field(default_factory=list)
    uptime: str | None = None
    history: deque[dict[str, Any]] = field(default_factory=lambda: deque(maxlen=24))

    async def start(self) -> None:
        await self._connect()
        await self._poll_once()
        self.task = asyncio.create_task(self._poll_loop())

    async def close(self) -> None:
        if self.task is not None:
            self.task.cancel()
            with suppress(asyncio.CancelledError):
                await self.task
        await self._disconnect()

    async def _disconnect(self) -> None:
        self.connected = False
        if self.process is not None:
            self.process.stdin.write("logoff\n")
            with suppress(Exception):
                await asyncio.wait_for(self.process.wait_closed(), timeout=2)
        if self.conn is not None:
            self.conn.close()
            with suppress(Exception):
                await self.conn.wait_closed()
        self.process = None
        self.conn = None

    async def _connect(self) -> None:
        await self._disconnect()
        self.conn = await asyncssh.connect(
            self.request.host,
            port=self.request.port,
            username=self.request.username,
            password=self.request.password,
            known_hosts=None,
        )
        self.process = await self.conn.create_process(term_type="vt100")
        initial_text = await self._read_until_prompt()
        prompt_match = PROMPT_RE.search(initial_text)
        self.prompt = prompt_match.group(0).strip() if prompt_match else "console>"
        self.connected = True
        self.last_error = None

    async def _ensure_connected(self) -> None:
        if self.process is None or self.conn is None or self.process.exit_status is not None:
            await self._connect()

    async def _poll_loop(self) -> None:
        while True:
            await asyncio.sleep(self.poll_interval_seconds)
            await self._poll_once()

    async def _poll_once(self) -> None:
        try:
            ramfree_output = await self._run_command("ramfree")
            taskstat_output = await self._run_command("taskstat")
            uptime_output = await self._run_command("uptime")
            self.memory = _parse_ramfree(ramfree_output)
            self.processes = _parse_taskstat(taskstat_output)
            self.uptime = _parse_uptime(uptime_output)
            self.last_snapshot_at = _now_iso()
            self.connected = True
            self.last_error = None
            if self.memory is not None:
                self.history.append(
                    {
                        "timestamp": self.last_snapshot_at,
                        "usedPercent": self.memory.used_percent,
                        "freeBytes": self.memory.free_bytes,
                    }
                )
        except Exception as exc:
            self.connected = False
            self.last_error = str(exc)
            await self._disconnect()

    async def _run_command(self, command: str) -> str:
        async with self.lock:
            await self._ensure_connected()
            if self.process is None:
                raise RuntimeError("SSH process is not available.")
            self.process.stdin.write(f"{command}\n")
            return await self._read_until_prompt()

    async def _read_until_prompt(self) -> str:
        if self.process is None:
            raise RuntimeError("SSH process is not available.")
        chunks: list[str] = []
        while True:
            chunk = await asyncio.wait_for(self.process.stdout.read(4096), timeout=15)
            if chunk == "":
                raise RuntimeError("SSH console closed unexpectedly.")
            chunks.append(chunk)
            combined = "".join(chunks)
            if PROMPT_RE.search(combined):
                return combined

    def snapshot(self) -> DeviceSnapshot:
        return DeviceSnapshot(
            connected=self.connected,
            host=self.request.host,
            prompt=self.prompt,
            timestamp=self.last_snapshot_at,
            uptime=self.uptime,
            memory=self.memory,
            processes=self.processes,
            error=self.last_error,
            history=list(self.history),
        )


class SessionStore:
    def __init__(self) -> None:
        self._sessions: dict[str, MonitorSession] = {}

    async def create(self, request: ConnectRequest) -> MonitorSession:
        session_id = uuid4().hex
        session = MonitorSession(session_id=session_id, request=request)
        await session.start()
        self._sessions[session_id] = session
        return session

    def get(self, session_id: str) -> MonitorSession:
        session = self._sessions.get(session_id)
        if session is None:
            raise KeyError(session_id)
        return session

    async def delete(self, session_id: str) -> None:
        session = self._sessions.pop(session_id, None)
        if session is not None:
            await session.close()

    async def shutdown(self) -> None:
        for session_id in list(self._sessions):
            await self.delete(session_id)


store = SessionStore()
app = FastAPI(title="Crestron Memory Watcher")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_event() -> None:
    await store.shutdown()


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/sessions", response_model=SessionResponse)
async def create_session(request: ConnectRequest) -> SessionResponse:
    try:
        session = await store.create(request)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return SessionResponse(session_id=session.session_id, snapshot=session.snapshot())


@app.get("/api/sessions/{session_id}", response_model=DeviceSnapshot)
async def get_session_snapshot(session_id: str) -> DeviceSnapshot:
    try:
        session = store.get(session_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Session not found.") from exc
    return session.snapshot()


@app.delete("/api/sessions/{session_id}")
async def delete_session(session_id: str) -> dict[str, bool]:
    await store.delete(session_id)
    return {"deleted": True}
