import { normalizeMapId } from "./mapData";

export interface ExecutorPos {
  x?: number;
  y?: number;
  z?: number;
}

export interface ExecutorPlayer {
  steamid?: string;
  steamId?: string;
  id?: string;
  name?: string;
  playerName?: string;
  team?: "CT" | "T" | string;
  health?: number;
  hp?: number;
  armor?: number;
  ap?: number;
  alive?: boolean | string | number;
  isAlive?: boolean | string | number;
  pos?: ExecutorPos | [number, number, number] | number[];
  x?: number;
  y?: number;
  z?: number;
  yaw?: number | string;
  angle?: number;
  rotation?: number;
}

export interface ExecutorBomb {
  pos?: ExecutorPos | [number, number, number] | number[];
  x?: number;
  y?: number;
  z?: number;
}

export interface ExecutorSmoke {
  pos?: ExecutorPos | [number, number, number] | number[];
  x?: number;
  y?: number;
  z?: number;
}

export interface ExecutorMolotov {
  pos?: ExecutorPos | [number, number, number] | number[];
  x?: number;
  y?: number;
  z?: number;
}

export interface ExecutorGun {
  id?: string;
  name?: string;
  pos?: ExecutorPos | [number, number, number] | number[];
  x?: number;
  y?: number;
  z?: number;
}

export interface ExecutorPayload {
  map: string;
  players: ExecutorPlayer[];
  bomb?: ExecutorBomb | null;
  optional?: {
    utils?: {
      smokes?: ExecutorSmoke[];
      molotovs?: ExecutorMolotov[];
    };
    smokes?: ExecutorSmoke[];
    molotovs?: ExecutorMolotov[];
    gun?: ExecutorGun | ExecutorGun[];
    guns?: ExecutorGun | ExecutorGun[];
  };
  smokes?: ExecutorSmoke[];
  molotovs?: ExecutorMolotov[];
  guns?: ExecutorGun | ExecutorGun[];
  gun?: ExecutorGun | ExecutorGun[];
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
  hasBomb?: boolean;
}

export interface BombData {
  x: number;
  y: number;
  z: number;
  isCarried?: boolean;
  carrierId?: string | null;
}

export interface SmokeData {
  id: string;
  x: number;
  y: number;
  z: number;
}

export interface MolotovData {
  id: string;
  x: number;
  y: number;
  z: number;
}

export interface GunData {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
}

export interface RadarPayload {
  map: string;
  players: PlayerData[];
  bomb?: BombData | null;
  smokes?: SmokeData[];
  molotovs?: MolotovData[];
  guns?: GunData[];
  timestamp?: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __radarState: RadarPayload | undefined;
  // eslint-disable-next-line no-var
  var __lastBombHolderId: string | null | undefined;
  // eslint-disable-next-line no-var
  var __lastKnownGroundBomb: BombData | null | undefined;
}

function extractPos(
  item: Record<string, unknown> | undefined | null
): { x: number; y: number; z: number; isValid: boolean } {
  if (!item || typeof item !== "object") {
    return { x: 0, y: 0, z: 0, isValid: false };
  }

  const rawPos = item.pos as Record<string, unknown> | number[] | undefined;
  let x = NaN;
  let y = NaN;
  let z = 0;

  if (rawPos && typeof rawPos === "object") {
    if (Array.isArray(rawPos)) {
      x = Number(rawPos[0]);
      y = Number(rawPos[1]);
      z = Number(rawPos[2]) || 0;
    } else {
      x = Number(rawPos.x ?? item.x ?? item.posX);
      y = Number(rawPos.y ?? item.y ?? item.posY);
      z = Number(rawPos.z ?? item.z ?? item.posZ ?? 0);
    }
  } else {
    x = Number(item.x ?? item.posX);
    y = Number(item.y ?? item.posY);
    z = Number(item.z ?? item.posZ ?? 0);
  }

  if (isNaN(x) || isNaN(y)) {
    return { x: 0, y: 0, z: 0, isValid: false };
  }

  return { x, y, z: isNaN(z) ? 0 : z, isValid: true };
}

