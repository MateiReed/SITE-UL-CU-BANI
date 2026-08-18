export interface ExecutorPlayer {
  steamid: string;
  name: string;
  team: "CT" | "T";
  health: number;
  armor: number;
  alive: boolean;
  pos: {
    x: number;
    y: number;
    z: number;
  };
  yaw: number;
}

export interface ExecutorBomb {
  pos?: {
    x: number;
    y: number;
    z: number;
  };
}

export interface ExecutorPayload {
  map: string;
  players: ExecutorPlayer[];
  bomb?: ExecutorBomb | null;
}

export interface PlayerData {
  id: string;
  name: string;
  team: "T" | "CT";
  x: number;
  y: number;
  z: number;
  yaw: number;
  health: number;
  armor: number;
  isAlive: boolean;
}

export interface BombData {
  x: number;
  y: number;
  z: number;
}

export interface RadarPayload {
  map: string;
  players: PlayerData[];
  bomb?: BombData | null;
  timestamp?: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __radarState: RadarPayload | undefined;
}

export function transformExecutorPayload(exec: ExecutorPayload): RadarPayload {
  let bombData: BombData | null = null;
  if (
    exec.bomb?.pos &&
    typeof exec.bomb.pos.x === "number" &&
    typeof exec.bomb.pos.y === "number"
  ) {
    bombData = {
      x: exec.bomb.pos.x,
      y: exec.bomb.pos.y,
      z: typeof exec.bomb.pos.z === "number" ? exec.bomb.pos.z : 0,
    };
  }

  const transformed: RadarPayload = {
    map: exec.map || "de_dust2",
    timestamp: Date.now(),
    bomb: bombData,
    players: (exec.players || []).map((p) => ({
      id: p.steamid || "",
      name: p.name || "Unknown",
      team: p.team === "CT" ? "CT" : "T",
      x: typeof p.pos?.x === "number" ? p.pos.x : 0,
      y: typeof p.pos?.y === "number" ? p.pos.y : 0,
      z: typeof p.pos?.z === "number" ? p.pos.z : 0,
      yaw: typeof p.yaw === "number" ? p.yaw : 0,
      health: Math.max(0, Math.min(100, typeof p.health === "number" ? p.health : 100)),
      armor: Math.max(0, Math.min(100, typeof p.armor === "number" ? p.armor : 0)),
      isAlive: Boolean(p.alive),
    })),
  };

  global.__radarState = transformed;
  return transformed;
}

export function getRadarState(): RadarPayload | undefined {
  return global.__radarState;
}

export function setRadarState(payload: RadarPayload | undefined): void {
  global.__radarState = payload;
}
