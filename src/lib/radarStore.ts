import { normalizeMapId } from "./mapData";

export interface ExecutorPos {
  x?: number | string;
  y?: number | string;
  z?: number | string;
}

export interface ExecutorPlayer {
  steamid?: string;
  steamId?: string;
  id?: string;
  name?: string;
  playerName?: string;
  team?: "CT" | "T" | string | number;
  health?: number | string;
  hp?: number | string;
  armor?: number | string;
  ap?: number | string;
  alive?: boolean | string | number;
  isAlive?: boolean | string | number;
  m_bIsAlive?: boolean | string | number;
  pos?: ExecutorPos | [number, number, number] | number[] | string;
  position?: ExecutorPos | [number, number, number] | number[] | string;
  origin?: ExecutorPos | [number, number, number] | number[] | string;
  m_vecOrigin?: ExecutorPos | [number, number, number] | number[] | string;
  x?: number | string;
  y?: number | string;
  z?: number | string;
  yaw?: number | string;
  angle?: number | string;
  rotation?: number | string;
  eyeAngles?: { y?: number | string; yaw?: number | string };
  current_weapon?: string;
  currentWeapon?: string;
  activeWeapon?: string;
  weapon?: string;
}

export interface ExecutorBomb {
  pos?: ExecutorPos | [number, number, number] | number[] | string;
  position?: ExecutorPos | [number, number, number] | number[] | string;
  origin?: ExecutorPos | [number, number, number] | number[] | string;
  m_vecOrigin?: ExecutorPos | [number, number, number] | number[] | string;
  x?: number | string;
  y?: number | string;
  z?: number | string;
}

export interface ExecutorSmoke {
  id?: string;
  pos?: ExecutorPos | [number, number, number] | number[] | string;
  position?: ExecutorPos | [number, number, number] | number[] | string;
  origin?: ExecutorPos | [number, number, number] | number[] | string;
  m_vecOrigin?: ExecutorPos | [number, number, number] | number[] | string;
  x?: number | string;
  y?: number | string;
  z?: number | string;
  type?: string;
  name?: string;
  className?: string;
}

export interface ExecutorMolotov {
  id?: string;
  pos?: ExecutorPos | [number, number, number] | number[] | string;
  position?: ExecutorPos | [number, number, number] | number[] | string;
  origin?: ExecutorPos | [number, number, number] | number[] | string;
  m_vecOrigin?: ExecutorPos | [number, number, number] | number[] | string;
  x?: number | string;
  y?: number | string;
  z?: number | string;
  type?: string;
  name?: string;
  className?: string;
}

export interface ExecutorGun {
  id?: string | number;
  name?: string;
  type?: string;
  weapon?: string;
  weaponName?: string;
  className?: string;
  item?: string;
  pos?: ExecutorPos | [number, number, number] | number[] | string;
  position?: ExecutorPos | [number, number, number] | number[] | string;
  origin?: ExecutorPos | [number, number, number] | number[] | string;
  m_vecOrigin?: ExecutorPos | [number, number, number] | number[] | string;
  x?: number | string;
  y?: number | string;
  z?: number | string;
}

export interface ExecutorPayload {
  map?: string;
  mapName?: string;
  map_name?: string;
  currentMap?: string;
  players?: ExecutorPlayer[] | Record<string, ExecutorPlayer>;
  playerList?: ExecutorPlayer[] | Record<string, ExecutorPlayer>;
  bomb?: ExecutorBomb | null;
  c4?: ExecutorBomb | null;
  optional?: {
    utils?: Record<string, unknown>;
    [key: string]: unknown;
  } & Record<string, unknown>;
  smokes?: unknown;
  smoke?: unknown;
  molotovs?: unknown;
  molotov?: unknown;
  infernos?: unknown;
  inferno?: unknown;
  guns?: unknown;
  gun?: unknown;
  weapons?: unknown;
  weapon?: unknown;
  dropped_weapons?: unknown;
  droppedWeapons?: unknown;
  dropped_guns?: unknown;
  droppedGuns?: unknown;
  entities?: unknown;
  world_entities?: unknown;
  worldEntities?: unknown;
  grenades?: unknown;
  projectiles?: unknown;
  utils?: unknown;
  utilities?: unknown;
  [key: string]: unknown;
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
  currentWeapon?: string;
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
  var __rawRadarState: unknown | undefined;
  // eslint-disable-next-line no-var
  var __lastBombHolderId: string | null | undefined;
  // eslint-disable-next-line no-var
  var __lastKnownGroundBomb: BombData | null | undefined;
  // eslint-disable-next-line no-var
  var __lastKnownMap: string | undefined;
}

