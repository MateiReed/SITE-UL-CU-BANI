"use client";

import React, {
  useRef,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { worldToFraction, getMapInfo, MAPS, normalizeMapId } from "@/lib/mapData";
import type { MapInfo } from "@/lib/mapData";
import type {
  RadarPayload,
  PlayerData,
  BombData,
  SmokeData,
  MolotovData,
  GunData,
} from "@/lib/radarStore";

interface InterpolatedPlayer extends PlayerData {
  rx: number;
  ry: number;
  tx: number;
  ty: number;
  deathTimestamp?: number;
  wasAlive?: boolean;
}

interface InterpolatedBomb extends BombData {
  rx: number;
  ry: number;
  tx: number;
  ty: number;
}

interface InterpolatedUtility {
  id: string;
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  tx: number;
  ty: number;
  name?: string;
  bornTime: number;
}

export interface RadarCanvasProps {
  mapId: string;
  payload: RadarPayload | null;
  onFpsUpdate?: (fps: number) => void;
  showGrid?: boolean;
  showNames?: boolean;
  showVisionCones?: boolean;
  showSmokes?: boolean;
  showMolotovs?: boolean;
  showGuns?: boolean;
  radarZoom?: number;
  focusedPlayerId?: string | null;
  isFollowingPlayer?: boolean;
  onSelectPlayer?: (playerId: string | null) => void;
  onZoomChange?: (zoom: number) => void;
}

export interface RadarCanvasHandle {
  getCanvas: () => HTMLCanvasElement | null;
  resetView: () => void;
}

// ─── Visual Constants ────────────────────────────────────────────────────────
const BASE_PLAYER_RADIUS = 9.5;
const FOCUSED_PLAYER_RADIUS = 14.5;
const CONE_LENGTH = 28;
const CONE_HALF_ANGLE = Math.PI / 6; // 30°

const HEALTH_BAR_W = 24;
const FOCUSED_HEALTH_BAR_W = 34;
const HEALTH_BAR_H = 3.5;
const ARMOR_BAR_H = 2.5;

const COLOR_T = "#f59e0b"; // CS2 Terrorist Amber/Yellow
const COLOR_CT = "#38bdf8"; // CS2 CT Cyan/Blue
const COLOR_T_GLOW = "rgba(245, 158, 11, 0.6)";
const COLOR_CT_GLOW = "rgba(56, 189, 248, 0.6)";
const COLOR_T_DEAD = "#78350f";
const COLOR_CT_DEAD = "#0c4a6e";

const COLOR_CONE_T = "rgba(245, 158, 11, 0.4)";
const COLOR_CONE_CT = "rgba(56, 189, 248, 0.4)";

const COLOR_HP_BG = "rgba(10, 15, 29, 0.85)";
const COLOR_HP_HIGH = "#10b981";
const COLOR_HP_MID = "#f59e0b";
const COLOR_HP_LOW = "#ef4444";
const COLOR_ARMOR = "#06b6d4";
const COLOR_DEAD_X = "#f43f5e";

// ─── Image Cache & Preloading ────────────────────────────────────────────────
const imageCache = new Map<string, HTMLImageElement>();

function preloadRadarImages() {
  if (typeof window === "undefined") return;
  MAPS.forEach((map) => {
    if (map.image && !imageCache.has(map.id)) {
      const img = new Image();
      img.src = map.image;
      img.onload = () => {
        imageCache.set(map.id, img);
      };
    }
  });
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function getGunColor(name: string): { bg: string; border: string; text: string } {
  const upper = name.toUpperCase();
  if (upper.includes("AWP") || upper.includes("SSG") || upper.includes("SCAR") || upper.includes("G3SG1")) {
    return { bg: "rgba(168, 85, 247, 0.2)", border: "#c084fc", text: "#e9d5ff" }; // Snipers (Purple)
  }
  if (upper.includes("AK") || upper.includes("M4") || upper.includes("GALIL") || upper.includes("FAMAS") || upper.includes("AUG") || upper.includes("SG")) {
    return { bg: "rgba(245, 158, 11, 0.2)", border: "#fb923c", text: "#ffedd5" }; // Rifles (Amber/Orange)
  }
  if (upper.includes("DEAGLE") || upper.includes("DESERT") || upper.includes("USP") || upper.includes("GLOCK") || upper.includes("P250") || upper.includes("FIVE") || upper.includes("CZ") || upper.includes("REVOLVER")) {
    return { bg: "rgba(56, 189, 248, 0.2)", border: "#38bdf8", text: "#e0f2fe" }; // Pistols (Cyan)
  }
  if (upper.includes("MP9") || upper.includes("MAC") || upper.includes("MP7") || upper.includes("MP5") || upper.includes("UMP") || upper.includes("P90") || upper.includes("BIZON")) {
    return { bg: "rgba(52, 211, 153, 0.2)", border: "#34d399", text: "#d1fae5" }; // SMGs (Green)
  }
  return { bg: "rgba(148, 163, 184, 0.15)", border: "#94a3b8", text: "#f1f5f9" };
}

function drawMapBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  mapId: string,
  mapInfo: MapInfo,
  showGrid: boolean,
  offsetX: number,
  offsetY: number,
  size: number
): void {
  const img = imageCache.get(mapId);

  ctx.fillStyle = "#060913";
  ctx.fillRect(0, 0, w, h);

  if (img && img.complete && img.naturalWidth > 0) {
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, offsetX, offsetY, size, size);

    const grad = ctx.createRadialGradient(
      offsetX + size / 2,
      offsetY + size / 2,
      size * 0.3,
      offsetX + size / 2,
      offsetY + size / 2,
      size * 0.72
    );
    grad.addColorStop(0, "rgba(6, 9, 19, 0.0)");
    grad.addColorStop(1, "rgba(6, 9, 19, 0.5)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  } else {
    ctx.save();
    ctx.strokeStyle = "rgba(51, 65, 85, 0.35)";
    ctx.lineWidth = 1;
    const step = 45;
    for (let x = 0; x <= w; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y <= h; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    ctx.globalAlpha = 0.09;
    ctx.fillStyle = mapInfo.accent;
    ctx.font = `900 ${Math.floor(
      w / 6
    )}px ui-monospace, SFMono-Regular, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(mapInfo.displayName.toUpperCase(), w / 2, h / 2);
    ctx.restore();
  }

  // Tactical Reticle Grid
  if (showGrid) {
    ctx.save();
    ctx.strokeStyle = "rgba(148, 163, 184, 0.12)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);

    ctx.beginPath();
    ctx.moveTo(offsetX + size / 2, 0);
    ctx.lineTo(offsetX + size / 2, h);
    ctx.moveTo(0, offsetY + size / 2);
    ctx.lineTo(w, offsetY + size / 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(
      offsetX + size / 2,
      offsetY + size / 2,
      size * 0.25,
      0,
      Math.PI * 2
    );
    ctx.arc(
      offsetX + size / 2,
      offsetY + size / 2,
      size * 0.45,
      0,
      Math.PI * 2
    );
    ctx.stroke();
    ctx.restore();
  }

  // Corner HUD Bracket Accents
  const cornerLen = 24;
  ctx.save();
  ctx.strokeStyle = mapInfo.accent;
  ctx.lineWidth = 2.5;
  ctx.shadowColor = mapInfo.accent;
  ctx.shadowBlur = 8;

  // TL
  ctx.beginPath();
  ctx.moveTo(12, 12 + cornerLen);
  ctx.lineTo(12, 12);
  ctx.lineTo(12 + cornerLen, 12);
  ctx.stroke();

  // TR
  ctx.beginPath();
  ctx.moveTo(w - 12 - cornerLen, 12);
  ctx.lineTo(w - 12, 12);
  ctx.lineTo(w - 12, 12 + cornerLen);
  ctx.stroke();

  // BL
  ctx.beginPath();
  ctx.moveTo(12, h - 12 - cornerLen);
  ctx.lineTo(12, h - 12);
  ctx.lineTo(12 + cornerLen, h - 12);
  ctx.stroke();

  // BR
  ctx.beginPath();
  ctx.moveTo(w - 12 - cornerLen, h - 12);
  ctx.lineTo(w - 12, h - 12);
  ctx.lineTo(w - 12, h - 12 - cornerLen);
  ctx.stroke();
  ctx.restore();
}

// ─── Draw Smokes ─────────────────────────────────────────────────────────────
function drawSmoke(
  ctx: CanvasRenderingContext2D,
  smoke: InterpolatedUtility,
  cx: number,
  cy: number,
  mapInfo: MapInfo,
  size: number,
  now: number
): void {
  if (isNaN(cx) || isNaN(cy)) return;
  ctx.save();

  // Calculate actual smoke radius from world scale (CS2 smoke radius ~ 144 world units)
  const span = mapInfo.scale * 1024;
  const worldRadius = 148;
  const pixelRadius = Math.max(16, (worldRadius / span) * size);

  // Soft breathing animation
  const pulse = Math.sin(now * 0.003 + smoke.x * 0.01) * 0.05 + 1; // 0.95..1.05
  const rad = pixelRadius * pulse;

  // Multi-layered radial smoke cloud
  const smokeGrad = ctx.createRadialGradient(
    cx,
    cy,
    rad * 0.15,
    cx,
    cy,
    rad
  );
  smokeGrad.addColorStop(0, "rgba(220, 230, 245, 0.72)");
  smokeGrad.addColorStop(0.45, "rgba(160, 175, 195, 0.55)");
  smokeGrad.addColorStop(0.8, "rgba(100, 116, 139, 0.35)");
  smokeGrad.addColorStop(1, "rgba(71, 85, 105, 0.0)");

  ctx.fillStyle = smokeGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, rad, 0, Math.PI * 2);
  ctx.fill();

  // Subtle outer boundary ring
  ctx.strokeStyle = "rgba(203, 213, 225, 0.4)";
  ctx.lineWidth = 1.2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.arc(cx, cy, rad * 0.96, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Tactical Smoke Icon / Badge at center
  ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
  ctx.strokeStyle = "rgba(203, 213, 225, 0.6)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, 7.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#e2e8f0";
  ctx.font = "bold 8px ui-monospace, SFMono-Regular, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("💨", cx, cy + 0.5);

  ctx.restore();
}

// ─── Draw Molotovs ───────────────────────────────────────────────────────────
function drawMolotov(
  ctx: CanvasRenderingContext2D,
  molo: InterpolatedUtility,
  cx: number,
  cy: number,
  mapInfo: MapInfo,
  size: number,
  now: number
): void {
  if (isNaN(cx) || isNaN(cy)) return;
  ctx.save();

  // Calculate actual molotov radius from world scale (CS2 fire radius ~ 155 world units)
  const span = mapInfo.scale * 1024;
  const worldRadius = 155;
  const pixelRadius = Math.max(16, (worldRadius / span) * size);

  // Dynamic fiery flickering animation
  const flicker = Math.sin(now * 0.008 + molo.x * 0.02) * 0.08 + 1;
  const rad = pixelRadius * flicker;

  // Multi-layered fiery radial gradient
  const fireGrad = ctx.createRadialGradient(
    cx,
    cy,
    rad * 0.15,
    cx,
    cy,
    rad
  );
  fireGrad.addColorStop(0, "rgba(254, 240, 138, 0.8)");
  fireGrad.addColorStop(0.35, "rgba(249, 115, 22, 0.65)");
  fireGrad.addColorStop(0.75, "rgba(220, 38, 38, 0.4)");
  fireGrad.addColorStop(1, "rgba(185, 28, 28, 0.0)");

  ctx.fillStyle = fireGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, rad, 0, Math.PI * 2);
  ctx.fill();

  // Pulsing flame shockwave ring
  const pulse = (Math.sin(now * 0.006 + molo.y * 0.01) + 1) / 2;
  ctx.strokeStyle = `rgba(249, 115, 22, ${0.4 + pulse * 0.4})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, rad * (0.85 + pulse * 0.15), 0, Math.PI * 2);
  ctx.stroke();

  // Tactical Flame Icon / Badge at center
  ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
  ctx.strokeStyle = "rgba(249, 115, 22, 0.9)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, 7.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#fde047";
  ctx.font = "bold 8px ui-monospace, SFMono-Regular, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("🔥", cx, cy + 0.5);

  ctx.restore();
}

// ─── Draw Dropped Weapons ────────────────────────────────────────────────────
function drawDroppedGun(
  ctx: CanvasRenderingContext2D,
  gun: InterpolatedUtility,
  cx: number,
  cy: number
): void {
  if (isNaN(cx) || isNaN(cy)) return;
  ctx.save();

  const name = gun.name || "Gun";
  const styling = getGunColor(name);

  ctx.font = "bold 8.5px ui-monospace, SFMono-Regular, Menlo, monospace";
  const metrics = ctx.measureText(name);
  const badgeW = metrics.width + 12;
  const badgeH = 13;

  const bx = cx - badgeW / 2;
  const by = cy - badgeH / 2;

  // Background box with weapon category theme
  ctx.fillStyle = "rgba(8, 12, 22, 0.92)";
  ctx.strokeStyle = styling.border;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(bx, by, badgeW, badgeH, 3.5);
  ctx.fill();
  ctx.stroke();

  // Small weapon dot / category indicator on left
  ctx.fillStyle = styling.border;
  ctx.beginPath();
  ctx.arc(bx + 4.5, cy, 2, 0, Math.PI * 2);
  ctx.fill();

  // Weapon Name Text
  ctx.fillStyle = styling.text;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(name, bx + 9, cy + 0.5);

  ctx.restore();
}

// ─── Draw C4 Bomb Marker (Dropped on Ground) ──────────────────────────────────
function drawBomb(
  ctx: CanvasRenderingContext2D,
  bomb: InterpolatedBomb,
  cx: number,
  cy: number,
  mapInfo: MapInfo,
  now: number
): void {
  if (isNaN(cx) || isNaN(cy)) return;
  ctx.save();

  // Pulsing Shockwave Alert Ring
  const pulse = (Math.sin(now * 0.006) + 1) / 2; // 0..1
  const waveRadius = 12 + pulse * 14;
  ctx.strokeStyle = `rgba(239, 68, 68, ${0.8 - pulse * 0.6})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, waveRadius, 0, Math.PI * 2);
  ctx.stroke();

  // Outer C4 Glow Box
  ctx.shadowColor = "rgba(239, 68, 68, 0.9)";
  ctx.shadowBlur = 14;

  const boxSize = 18;
  ctx.fillStyle = "#ef4444";
  ctx.beginPath();
  ctx.roundRect(
    cx - boxSize / 2,
    cy - boxSize / 2,
    boxSize,
    boxSize,
    4
  );
  ctx.fill();
  ctx.shadowBlur = 0;

  // White Border
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // C4 Icon Text
  ctx.fillStyle = "#ffffff";
  ctx.font =
    "900 10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("C4", cx, cy + 0.5);

  // Label: C4 BOMB
  const labelY = cy - boxSize / 2 - 4;
  ctx.font = "bold 9px ui-monospace, SFMono-Regular, monospace";
  const metrics = ctx.measureText("C4 BOMB");

  ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
  ctx.strokeStyle = "rgba(239, 68, 68, 0.6)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(
    cx - metrics.width / 2 - 4,
    labelY - 11,
    metrics.width + 8,
    12,
    3
  );
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#fca5a5";
  ctx.fillText("C4 BOMB", cx, labelY);

  // Vertical Level Arrow (Z-level)
  const zDelta = bomb.z - mapInfo.zMid;
  const zThreshold = 75;
  if (Math.abs(zDelta) > zThreshold) {
    const isUp = zDelta > 0;
    const ax = cx + boxSize / 2 + 4.5;
    const ay = cy;
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    if (isUp) {
      ctx.moveTo(ax, ay - 5);
      ctx.lineTo(ax + 4, ay + 3);
      ctx.lineTo(ax - 4, ay + 3);
    } else {
      ctx.moveTo(ax, ay + 5);
      ctx.lineTo(ax + 4, ay - 3);
      ctx.lineTo(ax - 4, ay - 3);
    }
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  p: InterpolatedPlayer,
  cx: number,
  cy: number,
  mapInfo: MapInfo,
  showNames: boolean,
  showVisionCones: boolean,
  now: number,
  isFocused: boolean = false,
  isFollowed: boolean = false
): boolean {
  if (isNaN(cx) || isNaN(cy)) return false;
  const isT = p.team === "T";
  const alive = p.isAlive;
  const hasBomb = Boolean(p.hasBomb);

  let opacity = 1.0;

  if (!alive) {
    if (!p.deathTimestamp) {
      p.deathTimestamp = now;
    }
    // Stay fully visible for 1s, then fade out over the next 1s
    const deathAge = now - (p.deathTimestamp ?? now);
    const HOLD_MS = 1000;   // full-opacity hold time
    const FADE_MS = 1000;   // fade-out duration after hold
    if (deathAge <= HOLD_MS) {
      opacity = 0.85;
    } else {
      const fadeProgress = Math.min(1, (deathAge - HOLD_MS) / FADE_MS);
      opacity = 0.85 * (1 - fadeProgress);
    }
    // Skip drawing entirely once fully faded
    if (opacity <= 0.01) {
      return false;
    }
  }

  const currentRadius = isFocused ? FOCUSED_PLAYER_RADIUS : BASE_PLAYER_RADIUS;

  ctx.save();
  ctx.globalAlpha = opacity;

  // ── Focused Player Animated Beacon / Pulsing Rings ──────────────
  if (isFocused && alive) {
    ctx.save();
    const pulse1 = (now * 0.002) % 1; // 0..1
    const pulse2 = (now * 0.002 + 0.5) % 1; // 0..1

    const ringColor = isT ? "245, 158, 11" : "56, 189, 248";

    // Shockwave 1
    const r1 = currentRadius + pulse1 * 26;
    const a1 = (1 - pulse1) * 0.75;
    ctx.strokeStyle = `rgba(${ringColor}, ${a1})`;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(cx, cy, r1, 0, Math.PI * 2);
    ctx.stroke();

    // Shockwave 2
    const r2 = currentRadius + pulse2 * 26;
    const a2 = (1 - pulse2) * 0.75;
    ctx.strokeStyle = `rgba(${ringColor}, ${a2})`;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(cx, cy, r2, 0, Math.PI * 2);
    ctx.stroke();

    // Steady Outer Target Ring with Corner Reticles
    const targetRingRadius = currentRadius + 5.5;
    ctx.strokeStyle = isT ? "#fde047" : "#a5f3fc";
    ctx.lineWidth = 1.8;
    ctx.shadowColor = isT ? "rgba(245, 158, 11, 0.9)" : "rgba(56, 189, 248, 0.9)";
    ctx.shadowBlur = 14;

    ctx.beginPath();
    ctx.arc(cx, cy, targetRingRadius, 0, Math.PI * 2);
    ctx.stroke();

    // 4 Corner Tactical Crosshair Reticle Ticks
    const tickLen = 6;
    const tickDist = targetRingRadius + 2.5;
    ctx.lineWidth = 2;
    ctx.strokeStyle = isT ? "#fbbf24" : "#38bdf8";

    // Top
    ctx.beginPath();
    ctx.moveTo(cx, cy - tickDist);
    ctx.lineTo(cx, cy - tickDist - tickLen);
    ctx.stroke();

    // Bottom
    ctx.beginPath();
    ctx.moveTo(cx, cy + tickDist);
    ctx.lineTo(cx, cy + tickDist + tickLen);
    ctx.stroke();

    // Left
    ctx.beginPath();
    ctx.moveTo(cx - tickDist, cy);
    ctx.lineTo(cx - tickDist - tickLen, cy);
    ctx.stroke();

    // Right
    ctx.beginPath();
    ctx.moveTo(cx + tickDist, cy);
    ctx.lineTo(cx + tickDist + tickLen, cy);
    ctx.stroke();

    ctx.restore();
  }

  // ── FOV Vision Cone ──────────────────────────────────────────────
  if (alive && showVisionCones) {
    const yawRad = degToRad(-p.yaw);
    const dirX = Math.cos(yawRad);
    const dirY = Math.sin(yawRad);
    const coneLen = isFocused ? CONE_LENGTH + 6 : CONE_LENGTH;

    ctx.save();
    ctx.fillStyle = isT ? COLOR_CONE_T : COLOR_CONE_CT;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    const baseAngle = Math.atan2(dirY, dirX);
    const angleLeft = baseAngle - CONE_HALF_ANGLE;
    const angleRight = baseAngle + CONE_HALF_ANGLE;
    ctx.lineTo(
      cx + Math.cos(angleLeft) * coneLen,
      cy + Math.sin(angleLeft) * coneLen
    );
    ctx.arc(cx, cy, coneLen, angleLeft, angleRight, false);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = isT ? "#fde047" : "#7dd3fc";
    ctx.lineWidth = isFocused ? 2.2 : 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(
      cx + dirX * (currentRadius + 8),
      cy + dirY * (currentRadius + 8)
    );
    ctx.stroke();
    ctx.restore();
  }

  // ── Player Dot (Strictly centered on map pixel) ───────────────────
  const mainColor = alive
    ? isT
      ? isFocused ? "#fbbf24" : COLOR_T
      : isFocused ? "#38bdf8" : COLOR_CT
    : isT
    ? COLOR_T_DEAD
    : COLOR_CT_DEAD;

  if (alive) {
    ctx.shadowColor = isFocused
      ? isT ? "rgba(245, 158, 11, 0.95)" : "rgba(56, 189, 248, 0.95)"
      : hasBomb
      ? "rgba(239, 68, 68, 0.9)"
      : isT
      ? COLOR_T_GLOW
      : COLOR_CT_GLOW;
    ctx.shadowBlur = isFocused ? 24 : hasBomb ? 16 : 12;
  }

  ctx.beginPath();
  ctx.arc(cx, cy, currentRadius, 0, Math.PI * 2);
  ctx.fillStyle = mainColor;
  ctx.fill();
  ctx.shadowBlur = 0;

  // Dot Borders: Double crisp border for focused player
  if (isFocused) {
    ctx.strokeStyle = isT ? "#78350f" : "#082f49";
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2.2;
    ctx.stroke();
  } else {
    ctx.strokeStyle = hasBomb ? "#ef4444" : alive ? "#ffffff" : "rgba(255,255,255,0.4)";
    ctx.lineWidth = hasBomb ? 2.5 : 2;
    ctx.stroke();
  }

  if (alive) {
    ctx.fillStyle = isT ? "#1c1917" : "#082f49";
    const fontSize = isFocused ? 13 : 10;
    ctx.font = `900 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(p.team, cx, cy + (isFocused ? 0.5 : 0));
  }

  // ── C4 Bomb Carrier Badge attached to Player ─────────────────────
  if (alive && hasBomb) {
    const badgeX = cx + currentRadius + 2;
    const badgeY = cy - currentRadius - 2;
    
    // Pulsing C4 badge glow
    const bombPulse = (Math.sin(now * 0.008) + 1) / 2;
    ctx.fillStyle = "#ef4444";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.2;
    ctx.shadowColor = "rgba(239, 68, 68, 0.9)";
    ctx.shadowBlur = 8 + bombPulse * 6;

    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY - 6, 17, 12, 3);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = "#ffffff";
    ctx.font = "900 8px ui-monospace, SFMono-Regular, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("C4", badgeX + 8.5, badgeY);
  }

  // ── Death Circle with X ──────────────────────────────────────────
  if (!alive) {
    ctx.beginPath();
    ctx.arc(cx, cy, currentRadius + 1, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(244, 63, 94, 0.4)";
    ctx.fill();
    ctx.strokeStyle = COLOR_DEAD_X;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2.5;
    const xSize = isFocused ? 7.5 : 5.5;
    ctx.beginPath();
    ctx.moveTo(cx - xSize, cy - xSize);
    ctx.lineTo(cx + xSize, cy + xSize);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + xSize, cy - xSize);
    ctx.lineTo(cx - xSize, cy + xSize);
    ctx.stroke();

    if (p.deathTimestamp) {
      const deathElapsed = now - p.deathTimestamp;
      if (deathElapsed < 1200) {
        const waveProgress = deathElapsed / 1200;
        const waveRadius = currentRadius + waveProgress * 16;
        ctx.strokeStyle = `rgba(244, 63, 94, ${(1 - waveProgress) * 0.8})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, waveRadius, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  // ── Health & Armor Bars ──────────────────────────────────────────
  if (alive) {
    const barW = isFocused ? FOCUSED_HEALTH_BAR_W : HEALTH_BAR_W;
    const bx = cx - barW / 2;
    const by = cy + currentRadius + 4;

    ctx.fillStyle = COLOR_HP_BG;
    ctx.beginPath();
    ctx.roundRect(bx, by, barW, HEALTH_BAR_H, 2);
    ctx.fill();

    const hpW = (Math.max(0, Math.min(100, p.health)) / 100) * barW;
    const hpColor =
      p.health > 50
        ? COLOR_HP_HIGH
        : p.health > 20
        ? COLOR_HP_MID
        : COLOR_HP_LOW;

    ctx.fillStyle = hpColor;
    ctx.beginPath();
    ctx.roundRect(bx, by, hpW, HEALTH_BAR_H, 2);
    ctx.fill();

    if (p.armor > 0) {
      const aby = by + HEALTH_BAR_H + 1.5;
      ctx.fillStyle = COLOR_HP_BG;
      ctx.beginPath();
      ctx.roundRect(bx, aby, barW, ARMOR_BAR_H, 1.5);
      ctx.fill();

      const armorW =
        (Math.max(0, Math.min(100, p.armor)) / 100) * barW;
      ctx.fillStyle = COLOR_ARMOR;
      ctx.beginPath();
      ctx.roundRect(bx, aby, armorW, ARMOR_BAR_H, 1.5);
      ctx.fill();
    }
  }

  // ── Player Name Tag & Focus / Follow Badge ───────────────────────
  if (showNames || isFocused) {
    const labelY = cy - currentRadius - (isFocused ? 6 : 4);
    ctx.font =
      isFocused
        ? "bold 11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
        : "bold 10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";

    const baseTxt = p.name ? p.name.slice(0, 14) : "Player";
    const weaponSuffix = p.currentWeapon ? ` [${p.currentWeapon}]` : "";
    const prefix = isFollowed ? "🎯 TRACKING: " : isFocused ? "★ " : hasBomb ? "💣 " : "";
    const txt = `${prefix}${baseTxt}${weaponSuffix}`;
    const metrics = ctx.measureText(txt);

    ctx.fillStyle = isFocused
      ? isT ? "rgba(40, 20, 5, 0.94)" : "rgba(5, 25, 45, 0.94)"
      : "rgba(4, 7, 18, 0.88)";
    ctx.strokeStyle = isFocused
      ? isT ? "#f59e0b" : "#38bdf8"
      : hasBomb
      ? "rgba(239, 68, 68, 0.6)"
      : isT
      ? "rgba(245, 158, 11, 0.4)"
      : "rgba(56, 189, 248, 0.4)";
    ctx.lineWidth = isFocused ? 1.8 : 1;
    ctx.beginPath();
    ctx.roundRect(
      cx - metrics.width / 2 - 5,
      labelY - 13,
      metrics.width + 10,
      14,
      3.5
    );
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isFocused
      ? isT ? "#fef08a" : "#e0f2fe"
      : alive ? (hasBomb ? "#fca5a5" : "#f8fafc") : "rgba(203, 213, 225, 0.5)";
    ctx.fillText(txt, cx, labelY);
  }

  ctx.restore();
  return true;
}

const RadarCanvas = forwardRef<RadarCanvasHandle, RadarCanvasProps>(
  function RadarCanvas(
    {
      mapId,
      payload,
      onFpsUpdate,
      showGrid = true,
      showNames = true,
      showVisionCones = true,
      showSmokes = true,
      showMolotovs = true,
      showGuns = true,
      radarZoom = 1.0,
      focusedPlayerId = null,
      isFollowingPlayer = false,
      onSelectPlayer,
      onZoomChange,
    },
    ref
  ) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const stateRef = useRef<Map<string, InterpolatedPlayer>>(new Map());
    const bombRef = useRef<InterpolatedBomb | null>(null);
    const smokesRef = useRef<Map<string, InterpolatedUtility>>(new Map());
    const molotovsRef = useRef<Map<string, InterpolatedUtility>>(new Map());
    const gunsRef = useRef<Map<string, InterpolatedUtility>>(new Map());

    const rafRef = useRef<number>(0);
    const fpsRef = useRef({ frames: 0, lastTime: performance.now() });
    const lastFrameTimeRef = useRef<number>(0);
    const activeMapRef = useRef<string>(mapId);

    // Interactive Drag / Pan & Wheel Zoom State
    const panRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const isDraggingRef = useRef(false);
    const dragStartRef = useRef<{ x: number; y: number }>({
      x: 0,
      y: 0,
    });
    const pointerDownInfoRef = useRef<{ x: number; y: number; time: number } | null>(null);

    useImperativeHandle(ref, () => ({
      getCanvas: () => canvasRef.current,
      resetView: () => {
        panRef.current = { x: 0, y: 0 };
      },
    }));

    useEffect(() => {
      preloadRadarImages();
    }, []);

    // When map changes, reset pan
    useEffect(() => {
      panRef.current = { x: 0, y: 0 };
    }, [mapId]);

    // Track the last processed payload to avoid re-processing
    const lastPayloadRef = useRef<RadarPayload | null>(null);

    // Synchronous payload processing — runs inline every render
    if (payload !== lastPayloadRef.current) {
      lastPayloadRef.current = payload;

      if (!payload) {
        bombRef.current = null;
        stateRef.current.clear();
        smokesRef.current.clear();
        molotovsRef.current.clear();
        gunsRef.current.clear();
        activeMapRef.current = mapId;
      } else {
        const targetMap = normalizeMapId(payload.map || mapId);
        activeMapRef.current = targetMap;
        const mapInfo = getMapInfo(targetMap);
        const currentState = stateRef.current;
        const incomingIds = new Set<string>();
        const now = Date.now();

        // 1. Update Bomb interpolation target
        if (payload.bomb) {
          const { fx, fy } = worldToFraction(
            payload.bomb.x,
            payload.bomb.y,
            mapInfo
          );
          if (bombRef.current) {
            bombRef.current.tx = fx;
            bombRef.current.ty = fy;
            bombRef.current.x = payload.bomb.x;
            bombRef.current.y = payload.bomb.y;
            bombRef.current.z = payload.bomb.z;
            bombRef.current.isCarried = payload.bomb.isCarried;
            bombRef.current.carrierId = payload.bomb.carrierId;
          } else {
            bombRef.current = {
              ...payload.bomb,
              rx: fx,
              ry: fy,
              tx: fx,
              ty: fy,
            };
          }
        } else {
          bombRef.current = null;
        }

        // 2. Update ALL players interpolation targets
        const rawList = Array.isArray(payload.players) ? payload.players : [];
        for (let i = 0; i < rawList.length; i++) {
          const p = rawList[i];
          const playerId = String(p.id || `p_${i}`);
          incomingIds.add(playerId);
          const { fx, fy } = worldToFraction(p.x, p.y, mapInfo);
          const existing = currentState.get(playerId);

          if (existing) {
            if (existing.wasAlive && !p.isAlive) {
              existing.deathTimestamp = now;
            } else if (p.isAlive) {
              existing.deathTimestamp = undefined;
            }
            existing.wasAlive = p.isAlive;

            existing.id = playerId;
            existing.name = p.name;
            existing.team = p.team;
            existing.x = p.x;
            existing.y = p.y;
            existing.z = p.z;
            existing.yaw = p.yaw;
            existing.health = p.health;
            existing.armor = p.armor;
            existing.isAlive = p.isAlive;
            existing.hasBomb = p.hasBomb;
            existing.currentWeapon = p.currentWeapon;

            existing.tx = fx;
            existing.ty = fy;
          } else {
            const interp: InterpolatedPlayer = {
              ...p,
              id: playerId,
              rx: fx,
              ry: fy,
              tx: fx,
              ty: fy,
              wasAlive: p.isAlive,
              deathTimestamp: !p.isAlive ? now : undefined,
            };
            currentState.set(playerId, interp);
          }
        }

        // Clean up players no longer in payload
        currentState.forEach((p, id) => {
          if (!incomingIds.has(id)) {
            currentState.delete(id);
          }
        });

        // 3. Update Smokes
        const incomingSmokeIds = new Set<string>();
        const rawSmokes = Array.isArray(payload.smokes) ? payload.smokes : [];
        for (let i = 0; i < rawSmokes.length; i++) {
          const s = rawSmokes[i];
          const sId = s.id || `smoke_${i}`;
          incomingSmokeIds.add(sId);
          const { fx, fy } = worldToFraction(s.x, s.y, mapInfo);
          const existing = smokesRef.current.get(sId);
          if (existing) {
            existing.tx = fx;
            existing.ty = fy;
            existing.x = s.x;
            existing.y = s.y;
            existing.z = s.z;
          } else {
            smokesRef.current.set(sId, {
              id: sId,
              x: s.x,
              y: s.y,
              z: s.z,
              rx: fx,
              ry: fy,
              tx: fx,
              ty: fy,
              bornTime: now,
            });
          }
        }
        smokesRef.current.forEach((_, id) => {
          if (!incomingSmokeIds.has(id)) smokesRef.current.delete(id);
        });

        // 4. Update Molotovs
        const incomingMoloIds = new Set<string>();
        const rawMolos = Array.isArray(payload.molotovs) ? payload.molotovs : [];
        for (let i = 0; i < rawMolos.length; i++) {
          const m = rawMolos[i];
          const mId = m.id || `molo_${i}`;
          incomingMoloIds.add(mId);
          const { fx, fy } = worldToFraction(m.x, m.y, mapInfo);
          const existing = molotovsRef.current.get(mId);
          if (existing) {
            existing.tx = fx;
            existing.ty = fy;
            existing.x = m.x;
            existing.y = m.y;
            existing.z = m.z;
          } else {
            molotovsRef.current.set(mId, {
              id: mId,
              x: m.x,
              y: m.y,
              z: m.z,
              rx: fx,
              ry: fy,
              tx: fx,
              ty: fy,
              bornTime: now,
            });
          }
        }
        molotovsRef.current.forEach((_, id) => {
          if (!incomingMoloIds.has(id)) molotovsRef.current.delete(id);
        });

        // 5. Update Dropped Guns
        const incomingGunIds = new Set<string>();
        const rawGuns = Array.isArray(payload.guns) ? payload.guns : [];
        for (let i = 0; i < rawGuns.length; i++) {
          const g = rawGuns[i];
          const gId = g.id || `gun_${i}`;
          incomingGunIds.add(gId);
          const { fx, fy } = worldToFraction(g.x, g.y, mapInfo);
          const existing = gunsRef.current.get(gId);
          if (existing) {
            existing.tx = fx;
            existing.ty = fy;
            existing.x = g.x;
            existing.y = g.y;
            existing.z = g.z;
            existing.name = g.name;
          } else {
            gunsRef.current.set(gId, {
              id: gId,
              name: g.name,
              x: g.x,
              y: g.y,
              z: g.z,
              rx: fx,
              ry: fy,
              tx: fx,
              ty: fy,
              bornTime: now,
            });
          }
        }
        gunsRef.current.forEach((_, id) => {
          if (!incomingGunIds.has(id)) gunsRef.current.delete(id);
        });
      }
    }

    const animate = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const rect = canvas.getBoundingClientRect();
      const w = rect.width || canvas.width;
      const h = rect.height || canvas.height;
      const currentActiveMap = activeMapRef.current || normalizeMapId(mapId);
      const mapInfo = getMapInfo(currentActiveMap);

      // Base square size that fits in viewport
      const baseSize = Math.min(w, h);
      const size = baseSize * radarZoom;

      const now = performance.now();

      // Delta-time for frame-rate independent interpolation
      const deltaMs = lastFrameTimeRef.current > 0 ? Math.min(now - lastFrameTimeRef.current, 100) : 16.667;
      lastFrameTimeRef.current = now;
      const deltaS = deltaMs / 1000;
      // Time-based exponential smoothing: consistent speed regardless of fps or network jitter
      const smoothFactor = 1 - Math.exp(-20 * deltaS);
      fpsRef.current.frames++;
      if (now - fpsRef.current.lastTime >= 1000) {
        onFpsUpdate?.(fpsRef.current.frames);
        fpsRef.current.frames = 0;
        fpsRef.current.lastTime = now;
      }

      // ── Follow Mode Camera Tracking ──────────────────────────────
      if (isFollowingPlayer && focusedPlayerId) {
        const trackedPlayer = stateRef.current.get(focusedPlayerId);
        if (trackedPlayer && !isNaN(trackedPlayer.rx) && !isNaN(trackedPlayer.ry)) {
          // Camera centers trackedPlayer on viewport (w/2, h/2)
          const targetPanX = (0.5 - trackedPlayer.rx) * size;
          const targetPanY = (0.5 - trackedPlayer.ry) * size;
          if (!isDraggingRef.current) {
            const followSpeed = 1 - Math.exp(-15 * deltaS);
            panRef.current.x = lerp(panRef.current.x, targetPanX, followSpeed);
            panRef.current.y = lerp(panRef.current.y, targetPanY, followSpeed);
          }
        }
      }

      // Center offset + user pan offset
      const offsetX = (w - size) / 2 + panRef.current.x;
      const offsetY = (h - size) / 2 + panRef.current.y;

      ctx.clearRect(0, 0, w, h);
      drawMapBackground(
        ctx,
        w,
        h,
        currentActiveMap,
        mapInfo,
        showGrid,
        offsetX,
        offsetY,
        size
      );

      const realNow = Date.now();

      // ── 1. Draw Active Smokes (Under players) ─────────────────────
      if (showSmokes) {
        smokesRef.current.forEach((smoke) => {
          const dx = smoke.tx - smoke.rx;
          const dy = smoke.ty - smoke.ry;
          if (Math.hypot(dx, dy) > 0.1 || isNaN(smoke.rx)) {
            smoke.rx = smoke.tx;
            smoke.ry = smoke.ty;
          } else {
            smoke.rx = lerp(smoke.rx, smoke.tx, smoothFactor);
            smoke.ry = lerp(smoke.ry, smoke.ty, smoothFactor);
          }
          const scx = offsetX + smoke.rx * size;
          const scy = offsetY + smoke.ry * size;
          drawSmoke(ctx, smoke, scx, scy, mapInfo, size, realNow);
        });
      }

      // ── 2. Draw Active Molotovs (Under players) ───────────────────
      if (showMolotovs) {
        molotovsRef.current.forEach((molo) => {
          const dx = molo.tx - molo.rx;
          const dy = molo.ty - molo.ry;
          if (Math.hypot(dx, dy) > 0.1 || isNaN(molo.rx)) {
            molo.rx = molo.tx;
            molo.ry = molo.ty;
          } else {
            molo.rx = lerp(molo.rx, molo.tx, smoothFactor);
            molo.ry = lerp(molo.ry, molo.ty, smoothFactor);
          }
          const mcx = offsetX + molo.rx * size;
          const mcy = offsetY + molo.ry * size;
          drawMolotov(ctx, molo, mcx, mcy, mapInfo, size, realNow);
        });
      }

      // ── 3. Draw Dropped Weapons / Guns ───────────────────────────
      if (showGuns) {
        gunsRef.current.forEach((gun) => {
          const dx = gun.tx - gun.rx;
          const dy = gun.ty - gun.ry;
          if (Math.hypot(dx, dy) > 0.1 || isNaN(gun.rx)) {
            gun.rx = gun.tx;
            gun.ry = gun.ty;
          } else {
            gun.rx = lerp(gun.rx, gun.tx, smoothFactor);
            gun.ry = lerp(gun.ry, gun.ty, smoothFactor);
          }
          const gcx = offsetX + gun.rx * size;
          const gcy = offsetY + gun.ry * size;
          drawDroppedGun(ctx, gun, gcx, gcy);
        });
      }

      // ── 4. Draw C4 Bomb Marker (if dropped on ground) ────────────
      if (bombRef.current && !bombRef.current.isCarried) {
        const b = bombRef.current;
        const bdx = b.tx - b.rx;
        const bdy = b.ty - b.ry;
        if (Math.hypot(bdx, bdy) > 0.2 || isNaN(b.rx)) {
          b.rx = b.tx;
          b.ry = b.ty;
        } else {
          b.rx = lerp(b.rx, b.tx, smoothFactor);
          b.ry = lerp(b.ry, b.ty, smoothFactor);
        }
        const bcx = offsetX + b.rx * size;
        const bcy = offsetY + b.ry * size;
        drawBomb(ctx, b, bcx, bcy, mapInfo, realNow);
      }

      // ── 5. Draw Players (Focused player sorted to TOP layer) ─────
      const playerList = Array.from(stateRef.current.values());
      // Sort so focused player is rendered last (top z-index)
      playerList.sort((a, b) => {
        if (a.id === focusedPlayerId) return 1;
        if (b.id === focusedPlayerId) return -1;
        return 0;
      });

      playerList.forEach((p) => {
        const dx = p.tx - p.rx;
        const dy = p.ty - p.ry;
        const dist = Math.hypot(dx, dy);

        if (dist > 0.18 || isNaN(p.rx) || isNaN(p.ry)) {
          p.rx = p.tx;
          p.ry = p.ty;
        } else {
          p.rx = lerp(p.rx, p.tx, smoothFactor);
          p.ry = lerp(p.ry, p.ty, smoothFactor);
        }

        const cx = offsetX + p.rx * size;
        const cy = offsetY + p.ry * size;
        const isFocused = p.id === focusedPlayerId;
        const isFollowed = isFocused && isFollowingPlayer;

        drawPlayer(
          ctx,
          p,
          cx,
          cy,
          mapInfo,
          showNames,
          showVisionCones,
          realNow,
          isFocused,
          isFollowed
        );
      });

      rafRef.current = requestAnimationFrame(animate);
    }, [
      mapId,
      onFpsUpdate,
      showGrid,
      showNames,
      showVisionCones,
      showSmokes,
      showMolotovs,
      showGuns,
      radarZoom,
      focusedPlayerId,
      isFollowingPlayer,
    ]);

    useEffect(() => {
      rafRef.current = requestAnimationFrame(animate);
      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    }, [animate]);

    // Canvas Resize & High-DPI Display Scaler
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ro = new ResizeObserver(() => {
        const rect = canvas.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2.5); // Cap at 2.5x for ultra-high performance
        const targetW = Math.floor(rect.width * dpr);
        const targetH = Math.floor(rect.height * dpr);
        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW;
          canvas.height = targetH;
        }
      });
      ro.observe(canvas);
      return () => ro.disconnect();
    }, []);

    // Handle mouse drag / pan & click selection
    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (e.button !== 0) return;
      isDraggingRef.current = true;
      dragStartRef.current = {
        x: e.clientX - panRef.current.x,
        y: e.clientY - panRef.current.y,
      };
      pointerDownInfoRef.current = {
        x: e.clientX,
        y: e.clientY,
        time: Date.now(),
      };
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDraggingRef.current) return;
      panRef.current = {
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y,
      };
    };

    const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
      isDraggingRef.current = false;

      // Check if it was a quick click to select/focus a player
      if (pointerDownInfoRef.current) {
        const dx = Math.abs(e.clientX - pointerDownInfoRef.current.x);
        const dy = Math.abs(e.clientY - pointerDownInfoRef.current.y);
        const elapsed = Date.now() - pointerDownInfoRef.current.time;

        if (dx < 14 && dy < 14 && elapsed < 550) {
          const canvas = canvasRef.current;
          if (canvas) {
            const rect = canvas.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickY = e.clientY - rect.top;

            const w = rect.width;
            const h = rect.height;
            const baseSize = Math.min(w, h);
            const size = baseSize * radarZoom;
            const offsetX = (w - size) / 2 + panRef.current.x;
            const offsetY = (h - size) / 2 + panRef.current.y;

            let clickedPlayerId: string | null = null;
            let minDistance = 34; // Generous 34px clickable hitbox

            stateRef.current.forEach((p) => {
              const cx = offsetX + p.rx * size;
              const cy = offsetY + p.ry * size;
              const dist = Math.hypot(clickX - cx, clickY - cy);
              if (dist < minDistance) {
                minDistance = dist;
                clickedPlayerId = p.id;
              }
            });

            if (clickedPlayerId) {
              onSelectPlayer?.(clickedPlayerId);
            }
          }
        }
        pointerDownInfoRef.current = null;
      }
    };

    // Canvas Native Wheel & Multi-Touch Gesture Handling (Pinch-to-Zoom, 1-Finger Pan, Touch-Tap)
    const touchStartDistanceRef = useRef<number | null>(null);
    const touchStartZoomRef = useRef<number>(radarZoom);
    touchStartZoomRef.current = radarZoom;

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const handleWheel = (e: WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.15 : -0.15;
        const newZoom = Math.max(0.6, Math.min(3.5, radarZoom + delta));
        onZoomChange?.(Number(newZoom.toFixed(2)));
      };

      const handleTouchStart = (e: TouchEvent) => {
        if (e.touches.length === 1) {
          isDraggingRef.current = true;
          const touch = e.touches[0];
          dragStartRef.current = {
            x: touch.clientX - panRef.current.x,
            y: touch.clientY - panRef.current.y,
          };
          pointerDownInfoRef.current = {
            x: touch.clientX,
            y: touch.clientY,
            time: Date.now(),
          };
          touchStartDistanceRef.current = null;
        } else if (e.touches.length === 2) {
          isDraggingRef.current = false;
          pointerDownInfoRef.current = null;
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          touchStartDistanceRef.current = Math.hypot(dx, dy);
          touchStartZoomRef.current = radarZoom;
        }
      };

      const handleTouchMove = (e: TouchEvent) => {
        e.preventDefault(); // Prevent default mobile browser elastic scroll / gestures
        if (e.touches.length === 1 && isDraggingRef.current) {
          const touch = e.touches[0];
          panRef.current = {
            x: touch.clientX - dragStartRef.current.x,
            y: touch.clientY - dragStartRef.current.y,
          };
        } else if (e.touches.length === 2 && touchStartDistanceRef.current !== null) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          const currentDistance = Math.hypot(dx, dy);
          const factor = currentDistance / touchStartDistanceRef.current;
          const newZoom = Math.max(0.6, Math.min(3.5, touchStartZoomRef.current * factor));
          onZoomChange?.(Number(newZoom.toFixed(2)));
        }
      };

      const handleTouchEnd = (e: TouchEvent) => {
        if (e.touches.length === 0) {
          isDraggingRef.current = false;
          touchStartDistanceRef.current = null;

          if (pointerDownInfoRef.current) {
            const changedTouch = e.changedTouches[0];
            if (changedTouch) {
              const dx = Math.abs(changedTouch.clientX - pointerDownInfoRef.current.x);
              const dy = Math.abs(changedTouch.clientY - pointerDownInfoRef.current.y);
              const elapsed = Date.now() - pointerDownInfoRef.current.time;

              // Generous tap hitbox for mobile fingers
              if (dx < 18 && dy < 18 && elapsed < 450) {
                const rect = canvas.getBoundingClientRect();
                const clickX = changedTouch.clientX - rect.left;
                const clickY = changedTouch.clientY - rect.top;

                const w = rect.width;
                const h = rect.height;
                const baseSize = Math.min(w, h);
                const size = baseSize * radarZoom;
                const offsetX = (w - size) / 2 + panRef.current.x;
                const offsetY = (h - size) / 2 + panRef.current.y;

                let clickedPlayerId: string | null = null;
                let minDistance = 42; // 42px touch hitbox for mobile thumbs

                stateRef.current.forEach((p) => {
                  const cx = offsetX + p.rx * size;
                  const cy = offsetY + p.ry * size;
                  const dist = Math.hypot(clickX - cx, clickY - cy);
                  if (dist < minDistance) {
                    minDistance = dist;
                    clickedPlayerId = p.id;
                  }
                });

                if (clickedPlayerId) {
                  onSelectPlayer?.(clickedPlayerId);
                }
              }
            }
            pointerDownInfoRef.current = null;
          }
        } else if (e.touches.length === 1) {
          // Switch back to single finger drag
          isDraggingRef.current = true;
          const touch = e.touches[0];
          dragStartRef.current = {
            x: touch.clientX - panRef.current.x,
            y: touch.clientY - panRef.current.y,
          };
          touchStartDistanceRef.current = null;
        }
      };

      canvas.addEventListener("wheel", handleWheel, { passive: false });
      canvas.addEventListener("touchstart", handleTouchStart, { passive: false });
      canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
      canvas.addEventListener("touchend", handleTouchEnd, { passive: false });
      canvas.addEventListener("touchcancel", handleTouchEnd, { passive: false });

      return () => {
        canvas.removeEventListener("wheel", handleWheel);
        canvas.removeEventListener("touchstart", handleTouchStart);
        canvas.removeEventListener("touchmove", handleTouchMove);
        canvas.removeEventListener("touchend", handleTouchEnd);
        canvas.removeEventListener("touchcancel", handleTouchEnd);
      };
    }, [radarZoom, onZoomChange, onSelectPlayer]);

    return (
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="w-full h-full block cursor-grab active:cursor-grabbing touch-none select-none"
        aria-label={`CS2 Radar Canvas – ${mapId}`}
      />
    );
  }
);

export default RadarCanvas;

