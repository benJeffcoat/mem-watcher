from __future__ import annotations

import asyncio
from collections import deque
from contextlib import contextmanager, suppress
from dataclasses import dataclass, field
from datetime import datetime, timezone
import re
import sqlite3
from pathlib import Path
from typing import Any, Iterator
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
LOG_LINE_RE = re.compile(
    r"^\s*(?:(?P<line_number>\d+)\.\s+)?(?P<level>[A-Za-z]+):\s+"
    r"(?P<source>.+?)\s+#\s+(?P<timestamp>\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s+#\s*(?P<message>.*)$"
)


class ConnectRequest(BaseModel):
    host: str = Field(min_length=1)
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)
    port: int = Field(default=22, ge=1, le=65535)
    name: str = ""
    savedSessionId: str | None = None


class SavedSession(BaseModel):
    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    host: str = Field(min_length=1)
    username: str = Field(min_length=1)
    port: int = Field(default=22, ge=1, le=65535)
    lastUsedAt: str | None = None

class SavedSessionStore:
    """Persist connection profiles only; SSH passwords remain in memory."""

    def __init__(self, path: Path) -> None:
        self.path = path
        with self._connect() as db:
            db.execute("CREATE TABLE IF NOT EXISTS saved_sessions (id TEXT PRIMARY KEY, profile TEXT NOT NULL)")

    @contextmanager
    def _connect(self) -> Iterator[sqlite3.Connection]:
        db = sqlite3.connect(self.path)
        try:
            with db:
                yield db
        finally:
            db.close()

    def list(self) -> list[SavedSession]:
        with self._connect() as db:
            rows = db.execute("SELECT profile FROM saved_sessions ORDER BY rowid DESC").fetchall()
        return [SavedSession.model_validate_json(row[0]) for row in rows]

    def save(self, profile: SavedSession, *, overwrite: bool = True) -> None:
        # Migration must not overwrite a newer profile already saved by another browser.
        statement = "INSERT OR REPLACE" if overwrite else "INSERT OR IGNORE"
        with self._connect() as db:
            db.execute(f"{statement} INTO saved_sessions (id, profile) VALUES (?, ?)",
                       (profile.id, profile.model_dump_json()))

    def delete(self, profile_id: str) -> None:
        with self._connect() as db:
            db.execute("DELETE FROM saved_sessions WHERE id = ?", (profile_id,))

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


class LogEntry(BaseModel):
    line_number: int | None
    level: str
    source: str
    timestamp: str | None
    message: str
    raw: str


class LogResponse(BaseModel):
    command: str
    fetched_at: str
    entries: list[LogEntry]
    raw: str


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


def _parse_top_memory_value(value: str) -> int:
    """Parse Crestron `top -lines:all` memory columns.

    On these processors the `rss`/`vsz` columns are effectively reported as KB-scale
    integers, and some outputs include a trailing `m` artifact. Treat the value as KB
    after stripping any non-numeric suffix.
    """
    match = re.match(r"(\d+)", value.strip().lower())
    if not match:
        raise ValueError(f"Could not parse top memory value: {value!r}")
    return int(match.group(1)) * 1024


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
        processes.append(process)
    processes.sort(key=lambda item: item.rss_bytes, reverse=True)
    return processes


def _parse_top(output: str) -> list[ProcessInfo]:
    processes: list[ProcessInfo] = []
    header_seen = False
    for raw_line in output.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if line.lower().startswith("pid") and "name" in line.lower():
            header_seen = True
            continue
        if line.lower().startswith("top complete"):
            break
        if not header_seen or not line[0].isdigit():
            continue
        parts = re.split(r"\s+", line, maxsplit=10)
        if len(parts) < 11:
            continue
        try:
            processes.append(
                ProcessInfo(
                    pid=int(parts[0]),
                    name=parts[10],
                    command=parts[10],
                    rss_bytes=_parse_top_memory_value(parts[6]),
                    pss_bytes=0,
                    user_percent=_parse_percent(parts[8]),
                    sys_percent=_parse_percent(parts[9]),
                )
            )
        except ValueError:
            continue
    return processes


def _merge_process_lists(taskstat_processes: list[ProcessInfo], top_processes: list[ProcessInfo]) -> list[ProcessInfo]:
    merged: dict[int, ProcessInfo] = {process.pid: process for process in taskstat_processes}
    for process in top_processes:
        existing = merged.get(process.pid)
        if existing is None:
            merged[process.pid] = process
            continue
        merged[process.pid] = ProcessInfo(
            pid=existing.pid,
            name=existing.name or process.name,
            command=existing.command or process.command,
            rss_bytes=max(existing.rss_bytes, process.rss_bytes),
            pss_bytes=existing.pss_bytes,
            user_percent=process.user_percent if process.user_percent or process.sys_percent else existing.user_percent,
            sys_percent=process.sys_percent if process.user_percent or process.sys_percent else existing.sys_percent,
        )
    return sorted(merged.values(), key=lambda item: (item.rss_bytes, item.user_percent + item.sys_percent), reverse=True)