export function cleanWeaponName(rawName: string): string {
  let name = String(rawName || "").trim();
  if (!name) return "Gun";

  // Strip common engine prefixes
  name = name.replace(/^weapon_/i, "");
  name = name.replace(/^cweapon/i, "");
  name = name.replace(/^c_/i, "");
  name = name.replace(/^item_/i, "");

  const lower = name.toLowerCase().replace(/[-_\s]/g, "");

  // Map known weapon identifiers to standard CS2 clean names
  const weaponMap: Record<string, string> = {
    ak47: "AK-47",
    m4a1silencer: "M4A1-S",
    m4a1s: "M4A1-S",
    m4a1: "M4A4",
    m4a4: "M4A4",
    awp: "AWP",
    deagle: "Deagle",
    deserteagle: "Deagle",
    uspsilencer: "USP-S",
    usps: "USP-S",
    usp: "USP-S",
    glock: "Glock-18",
    glock18: "Glock-18",
    ssg08: "SSG 08",
    scout: "SSG 08",
    galilar: "Galil AR",
    galil: "Galil AR",
    famas: "FAMAS",
    aug: "AUG",
    sg556: "SG 553",
    sg553: "SG 553",
    p250: "P250",
    cz75a: "CZ75-Auto",
    cz75auto: "CZ75-Auto",
    cz75: "CZ75-Auto",
    fiveseven: "Five-SeveN",
    tec9: "Tec-9",
    revolver: "R8 Revolver",
    r8revolver: "R8 Revolver",
    mp9: "MP9",
    mac10: "MAC-10",
    mp7: "MP7",
    mp5sd: "MP5-SD",
    ump45: "UMP-45",
    p90: "P90",
    bizon: "PP-Bizon",
    ppbizon: "PP-Bizon",
    mag7: "MAG-7",
    nova: "Nova",
    sawedoff: "Sawed-Off",
    xm1014: "XM1014",
    m249: "M249",
    negev: "Negev",
    scar20: "SCAR-20",
    g3sg1: "G3SG1",
    taser: "Zeus x27",
    zeus: "Zeus x27",
    c4: "C4",
  };

  if (weaponMap[lower]) {
    return weaponMap[lower];
  }

  // Formatting for other names
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function extractPos(
  item: unknown
): { x: number; y: number; z: number; isValid: boolean } {
  if (!item) {
    return { x: 0, y: 0, z: 0, isValid: false };
  }

  // 1. Direct array: [x, y, z]
  if (Array.isArray(item)) {
    const x = Number(item[0]);
    const y = Number(item[1]);
    const z = Number(item[2]) || 0;
    if (!isNaN(x) && !isNaN(y)) {
      return { x, y, z: isNaN(z) ? 0 : z, isValid: true };
    }
    return { x: 0, y: 0, z: 0, isValid: false };
  }

  // 2. String representation: "123.4, 567.8, 90.0" or "123.4 567.8 90.0"
  if (typeof item === "string") {
    const parts = item.split(/[,\s]+/).map(Number).filter((n) => !isNaN(n));
    if (parts.length >= 2) {
      return { x: parts[0], y: parts[1], z: parts[2] || 0, isValid: true };
    }
    return { x: 0, y: 0, z: 0, isValid: false };
  }

  if (typeof item !== "object") {
    return { x: 0, y: 0, z: 0, isValid: false };
  }

  const obj = item as Record<string, unknown>;

  // 3. Nested coordinate object: item.pos, item.position, item.origin, item.m_vecOrigin, item.coords, etc.
  const rawPos =
    obj.pos ??
    obj.position ??
    obj.origin ??
    obj.vecOrigin ??
    obj.m_vecOrigin ??
    obj.coords ??
    obj.coord ??
    obj.location ??
    obj.m_vOldOrigin;

  if (rawPos && rawPos !== obj) {
    const fromRaw = extractPos(rawPos);
    if (fromRaw.isValid) return fromRaw;
  }

  // 4. Flat properties: obj.x, obj.posX, obj.pos_x, obj.X, obj.origin_x, etc.
  const x = Number(obj.x ?? obj.X ?? obj.posX ?? obj.pos_x ?? obj.origin_x);
  const y = Number(obj.y ?? obj.Y ?? obj.posY ?? obj.pos_y ?? obj.origin_y);
  const z = Number(obj.z ?? obj.Z ?? obj.posZ ?? obj.pos_z ?? obj.origin_z ?? 0);

  if (!isNaN(x) && !isNaN(y)) {
    return { x, y, z: isNaN(z) ? 0 : z, isValid: true };
  }

  return { x: 0, y: 0, z: 0, isValid: false };
}

function toList(val: unknown): unknown[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === "object") {
    return Object.values(val as Record<string, unknown>).filter(Boolean);
  }
  return [];
}

