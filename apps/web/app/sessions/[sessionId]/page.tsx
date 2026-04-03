import { api } from "../../../lib/api-client";
import Link from "next/link";
import ChatPanel from "../../../components/ChatPanel";

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

export default async function SessionPage({ params }: PageProps) {
  const { sessionId } = await params;

  const [session, allMemories] = await Promise.all([
    api.sessions.get(sessionId),
    api.sessions.getMemories(sessionId),
  ]);

  const activeMemories = allMemories.filter((m) => m.status === "active");
  const goals = allMemories.filter((m) => m.kind === "goal" && m.status === "active");
  const facts = allMemories.filter((m) => m.kind === "fact" && m.status === "active");

  return (
    <div className="container">
      <div className="header">
        <div>
          <Link href="/" style={{ fontSize: 13, color: "var(--text-dim)" }}>
            ← Dashboard
          </Link>
          <h1 style={{ marginTop: 4 }}>{session.title || "Untitled Session"}</h1>
        </div>
        <span className={`badge badge--${session.status}`}>{session.status}</span>
      </div>

      <div className="session-layout">
        <div className="session-chat">
          <div className="section">
            <h2>Chat</h2>
          </div>
          <ChatPanel sessionId={sessionId} />
        </div>

        <div className="session-sidebar">
          <div className="stat-row" style={{ flexDirection: "column" }}>
            <div className="stat">
              <div className="value">{allMemories.length}</div>
              <div className="label">Memories</div>
            </div>
            <div className="stat">
              <div className="value">{activeMemories.length}</div>
              <div className="label">Active</div>
            </div>
          </div>

          {goals.length > 0 && (
            <div className="section">
              <h2>Goals</h2>
              <div className="card" style={{ padding: 12 }}>
                {goals.map((g) => (
                  <div key={g.id} style={{ padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
                    {g.title || g.content}
                  </div>
                ))}
              </div>
            </div>
          )}

          {facts.length > 0 && (
            <div className="section">
              <h2>Facts</h2>
              <div className="card" style={{ padding: 12 }}>
                {facts.map((f) => (
                  <div key={f.id} style={{ padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
                    {f.content}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="section">
            <h2>All Memories ({allMemories.length})</h2>
            {allMemories.length === 0 ? (
              <div className="empty" style={{ padding: 20 }}>No memories yet.</div>
            ) : (
              <div className="card" style={{ padding: 12 }}>
                {allMemories.map((m) => (
                  <div key={m.id} className="memory-item" style={{ padding: "8px 0" }}>
                    <span className={`badge badge--${m.kind}`} style={{ fontSize: 10, padding: "1px 6px" }}>{m.kind}</span>
                    <span style={{ flex: 1, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {m.title || m.content}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