export function transformExecutorPayload(exec: ExecutorPayload): RadarPayload {
  const rawPlayers = Array.isArray(exec.players) ? exec.players : [];
  const usedIds = new Set<string>();

  // 1. Transform Players first
  const transformedPlayers: PlayerData[] = rawPlayers.map((rawP: unknown, index: number) => {
    const p = (rawP && typeof rawP === "object" ? rawP : {}) as Record<string, unknown>;
    const pos = extractPos(p);

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
      x: pos.x,
      y: pos.y,
      z: pos.z,
      yaw,
      health,
      armor,
      isAlive,
      hasBomb: false,
    };
  });

  // 2. Bomb carrier detection & (0,0) Holster Fix
  let bombData: BombData | null = null;
  const rawBomb = exec.bomb as Record<string, unknown> | undefined | null;
  const bombPos = extractPos(rawBomb);

  // In CS2 coordinate space, (0,0) or near 0,0 is unequipped/holstered state origin
  const isZeroCoord = bombPos.isValid && Math.abs(bombPos.x) < 2 && Math.abs(bombPos.y) < 2;

  if (bombPos.isValid && !isZeroCoord) {
    // We have a REAL non-zero coordinate from the game
    // Check if any alive T player is at/near this coordinate (selected bomb in hand)
    const matchingCarrier = transformedPlayers.find(
      (p) => p.isAlive && p.team === "T" && Math.hypot(p.x - bombPos.x, p.y - bombPos.y) < 65
    );

    if (matchingCarrier) {
      global.__lastBombHolderId = matchingCarrier.id;
      bombData = {
        x: matchingCarrier.x,
        y: matchingCarrier.y,
        z: matchingCarrier.z,
        isCarried: true,
        carrierId: matchingCarrier.id,
      };
      matchingCarrier.hasBomb = true;
    } else {
      // Bomb is on the ground (dropped or planted)
      global.__lastBombHolderId = null;
      bombData = {
        x: bombPos.x,
        y: bombPos.y,
        z: bombPos.z,
        isCarried: false,
        carrierId: null,
      };
      global.__lastKnownGroundBomb = { ...bombData };
    }
  } else if (rawBomb !== undefined && rawBomb !== null) {
    // Bomb was sent, but coordinates are (0,0) because the holder selected another weapon
    const lastHolderId = global.__lastBombHolderId;
    const currentHolder = lastHolderId
      ? transformedPlayers.find((p) => p.id === lastHolderId && p.isAlive && p.team === "T")
      : null;

    if (currentHolder) {
      // The holder still has the bomb in inventory!
      bombData = {
        x: currentHolder.x,
        y: currentHolder.y,
        z: currentHolder.z,
        isCarried: true,
        carrierId: currentHolder.id,
      };
      currentHolder.hasBomb = true;
    } else if (global.__lastKnownGroundBomb) {
      // Holder died or bomb dropped, stay at last known ground drop location
      bombData = { ...global.__lastKnownGroundBomb };
    }
  } else {
    // If no bomb object in payload, check if holder exists or fallback to ground
    const lastHolderId = global.__lastBombHolderId;
    const currentHolder = lastHolderId
      ? transformedPlayers.find((p) => p.id === lastHolderId && p.isAlive && p.team === "T")
      : null;
    if (currentHolder) {
      bombData = {
        x: currentHolder.x,
        y: currentHolder.y,
        z: currentHolder.z,
        isCarried: true,
        carrierId: currentHolder.id,
      };
      currentHolder.hasBomb = true;
    } else if (global.__lastKnownGroundBomb) {
      bombData = { ...global.__lastKnownGroundBomb };
    }
  }

  // 3. Extract Smokes (from optional.utils.smokes, optional.smokes, or smokes)
  const rawSmokesList =
    exec.optional?.utils?.smokes ??
    exec.optional?.smokes ??
    exec.smokes ??
    [];

  const smokes: SmokeData[] = (Array.isArray(rawSmokesList) ? rawSmokesList : [])
    .map((rawS, idx) => {
      const pos = extractPos(rawS as Record<string, unknown>);
      if (!pos.isValid || (Math.abs(pos.x) < 1 && Math.abs(pos.y) < 1)) return null;
      return {
        id: `smoke_${idx}`,
        x: pos.x,
        y: pos.y,
        z: pos.z,
      };
    })
    .filter((s): s is SmokeData => s !== null);

  // 4. Extract Molotovs (from optional.utils.molotovs, optional.molotovs, or molotovs)
  const rawMolotovsList =
    exec.optional?.utils?.molotovs ??
    exec.optional?.molotovs ??
    exec.molotovs ??
    [];

  const molotovs: MolotovData[] = (Array.isArray(rawMolotovsList) ? rawMolotovsList : [])
    .map((rawM, idx) => {
      const pos = extractPos(rawM as Record<string, unknown>);
      if (!pos.isValid || (Math.abs(pos.x) < 1 && Math.abs(pos.y) < 1)) return null;
      return {
        id: `molotov_${idx}`,
        x: pos.x,
        y: pos.y,
        z: pos.z,
      };
    })
    .filter((m): m is MolotovData => m !== null);

  // 5. Extract Dropped Guns (from optional.gun, optional.guns, guns, or gun; array or single object)
  const rawGunsField =
    exec.optional?.gun ??
    exec.optional?.guns ??
    exec.guns ??
    exec.gun ??
    [];

  const rawGunsList = Array.isArray(rawGunsField)
    ? rawGunsField
    : rawGunsField && typeof rawGunsField === "object"
    ? [rawGunsField]
    : [];

  const guns: GunData[] = rawGunsList
    .map((rawG, idx) => {
      const g = (rawG && typeof rawG === "object" ? rawG : {}) as Record<string, unknown>;
      const pos = extractPos(g);
      if (!pos.isValid || (Math.abs(pos.x) < 1 && Math.abs(pos.y) < 1)) return null;
      const name = String(g.id || g.name || "Weapon").trim() || "Weapon";
      return {
        id: `gun_${idx}_${name}`,
        name,
        x: pos.x,
        y: pos.y,
        z: pos.z,
      };
    })
    .filter((g): g is GunData => g !== null);

  const transformed: RadarPayload = {
    map: normalizeMapId(exec.map || "de_dust2"),
    timestamp: Date.now(),
    bomb: bombData,
    players: transformedPlayers,
    smokes,
    molotovs,
    guns,
  };

  global.__radarState = transformed;
  return transformed;
}

export function getRadarState(): RadarPayload | undefined {
  return global.__radarState;
}

export function setRadarState(payload: RadarPayload | undefined): void {
  global.__radarState = payload;
  if (!payload) {
    global.__lastBombHolderId = null;
    global.__lastKnownGroundBomb = null;
  }
}