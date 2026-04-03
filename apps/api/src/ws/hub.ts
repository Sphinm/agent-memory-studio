import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import type { IncomingMessage } from "http";

interface WsClient {
  ws: WebSocket;
  sessionIds: Set<string>;
}

export class WsHub {
  private wss: WebSocketServer | null = null;
  private clients = new Set<WsClient>();

  attach(server: Server) {
    this.wss = new WebSocketServer({ server, path: "/ws" });

    this.wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
      const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
      const sessionId = url.searchParams.get("sessionId");

      const client: WsClient = {
        ws,
        sessionIds: new Set(sessionId ? [sessionId] : []),
      };
      this.clients.add(client);

      ws.on("message", (raw) => {
        try {
          const msg = JSON.parse(String(raw));
          if (msg.type === "subscribe" && msg.sessionId) {
            client.sessionIds.add(msg.sessionId);
          }
          if (msg.type === "unsubscribe" && msg.sessionId) {
            client.sessionIds.delete(msg.sessionId);
          }
        } catch {
          // ignore malformed messages
        }
      });

      ws.on("close", () => {
        this.clients.delete(client);
      });

      ws.send(JSON.stringify({ type: "connected" }));
    });
  }

  broadcast(sessionId: string, event: string, data: unknown) {
    const payload = JSON.stringify({ event, sessionId, data, ts: new Date().toISOString() });
    for (const client of this.clients) {
      if (client.sessionIds.has(sessionId) && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(payload);
      }
    }
  }
}
