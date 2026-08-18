import { normalizeMapId } from "./mapData";

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
  const rawBomb = exec.bomb as Record<string, unknown> | undefined | null;
  if (rawBomb) {
    const bPos = rawBomb.pos as Record<string, unknown> | undefined;
    const bx = Number(bPos?.x ?? rawBomb.x ?? rawBomb.posX);
    const by = Number(bPos?.y ?? rawBomb.y ?? rawBomb.posY);
    const bz = Number(bPos?.z ?? rawBomb.z ?? rawBomb.posZ ?? 0);
    if (!isNaN(bx) && !isNaN(by)) {
      bombData = { x: bx, y: by, z: isNaN(bz) ? 0 : bz };
    }
  }

  const rawPlayers = Array.isArray(exec.players) ? exec.players : [];
  const usedIds = new Set<string>();

  const transformedPlayers: PlayerData[] = rawPlayers.map((rawP: unknown, index: number) => {
    const p = (rawP && typeof rawP === "object" ? rawP : {}) as Record<string, unknown>;
    const rawPos = p.pos as Record<string, unknown> | number[] | undefined;

    // Extract position (pos.x, pos[0], p.x, etc.)
    let x = 0;
    let y = 0;
    let z = 0;

    if (rawPos && typeof rawPos === "object") {
      if (Array.isArray(rawPos)) {
        x = Number(rawPos[0]) || 0;
        y = Number(rawPos[1]) || 0;
        z = Number(rawPos[2]) || 0;
      } else {
        x = Number(rawPos.x ?? p.x ?? p.posX) || 0;
        y = Number(rawPos.y ?? p.y ?? p.posY) || 0;
        z = Number(rawPos.z ?? p.z ?? p.posZ) || 0;
      }
    } else {
      x = Number(p.x ?? p.posX) || 0;
      y = Number(p.y ?? p.posY) || 0;
      z = Number(p.z ?? p.posZ) || 0;
    }

    // Extract Yaw
    let yaw = 0;
    if (typeof p.yaw === "number") yaw = p.yaw;
    else if (typeof p.yaw === "string") yaw = Number(p.yaw) || 0;
    else if (typeof p.angle === "number") yaw = p.angle;
    else if (typeof p.rotation === "number") yaw = p.rotation;
    else if (p.eyeAngles && typeof (p.eyeAngles as Record<string, unknown>).y === "number") {
      yaw = (p.eyeAngles as Record<string, unknown>).y as number;
    }

    // Extract Team (CT / T / 3 / 2 / etc.)
    const rawTeam = String(p.team ?? "").trim().toUpperCase();
    const team: "CT" | "T" = (
      rawTeam === "CT" ||
      rawTeam === "3" ||
      rawTeam.includes("COUNTER") ||
      rawTeam.startsWith("C")
    ) ? "CT" : "T";

    // Extract Health & Armor
    const rawHp = Number(p.health ?? p.hp);
    const health = isNaN(rawHp) ? 100 : Math.max(0, Math.min(100, rawHp));
    const rawArmor = Number(p.armor ?? p.ap);
    const armor = isNaN(rawArmor) ? 0 : Math.max(0, Math.min(100, rawArmor));

    // Extract Alive state
    let isAlive = true;
    if (p.alive !== undefined) {
      isAlive = Boolean(p.alive && p.alive !== "false" && p.alive !== 0);
    } else if (p.isAlive !== undefined) {
      isAlive = Boolean(p.isAlive && p.isAlive !== "false" && p.isAlive !== 0);
    } else if (p.m_bIsAlive !== undefined) {
      isAlive = Boolean(p.m_bIsAlive);
    } else {
      isAlive = health > 0;
    }

    // Extract Name
    const name = String(p.name || p.playerName || `Player ${index + 1}`).trim() || `Player ${index + 1}`;

    // Extract & Guarantee UNIQUE ID for every player so no players are overwritten
    const baseId = String(
      p.steamid ?? p.steamId ?? p.id ?? p.userid ?? p.userId ?? p.slot ?? p.index ?? ""
    ).trim();

    let finalId = (baseId && baseId !== "0" && baseId !== "null" && baseId !== "undefined")
      ? baseId
      : `${name}_${index}`;

    if (usedIds.has(finalId)) {
      finalId = `${finalId}_${index}`;
    }
    usedIds.add(finalId);

    return {
      id: finalId,
      name,
      team,
      x,
      y,
      z,
      yaw,
      health,
      armor,
      isAlive,
    };
  });

  const transformed: RadarPayload = {
    map: normalizeMapId(exec.map || "de_dust2"),
    timestamp: Date.now(),
    bomb: bombData,
    players: transformedPlayers,
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