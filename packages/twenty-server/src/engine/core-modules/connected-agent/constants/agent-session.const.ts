// A connected agent's bridge session is considered active if its lastSeenAt
// (refreshed by connect/heartbeat/events) is within this window. Writes by an
// agent whose session has lapsed are rejected until it reconnects.
export const AGENT_SESSION_TTL_MS = 300_000; // 5 minutes