def _parse_uptime(output: str) -> str | None:
    for raw_line in output.splitlines():
        line = raw_line.strip()
        if not line or line.endswith(">"):
            continue
        if line.lower().startswith("uptime"):
            continue
        return line
    return None


def _strip_command_echo(output: str, command: str) -> str:
    lines = output.replace("\r", "").split("\n")
    filtered: list[str] = []
    skipped_echo = False
    normalized_command = command.strip().lower()

    for raw_line in lines:
        stripped = raw_line.strip()
        if PROMPT_RE.match(stripped):
            continue
        if not skipped_echo and stripped.lower() == normalized_command:
            skipped_echo = True
            continue
        filtered.append(raw_line)

    return "\n".join(filtered).strip()


def _parse_log_entries(output: str) -> list[LogEntry]:
    entries: list[LogEntry] = []
    for raw_line in output.replace("\r", "").splitlines():
        line = raw_line.strip()
        if not line:
            continue
        match = LOG_LINE_RE.match(line)
        if match:
            entries.append(
                LogEntry(
                    line_number=int(match.group("line_number")) if match.group("line_number") else None,
                    level=match.group("level"),
                    source=match.group("source").strip(),
                    timestamp=match.group("timestamp"),
                    message=match.group("message").strip(),
                    raw=line,
                )
            )
            continue
        entries.append(
            LogEntry(
                line_number=None,
                level="Info",
                source="console",
                timestamp=None,
                message=line,
                raw=line,
            )
        )
    return entries


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
    history: deque[dict[str, Any]] = field(default_factory=deque)

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
            top_output = await self._run_command("top -lines:all")
            uptime_output = await self._run_command("uptime")
            self.memory = _parse_ramfree(ramfree_output)
            self.processes = _merge_process_lists(
                _parse_taskstat(taskstat_output),
                _parse_top(top_output),
            )
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
        try:
            await session.start()
        except Exception:
            await session.close()
            raise
        self._sessions[session_id] = session
        return session

    def list(self) -> list[dict[str, Any]]:
        # Never expose the SSH request/password to browser clients.
        return [
            {
                "sessionId": session.session_id,
                "savedSessionId": session.request.savedSessionId,
                "name": session.request.name or session.request.host,
                "host": session.request.host,
                "username": session.request.username,
                "port": session.request.port,
                "snapshot": session.snapshot(),
                "error": session.last_error,
            }
            for session in self._sessions.values()
        ]

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


profiles = SavedSessionStore(Path(__file__).with_name("sessions.sqlite3"))
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


@app.get("/api/saved-sessions", response_model=list[SavedSession])
async def list_saved_sessions() -> list[SavedSession]:
    return profiles.list()

@app.put("/api/saved-sessions/{profile_id}", response_model=SavedSession)
async def save_session_profile(profile_id: str, profile: SavedSession) -> SavedSession:
    if profile.id != profile_id:
        raise HTTPException(status_code=400, detail="Profile ID does not match the URL.")
    profiles.save(profile)
    return profile

@app.post("/api/saved-sessions/import", response_model=list[SavedSession])
async def import_saved_sessions(saved: list[SavedSession]) -> list[SavedSession]:
    for profile in saved:
        profiles.save(profile, overwrite=False)
    return profiles.list()

@app.delete("/api/saved-sessions/{profile_id}")
async def delete_session_profile(profile_id: str) -> dict[str, bool]:
    profiles.delete(profile_id)
    return {"deleted": True}

@app.get("/api/sessions")
async def list_sessions() -> list[dict[str, Any]]:
    return store.list()

@app.post("/api/sessions", response_model=SessionResponse)
async def create_session(request: ConnectRequest) -> SessionResponse:
    try:
        session = await store.create(request)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if request.savedSessionId:
        for profile in profiles.list():
            if profile.id == request.savedSessionId:
                profile.lastUsedAt = _now_iso()
                profiles.save(profile)
                break
    return SessionResponse(session_id=session.session_id, snapshot=session.snapshot())


@app.get("/api/sessions/{session_id}", response_model=DeviceSnapshot)
async def get_session_snapshot(session_id: str) -> DeviceSnapshot:
    try:
        session = store.get(session_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Session not found.") from exc
    return session.snapshot()


@app.get("/api/sessions/{session_id}/logs", response_model=LogResponse)
async def get_session_logs(session_id: str, command: str = "ERRlog") -> LogResponse:
    try:
        session = store.get(session_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Session not found.") from exc

    requested_command = command.strip()
    if not requested_command:
        raise HTTPException(status_code=400, detail="Log command is required.")

    try:
        raw_output = await session._run_command(requested_command)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    cleaned_output = _strip_command_echo(raw_output, requested_command)
    return LogResponse(
        command=requested_command,
        fetched_at=_now_iso(),
        entries=_parse_log_entries(cleaned_output),
        raw=cleaned_output,
    )


@app.delete("/api/sessions/{session_id}")
async def delete_session(session_id: str) -> dict[str, bool]:
    await store.delete(session_id)
    return {"deleted": True}
