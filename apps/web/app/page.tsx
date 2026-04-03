import { api } from "../lib/api-client";
import Link from "next/link";
import NewSessionButton from "../components/NewSessionButton";

export default async function DashboardPage() {
  const [health, sessions, agents] = await Promise.all([
    api.health(),
    api.sessions.list({ limit: 10 }).catch(() => []),
    api.agents.list().catch(() => []),
  ]);

  const isHealthy = health.status === "ok";
  const openSessions = sessions.filter((s) => s.status === "open");

  return (
    <div className="container">
      <div className="header">
        <h1>Agent Memory Studio</h1>
        <span className="status">
          <span className={`dot ${isHealthy ? "dot--ok" : "dot--err"}`} />
          API {isHealthy ? "Connected" : "Unavailable"}
        </span>
      </div>

      <div className="stat-row">
        <div className="stat">
          <div className="value">{sessions.length}</div>
          <div className="label">Sessions</div>
        </div>
        <div className="stat">
          <div className="value">{openSessions.length}</div>
          <div className="label">Active</div>
        </div>
        <div className="stat">
          <div className="value">{agents.length}</div>
          <div className="label">Agents</div>
        </div>
      </div>

      <div className="section">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Sessions</h2>
          <NewSessionButton />
        </div>
        {sessions.length === 0 ? (
          <div className="empty">
            No sessions yet. Click &quot;+ New Session&quot; to start.
          </div>
        ) : (
          <div className="grid">
            {sessions.map((s) => (
              <Link key={s.id} href={`/sessions/${s.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                <div className="card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <strong style={{ fontSize: 15 }}>{s.title || "Untitled Session"}</strong>
                    <span className={`badge badge--${s.status}`}>{s.status}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
                    Started {new Date(s.startedAt).toLocaleString()}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>
                    ID: {s.id.slice(0, 8)}…
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="section">
        <h2>Agents</h2>
        {agents.length === 0 ? (
          <div className="empty">No agents registered.</div>
        ) : (
          <div className="grid">
            {agents.map((a) => (
              <div key={a.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <strong style={{ fontSize: 15 }}>{a.displayName}</strong>
                  <span className={`badge badge--${a.kind === "bot" ? "active" : "open"}`}>{a.kind}</span>
                </div>
                {a.capabilities.length > 0 && (
                  <div style={{ marginTop: 6 }}>
                    {a.capabilities.map((c) => (
                      <span key={c.name} className="tag">{c.name}</span>
                    ))}
                  </div>
                )}
                <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 8 }}>
                  ID: {a.id.slice(0, 8)}…
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
