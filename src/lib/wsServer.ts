import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import {
  type RadarPayload,
  type ExecutorPayload,
  transformExecutorPayload,
} from "./radarStore";

declare global {
  // eslint-disable-next-line no-var
  var __wss: WebSocketServer | undefined;
  // eslint-disable-next-line no-var
  var __radarState: RadarPayload | undefined;
}

export function getOrCreateWSS(): WebSocketServer {
  if (global.__wss) return global.__wss;

  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (ws: WebSocket) => {
    // Only send state if it is recent (within last 8 seconds)
    if (global.__radarState && global.__radarState.timestamp) {
      const isRecent = Date.now() - global.__radarState.timestamp < 8000;
      if (isRecent) {
        try {
          ws.send(JSON.stringify(global.__radarState));
        } catch {
          /* ignore */
        }
      }
    }

    // Handle messages sent directly through WebSocket from executor
    ws.on("message", (raw: Buffer | string) => {
      try {
        const text = raw.toString();
        const parsed = JSON.parse(text);
        if (parsed) {
          if (parsed.type === "CLEAR") {
            clearRadarState();
          } else if (parsed.map && Array.isArray(parsed.players)) {
            broadcastExecutorPayload(parsed as ExecutorPayload);
          }
        }
      } catch {
        /* ignore invalid json */
      }
    });

    ws.on("error", () => {
      /* ignore socket errors */
    });
  });

  global.__wss = wss;
  return wss;
}

export function broadcastRadarState(payload: RadarPayload): void {
  global.__radarState = {
    ...payload,
    timestamp: Date.now(),
  };

  const wss = getOrCreateWSS();
  const data = JSON.stringify(global.__radarState);

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(data);
      } catch {
        /* ignore */
      }
    }
  });
}

export function broadcastExecutorPayload(exec: ExecutorPayload): RadarPayload {
  const transformed = transformExecutorPayload(exec);
  broadcastRadarState(transformed);
  return transformed;
}

export function clearRadarState(): void {
  global.__radarState = undefined;
  const wss = getOrCreateWSS();
  const clearMsg = JSON.stringify({ type: "CLEARED", map: "de_dust2", players: [] });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(clearMsg);
      } catch {
        /* ignore */
      }
    }
  });
}

export function getCurrentRadarState(): RadarPayload | undefined {
  return global.__radarState;
}

export function handleUpgrade(
  req: IncomingMessage,
  socket: import("net").Socket,
  head: Buffer
): void {
  const wss = getOrCreateWSS();
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws, req);
  });
}
