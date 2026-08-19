import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import {
  type RadarPayload,
  type ExecutorPayload,
  transformExecutorPayload,
  setRadarRawState,
  getRadarRawState,
} from "./radarStore";

declare global {
  // eslint-disable-next-line no-var
  var __wss: WebSocketServer | undefined;
  // eslint-disable-next-line no-var
  var __radarState: RadarPayload | undefined;
  // eslint-disable-next-line no-var
  var __rawRadarState: unknown | undefined;
}

export function getOrCreateWSS(): WebSocketServer {
  if (global.__wss) return global.__wss;

  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (ws: WebSocket) => {
    // Send state on connection if recent
    if (global.__radarState && global.__radarState.timestamp) {
      const isRecent = Date.now() - global.__radarState.timestamp < 15000;
      if (isRecent) {
        try {
          const raw = getRadarRawState() ?? global.__radarState;
          ws.send(JSON.stringify({
            ...global.__radarState,
            _raw: raw,
          }));
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
        if (parsed && typeof parsed === "object") {
          if (parsed.type === "CLEAR") {
            clearRadarState();
          } else {
            broadcastExecutorPayload(parsed);
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

export function broadcastRadarState(payload: RadarPayload, rawBody?: unknown): void {
  global.__radarState = {
    ...payload,
    timestamp: Date.now(),
  };
  const rawToStore = rawBody !== undefined ? rawBody : payload;
  setRadarRawState(rawToStore);

  const wss = getOrCreateWSS();
  const data = JSON.stringify({
    ...global.__radarState,
    _raw: rawToStore,
  });

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

export function broadcastExecutorPayload(exec: unknown): RadarPayload {
  const transformed = transformExecutorPayload(exec as ExecutorPayload);
  broadcastRadarState(transformed, exec);
  return transformed;
}

export function clearRadarState(): void {
  global.__radarState = undefined;
  setRadarRawState(undefined);
  const wss = getOrCreateWSS();
  const clearMsg = JSON.stringify({ type: "CLEARED", map: "de_dust2", players: [], _raw: null });
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