export function transformExecutorPayload(exec: ExecutorPayload): RadarPayload {
  if (!exec || typeof exec !== "object") {
    return {
      map: global.__lastKnownMap || "de_dust2",
      players: [],
      timestamp: Date.now(),
    };
  }

  const mapName = String(
    exec.map ?? exec.mapName ?? exec.map_name ?? exec.currentMap ?? global.__lastKnownMap ?? "de_dust2"
  );
  const normalizedMap = normalizeMapId(mapName);
  global.__lastKnownMap = normalizedMap;

  // 1. Transform Players (from players, playerList, entities, etc. - array or object)
  const rawPlayersList = toList(exec.players ?? exec.playerList ?? exec.player_list ?? exec.clients);
  const usedIds = new Set<string>();

  const transformedPlayers: PlayerData[] = rawPlayersList.map((rawP: unknown, index: number) => {
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
    } else if (p.eyeAngles && typeof (p.eyeAngles as Record<string, unknown>).yaw === "number") {
      yaw = (p.eyeAngles as Record<string, unknown>).yaw as number;
    }

    // Extract Team (CT / T / 3 / 2 / etc.)
    const rawTeam = String(p.team ?? p.teamNum ?? p.m_iTeamNum ?? p.side ?? "").trim().toUpperCase();
    const team: "CT" | "T" = (
      rawTeam === "CT" ||
      rawTeam === "3" ||
      rawTeam.includes("COUNTER") ||
      rawTeam.startsWith("C")
    ) ? "CT" : "T";

    // Extract Health & Armor
    const rawHp = Number(p.health ?? p.hp ?? p.m_iHealth ?? p.m_health);
    const health = isNaN(rawHp) ? 100 : Math.max(0, Math.min(100, rawHp));
    const rawArmor = Number(p.armor ?? p.ap ?? p.armorValue ?? p.m_ArmorValue);
    const armor = isNaN(rawArmor) ? 0 : Math.max(0, Math.min(100, rawArmor));

    // Extract Alive state
    let isAlive = true;
    if (p.alive !== undefined) {
      isAlive = Boolean(p.alive && p.alive !== "false" && p.alive !== 0);
    } else if (p.isAlive !== undefined) {
      isAlive = Boolean(p.isAlive && p.isAlive !== "false" && p.isAlive !== 0);
    } else if (p.m_bIsAlive !== undefined) {
      isAlive = Boolean(p.m_bIsAlive && p.m_bIsAlive !== "false" && p.m_bIsAlive !== 0);
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

    const rawWeapon = String(
      p.current_weapon ?? p.currentWeapon ?? p.weapon ?? p.activeWeapon ?? ""
    ).trim();
    const currentWeapon = rawWeapon ? cleanWeaponName(rawWeapon) : undefined;

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
      currentWeapon,
    };
  });

  // 2. Bomb carrier detection & (0,0) Holster Fix
  let bombData: BombData | null = null;
  const rawBomb = exec.bomb ?? exec.c4 ?? exec.planted_c4 ?? exec.plantedC4;
  const bombPos = extractPos(rawBomb);

  // In CS2 coordinate space, (0,0) or near 0,0 is unequipped/holstered state origin
  const isZeroCoord = bombPos.isValid && Math.abs(bombPos.x) < 2 && Math.abs(bombPos.y) < 2;

  if (bombPos.isValid && !isZeroCoord) {
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
  } else {
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

  // 3. Extract Smokes (from all possible keys and formats)
  const allSmokesRaw = [
    ...toList(exec.smokes),
    ...toList(exec.smoke),
    ...toList(exec.smokegrenades),
    ...toList(exec.smoke_grenades),
    ...toList(exec.optional?.smokes),
    ...toList(exec.optional?.smoke),
    ...toList(exec.optional?.utils?.smokes),
    ...toList(exec.optional?.utils?.smoke),
  ];

  // 4. Extract Molotovs / Infernos / Fires (from all possible keys and formats)
  const allMolosRaw = [
    ...toList(exec.molotovs),
    ...toList(exec.molotov),
    ...toList(exec.infernos),
    ...toList(exec.inferno),
    ...toList(exec.fire),
    ...toList(exec.fires),
    ...toList(exec.incendiaries),
    ...toList(exec.incendiary),
    ...toList(exec.optional?.molotovs),
    ...toList(exec.optional?.molotov),
    ...toList(exec.optional?.infernos),
    ...toList(exec.optional?.inferno),
    ...toList(exec.optional?.utils?.molotovs),
    ...toList(exec.optional?.utils?.infernos),
  ];

  // Check general grenades/projectiles/utils list for typed items
  const generalGrenades = [
    ...toList(exec.grenades),
    ...toList(exec.projectiles),
    ...toList(exec.utils),
    ...toList(exec.utilities),
    ...toList(exec.optional?.utils),
  ];

  for (const g of generalGrenades) {
    if (!g || typeof g !== "object") continue;
    const gObj = g as Record<string, unknown>;
    const tag = String(gObj.type || gObj.name || gObj.className || gObj.class || "").toLowerCase();
    if (tag.includes("smoke")) {
      allSmokesRaw.push(g);
    } else if (
      tag.includes("molotov") ||
      tag.includes("inferno") ||
      tag.includes("fire") ||
      tag.includes("incendiary") ||
      tag.includes("inc")
    ) {
      allMolosRaw.push(g);
    }
  }

  const smokes: SmokeData[] = allSmokesRaw
    .map((rawS, idx) => {
      const pos = extractPos(rawS);
      if (!pos.isValid) return null;
      const sObj = (rawS && typeof rawS === "object" ? rawS : {}) as Record<string, unknown>;
      const sId = String(sObj.id || sObj.entityId || sObj.handle || sObj.index || `smoke_${Math.round(pos.x)}_${Math.round(pos.y)}_${idx}`);
      return {
        id: sId,
        x: pos.x,
        y: pos.y,
        z: pos.z,
      };
    })
    .filter((s): s is SmokeData => s !== null);

  const molotovs: MolotovData[] = allMolosRaw
    .map((rawM, idx) => {
      const pos = extractPos(rawM);
      if (!pos.isValid) return null;
      const mObj = (rawM && typeof rawM === "object" ? rawM : {}) as Record<string, unknown>;
      const mId = String(mObj.id || mObj.entityId || mObj.handle || mObj.index || `molo_${Math.round(pos.x)}_${Math.round(pos.y)}_${idx}`);
      return {
        id: mId,
        x: pos.x,
        y: pos.y,
        z: pos.z,
      };
    })
    .filter((m): m is MolotovData => m !== null);

  // 5. Extract Dropped Guns / Weapons (from all possible keys and formats)
  const allGunsRaw = [
    ...toList(exec.guns),
    ...toList(exec.gun),
    ...toList(exec.weapons),
    ...toList(exec.weapon),
    ...toList(exec.dropped_weapons),
    ...toList(exec.droppedWeapons),
    ...toList(exec.dropped_guns),
    ...toList(exec.droppedGuns),
    ...toList(exec.world_entities),
    ...toList(exec.worldEntities),
    ...toList(exec.entities),
    ...toList(exec.items),
    ...toList(exec.optional?.gun),
    ...toList(exec.optional?.guns),
    ...toList(exec.optional?.weapon),
    ...toList(exec.optional?.weapons),
    ...toList(exec.optional?.dropped_weapons),
    ...toList(exec.optional?.droppedWeapons),
    ...toList(exec.optional?.entities),
    ...toList(exec.optional?.world_entities),
    ...toList(exec.optional?.utils?.weapons),
    ...toList(exec.optional?.utils?.guns),
  ];

  const guns: GunData[] = allGunsRaw
    .map((rawG, idx) => {
      const g = (rawG && typeof rawG === "object" ? rawG : {}) as Record<string, unknown>;
      const pos = extractPos(g);
      if (!pos.isValid) return null;

      const rawWeaponName = String(
        g.name || g.weapon || g.weaponName || g.className || g.type || g.item || g.id || "Weapon"
      ).trim();

      // Don't classify general smokes/molotovs or bomb as dropped guns if in generic entity lists
      const lower = rawWeaponName.toLowerCase();
      if (
        lower.includes("smoke") ||
        lower.includes("inferno") ||
        lower.includes("molotov") ||
        lower.includes("player")
      ) {
        return null;
      }

      const cleanName = cleanWeaponName(rawWeaponName);
      const stableId = String(
        g.id || g.entityId || g.handle || g.index || `gun_${cleanName}_${Math.round(pos.x)}_${Math.round(pos.y)}_${idx}`
      );

      return {
        id: stableId,
        name: cleanName,
        x: pos.x,
        y: pos.y,
        z: pos.z,
      };
    })
    .filter((g): g is GunData => g !== null);

  const transformed: RadarPayload = {
    map: normalizedMap,
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

export function getRadarRawState(): unknown | undefined {
  return global.__rawRadarState;
}

export function setRadarRawState(raw: unknown): void {
  global.__rawRadarState = raw;
}

export function setRadarState(payload: RadarPayload | undefined): void {
  global.__radarState = payload;
  if (!payload) {
    global.__lastBombHolderId = null;
    global.__lastKnownGroundBomb = null;
    global.__rawRadarState = undefined;
  }
}