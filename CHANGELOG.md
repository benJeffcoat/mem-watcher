# Changelog

## 2026-10-28

### Sessions
- Persist saved connection profiles in backend SQLite storage and migrate existing browser profiles without overwriting backend copies.
- Restore active sessions and their telemetry after refreshing the browser. Connections close only when explicitly disconnected or the backend stops.
- Keep SSH passwords in memory; saved profiles do not contain passwords.
- Refresh session cards, connection forms and navigation controls.

### Performance
- Export session details, RAM/CPU charts and the first ten process rows as a timestamped PNG.
- Preserve SVG chart colours and expand the exported table without changing the live table.
- Retain the full RAM history and display a smoothed, sampled trend with hover values and timestamps.
- Merge CPU utilisation, 1/5/15-minute load averages, CPU/memory trend overlays and cache/shared/buffer memory details from upstream.
- Retain explanatory help for load averages and memory details.

### Device logs
- Request ERRlog, PRINTAUDITLOG, GETAUDITLOG or a custom console command through the active SSH session.
- Parse log entries, filter by severity/source and copy the visible output.
- Reset log controls when switching sessions without cascading state-update effects.

### Validation
- Frontend production build, ESLint and isolated backend/API and chart-rendering checks.
- Live SSH/device behaviour requires verification against the target processor.
