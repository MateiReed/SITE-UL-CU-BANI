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
  fpsCap?: number; // 0 = uncapped, 30, 60, 120 (default 60)
  performanceMode?: boolean; // default true (Zero in-game FPS drop)
}

export interface RadarCanvasHandle {
  getCanvas: () => HTMLCanvasElement | null;
  resetView: () => void;
  updatePayload: (payload: RadarPayload | null) => void;
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
const COLOR_T_DEAD = "#78350f";
const COLOR_CT_DEAD = "#0c4a6e";

const COLOR_CONE_T = "rgba(245, 158, 11, 0.4)";
const COLOR_CONE_CT = "rgba(56, 189, 248, 0.4)";

const COLOR_HP_BG = "rgba(10, 15, 29, 0.9)";
const COLOR_HP_HIGH = "#10b981";
const COLOR_HP_MID = "#f59e0b";
const COLOR_HP_LOW = "#ef4444";
const COLOR_ARMOR = "#06b6d4";
const COLOR_DEAD_X = "#f43f5e";

// ─── Text Measurement Fast Cache (0 CPU Font Engine Stall) ───────────────────
const textMetricsCache = new Map<string, number>();

function getCachedTextWidth(ctx: CanvasRenderingContext2D, text: string, font: string): number {
  const key = font + "::" + text;
  let w = textMetricsCache.get(key);
  if (w === undefined) {
    if (textMetricsCache.size > 800) {
      textMetricsCache.clear();
    }
    ctx.font = font;
    w = ctx.measureText(text).width;
    textMetricsCache.set(key, w);
  }
  return w;
}

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
    return { bg: "rgba(168, 85, 247, 0.25)", border: "#c084fc", text: "#e9d5ff" }; // Snipers (Purple)
  }
  if (upper.includes("AK") || upper.includes("M4") || upper.includes("GALIL") || upper.includes("FAMAS") || upper.includes("AUG") || upper.includes("SG")) {
    return { bg: "rgba(245, 158, 11, 0.25)", border: "#fb923c", text: "#ffedd5" }; // Rifles (Amber/Orange)
  }
  if (upper.includes("DEAGLE") || upper.includes("DESERT") || upper.includes("USP") || upper.includes("GLOCK") || upper.includes("P250") || upper.includes("FIVE") || upper.includes("CZ") || upper.includes("REVOLVER")) {
    return { bg: "rgba(56, 189, 248, 0.25)", border: "#38bdf8", text: "#e0f2fe" }; // Pistols (Cyan)
  }
  if (upper.includes("MP9") || upper.includes("MAC") || upper.includes("MP7") || upper.includes("MP5") || upper.includes("UMP") || upper.includes("P90") || upper.includes("BIZON")) {
    return { bg: "rgba(52, 211, 153, 0.25)", border: "#34d399", text: "#d1fae5" }; // SMGs (Green)
  }
  return { bg: "rgba(148, 163, 184, 0.2)", border: "#94a3b8", text: "#f1f5f9" };
}

// ─── Offscreen Background Renderer (Zero Overhead Single Blit) ───────────────
let offscreenBgCanvas: HTMLCanvasElement | null = null;
let cachedBgKey = "";

function renderBackgroundToOffscreen(
  w: number,
  h: number,
  mapId: string,
  mapInfo: MapInfo,
  showGrid: boolean,
  offsetX: number,
  offsetY: number,
  size: number
): HTMLCanvasElement {
  if (typeof window === "undefined") {
    return document.createElement("canvas");
  }

  if (!offscreenBgCanvas) {
    offscreenBgCanvas = document.createElement("canvas");
  }

  const key = `${mapId}_${Math.round(w)}_${Math.round(h)}_${Math.round(offsetX)}_${Math.round(offsetY)}_${Math.round(size)}_${showGrid}`;
  if (cachedBgKey === key && offscreenBgCanvas.width === w && offscreenBgCanvas.height === h) {
    return offscreenBgCanvas;
  }

  offscreenBgCanvas.width = Math.max(1, w);
  offscreenBgCanvas.height = Math.max(1, h);
  const bCtx = offscreenBgCanvas.getContext("2d", { alpha: false });
  if (!bCtx) return offscreenBgCanvas;

  // 1. Dark Backdrop
  bCtx.fillStyle = "#060913";
  bCtx.fillRect(0, 0, w, h);

  const img = imageCache.get(mapId);

  if (img && img.complete && img.naturalWidth > 0) {
    bCtx.save();
    bCtx.imageSmoothingEnabled = true;
    bCtx.imageSmoothingQuality = "medium";
    bCtx.drawImage(img, offsetX, offsetY, size, size);

    // Subtle edge vignette
    const grad = bCtx.createRadialGradient(
      offsetX + size / 2,
      offsetY + size / 2,
      size * 0.32,
      offsetX + size / 2,
      offsetY + size / 2,
      size * 0.72
    );
    grad.addColorStop(0, "rgba(6, 9, 19, 0.0)");
    grad.addColorStop(1, "rgba(6, 9, 19, 0.55)");
    bCtx.fillStyle = grad;
    bCtx.fillRect(0, 0, w, h);
    bCtx.restore();
  } else {
    bCtx.save();
    bCtx.strokeStyle = "rgba(51, 65, 85, 0.35)";
    bCtx.lineWidth = 1;
    const step = 45;
    for (let x = 0; x <= w; x += step) {
      bCtx.beginPath();
      bCtx.moveTo(x, 0);
      bCtx.lineTo(x, h);
      bCtx.stroke();
    }
    for (let y = 0; y <= h; y += step) {
      bCtx.beginPath();
      bCtx.moveTo(0, y);
      bCtx.lineTo(w, y);
      bCtx.stroke();
    }

    bCtx.globalAlpha = 0.09;
    bCtx.fillStyle = mapInfo.accent;
    bCtx.font = `900 ${Math.floor(w / 6)}px ui-monospace, SFMono-Regular, monospace`;
    bCtx.textAlign = "center";
    bCtx.textBaseline = "middle";
    bCtx.fillText(mapInfo.displayName.toUpperCase(), w / 2, h / 2);
    bCtx.restore();
  }

  // Tactical Reticle Grid
  if (showGrid) {
    bCtx.save();
    bCtx.strokeStyle = "rgba(148, 163, 184, 0.12)";
    bCtx.lineWidth = 1;
    bCtx.setLineDash([4, 6]);

    bCtx.beginPath();
    bCtx.moveTo(offsetX + size / 2, 0);
    bCtx.lineTo(offsetX + size / 2, h);
    bCtx.moveTo(0, offsetY + size / 2);
    bCtx.lineTo(w, offsetY + size / 2);
    bCtx.stroke();

    bCtx.beginPath();
    bCtx.arc(offsetX + size / 2, offsetY + size / 2, size * 0.25, 0, Math.PI * 2);
    bCtx.arc(offsetX + size / 2, offsetY + size / 2, size * 0.45, 0, Math.PI * 2);
    bCtx.stroke();
    bCtx.restore();
  }

  // Corner HUD Bracket Accents (Crisp vector lines, 0 blur GPU overhead)
  const cornerLen = 24;
  bCtx.save();
  bCtx.strokeStyle = mapInfo.accent;
  bCtx.lineWidth = 2.5;

  // TL
  bCtx.beginPath();
  bCtx.moveTo(12, 12 + cornerLen);
  bCtx.lineTo(12, 12);
  bCtx.lineTo(12 + cornerLen, 12);
  bCtx.stroke();

  // TR
  bCtx.beginPath();
  bCtx.moveTo(w - 12 - cornerLen, 12);
  bCtx.lineTo(w - 12, 12);
  bCtx.lineTo(w - 12, 12 + cornerLen);
  bCtx.stroke();

  // BL
  bCtx.beginPath();
  bCtx.moveTo(12, h - 12 - cornerLen);
  bCtx.lineTo(12, h - 12);
  bCtx.lineTo(12 + cornerLen, h - 12);
  bCtx.stroke();

  // BR
  bCtx.beginPath();
  bCtx.moveTo(w - 12 - cornerLen, h - 12);
  bCtx.lineTo(w - 12, h - 12);
  bCtx.lineTo(w - 12, h - 12 - cornerLen);
  bCtx.stroke();
  bCtx.restore();

  cachedBgKey = key;
  return offscreenBgCanvas;
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
  const pulse = Math.sin(now * 0.003 + smoke.x * 0.01) * 0.05 + 1;
  const rad = pixelRadius * pulse;

  // Multi-layered lightweight concentric fills (0 shader stalls)
  ctx.fillStyle = "rgba(148, 163, 184, 0.22)";
  ctx.beginPath();
  ctx.arc(cx, cy, rad, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(203, 213, 225, 0.35)";
  ctx.beginPath();
  ctx.arc(cx, cy, rad * 0.7, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(241, 245, 249, 0.45)";
  ctx.beginPath();
  ctx.arc(cx, cy, rad * 0.35, 0, Math.PI * 2);
  ctx.fill();

  // Subtle outer boundary ring
  ctx.strokeStyle = "rgba(203, 213, 225, 0.5)";
  ctx.lineWidth = 1.2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.arc(cx, cy, rad * 0.96, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Tactical Smoke Badge at center
  ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
  ctx.strokeStyle = "rgba(203, 213, 225, 0.7)";
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

  // Multi-layered fiery concentric fills (0 shader overhead)
  ctx.fillStyle = "rgba(220, 38, 38, 0.25)";
  ctx.beginPath();
  ctx.arc(cx, cy, rad, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(249, 115, 22, 0.4)";
  ctx.beginPath();
  ctx.arc(cx, cy, rad * 0.65, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(254, 240, 138, 0.55)";
  ctx.beginPath();
  ctx.arc(cx, cy, rad * 0.28, 0, Math.PI * 2);
  ctx.fill();

  // Pulsing flame shockwave ring
  const pulse = (Math.sin(now * 0.006 + molo.y * 0.01) + 1) / 2;
  ctx.strokeStyle = `rgba(249, 115, 22, ${0.4 + pulse * 0.4})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, rad * (0.85 + pulse * 0.15), 0, Math.PI * 2);
  ctx.stroke();

  // Tactical Flame Badge at center
  ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
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

  const font = "bold 8.5px ui-monospace, SFMono-Regular, Menlo, monospace";
  const textWidth = getCachedTextWidth(ctx, name, font);
  const badgeW = textWidth + 12;
  const badgeH = 13;

  const bx = cx - badgeW / 2;
  const by = cy - badgeH / 2;

  // Background box with weapon category theme
  ctx.fillStyle = "rgba(8, 12, 22, 0.95)";
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
  ctx.font = font;
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

  // Outer C4 Glow Ring (Fast vector stroke, 0 blur overhead)
  const boxSize = 18;
  ctx.strokeStyle = "rgba(239, 68, 68, 0.45)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(
    cx - boxSize / 2 - 2,
    cy - boxSize / 2 - 2,
    boxSize + 4,
    boxSize + 4,
    5
  );
  ctx.stroke();

  // Solid Red Box
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
  const labelFont = "bold 9px ui-monospace, SFMono-Regular, monospace";
  const textWidth = getCachedTextWidth(ctx, "C4 BOMB", labelFont);

  ctx.fillStyle = "rgba(15, 23, 42, 0.94)";
  ctx.strokeStyle = "rgba(239, 68, 68, 0.7)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(
    cx - textWidth / 2 - 4,
    labelY - 11,
    textWidth + 8,
    12,
    3
  );
  ctx.fill();
  ctx.stroke();

  ctx.font = labelFont;
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

// ─── Draw Player ─────────────────────────────────────────────────────────────
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
    const deathAge = now - (p.deathTimestamp ?? now);
    const HOLD_MS = 1000;
    const FADE_MS = 1000;
    if (deathAge <= HOLD_MS) {
      opacity = 0.85;
    } else {
      const fadeProgress = Math.min(1, (deathAge - HOLD_MS) / FADE_MS);
      opacity = 0.85 * (1 - fadeProgress);
    }
    if (opacity <= 0.01) {
      return false;
    }
  }

  const currentRadius = isFocused ? FOCUSED_PLAYER_RADIUS : BASE_PLAYER_RADIUS;

  ctx.save();
  ctx.globalAlpha = opacity;

  // ── Focused Player Animated Beacon / Target Rings (Zero GPU Blur Passes) ──
  if (isFocused && alive) {
    ctx.save();
    const pulse1 = (now * 0.002) % 1;
    const pulse2 = (now * 0.002 + 0.5) % 1;

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
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.arc(cx, cy, targetRingRadius, 0, Math.PI * 2);
    ctx.stroke();

    // 4 Corner Tactical Crosshair Reticle Ticks
    const tickLen = 6;
    const tickDist = targetRingRadius + 2.5;
    ctx.lineWidth = 2;
    ctx.strokeStyle = isT ? "#fbbf24" : "#38bdf8";

    ctx.beginPath();
    ctx.moveTo(cx, cy - tickDist);
    ctx.lineTo(cx, cy - tickDist - tickLen);
    ctx.moveTo(cx, cy + tickDist);
    ctx.lineTo(cx, cy + tickDist + tickLen);
    ctx.moveTo(cx - tickDist, cy);
    ctx.lineTo(cx - tickDist - tickLen, cy);
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

  // Crisp Vector Glow Ring (Zero GPU Blur Overhead)
  if (alive) {
    const glowColor = isFocused
      ? isT ? "rgba(245, 158, 11, 0.45)" : "rgba(56, 189, 248, 0.45)"
      : hasBomb
      ? "rgba(239, 68, 68, 0.45)"
      : isT
      ? "rgba(245, 158, 11, 0.3)"
      : "rgba(56, 189, 248, 0.3)";
    ctx.strokeStyle = glowColor;
    ctx.lineWidth = isFocused ? 4 : hasBomb ? 3.5 : 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, currentRadius + (isFocused ? 2.5 : 1.5), 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.arc(cx, cy, currentRadius, 0, Math.PI * 2);
  ctx.fillStyle = mainColor;
  ctx.fill();

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

    ctx.fillStyle = "#ef4444";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.2;

    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY - 6, 17, 12, 3);
    ctx.fill();
    ctx.stroke();

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

      const armorW = (Math.max(0, Math.min(100, p.armor)) / 100) * barW;
      ctx.fillStyle = COLOR_ARMOR;
      ctx.beginPath();
      ctx.roundRect(bx, aby, armorW, ARMOR_BAR_H, 1.5);
      ctx.fill();
    }
  }

  // ── Player Name Tag & Focus / Follow Badge ───────────────────────
  if (showNames || isFocused) {
    const labelY = cy - currentRadius - (isFocused ? 6 : 4);
    const font = isFocused
      ? "bold 11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
      : "bold 10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";

    const baseTxt = p.name ? p.name.slice(0, 14) : "Player";
    const weaponSuffix = p.currentWeapon ? ` [${p.currentWeapon}]` : "";
    const prefix = isFollowed ? "🎯 TRACKING: " : isFocused ? "★ " : hasBomb ? "💣 " : "";
    const txt = `${prefix}${baseTxt}${weaponSuffix}`;
    const textWidth = getCachedTextWidth(ctx, txt, font);

    ctx.fillStyle = isFocused
      ? isT ? "rgba(40, 20, 5, 0.96)" : "rgba(5, 25, 45, 0.96)"
      : "rgba(4, 7, 18, 0.92)";
    ctx.strokeStyle = isFocused
      ? isT ? "#f59e0b" : "#38bdf8"
      : hasBomb
      ? "rgba(239, 68, 68, 0.7)"
      : isT
      ? "rgba(245, 158, 11, 0.5)"
      : "rgba(56, 189, 248, 0.5)";
    ctx.lineWidth = isFocused ? 1.8 : 1;
    ctx.beginPath();
    ctx.roundRect(
      cx - textWidth / 2 - 5,
      labelY - 13,
      textWidth + 10,
      14,
      3.5
    );
    ctx.fill();
    ctx.stroke();

    ctx.font = font;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
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
      fpsCap = 60,
      performanceMode = true,
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
    const lastRenderTimestampRef = useRef<number>(0);
    const activeMapRef = useRef<string>(mapId);

    // Interactive Drag / Pan & Wheel Zoom State
    const panRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const isDraggingRef = useRef(false);
    const dragStartRef = useRef<{ x: number; y: number }>({
      x: 0,
      y: 0,
    });
    const pointerDownInfoRef = useRef<{ x: number; y: number; time: number } | null>(null);

    const processPayload = useCallback((incoming: RadarPayload | null) => {
      if (!incoming) {
        bombRef.current = null;
        stateRef.current.clear();
        smokesRef.current.clear();
        molotovsRef.current.clear();
        gunsRef.current.clear();
        activeMapRef.current = mapId;
        return;
      }

      const targetMap = normalizeMapId(incoming.map || mapId);
      activeMapRef.current = targetMap;
      const mapInfo = getMapInfo(targetMap);
      const currentState = stateRef.current;
      const incomingIds = new Set<string>();
      const now = Date.now();

      // 1. Update Bomb interpolation target
      if (incoming.bomb) {
        const { fx, fy } = worldToFraction(
          incoming.bomb.x,
          incoming.bomb.y,
          mapInfo
        );
        if (bombRef.current) {
          bombRef.current.tx = fx;
          bombRef.current.ty = fy;
          bombRef.current.x = incoming.bomb.x;
          bombRef.current.y = incoming.bomb.y;
          bombRef.current.z = incoming.bomb.z;
          bombRef.current.isCarried = incoming.bomb.isCarried;
          bombRef.current.carrierId = incoming.bomb.carrierId;
        } else {
          bombRef.current = {
            ...incoming.bomb,
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
      const rawList = Array.isArray(incoming.players) ? incoming.players : [];
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
      const rawSmokes = Array.isArray(incoming.smokes) ? incoming.smokes : [];
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
      const rawMolos = Array.isArray(incoming.molotovs) ? incoming.molotovs : [];
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
      const rawGuns = Array.isArray(incoming.guns) ? incoming.guns : [];
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
    }, [mapId]);

    useImperativeHandle(ref, () => ({
      getCanvas: () => canvasRef.current,
      resetView: () => {
        panRef.current = { x: 0, y: 0 };
      },
      updatePayload: (p: RadarPayload | null) => {
        lastPayloadRef.current = p;
        processPayload(p);
      },
    }), [processPayload]);

    useEffect(() => {
      preloadRadarImages();
    }, []);

    // When map changes, reset pan
    useEffect(() => {
      panRef.current = { x: 0, y: 0 };
    }, [mapId]);

    // Track the last processed payload to avoid re-processing
    const lastPayloadRef = useRef<RadarPayload | null>(null);

    // Synchronous payload processing if passed as prop
    if (payload !== lastPayloadRef.current) {
      lastPayloadRef.current = payload;
      processPayload(payload);
    }

    useEffect(() => {
      const handleResize = () => {
        if (!isFollowingPlayer) {
          panRef.current = { x: 0, y: 0 };
        }
      };
      window.addEventListener("resize", handleResize);
      window.addEventListener("orientationchange", handleResize);
      return () => {
        window.removeEventListener("resize", handleResize);
        window.removeEventListener("orientationchange", handleResize);
      };
    }, [isFollowingPlayer]);

    const animate = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const now = performance.now();

      // Precision Frame Rate Cap (e.g. 60 FPS, 30 FPS, 120 FPS, or Uncapped)
      const targetFps = fpsCap > 0 ? fpsCap : 0;
      if (targetFps > 0) {
        const minFrameInterval = 1000 / targetFps;
        const elapsedSinceLastRender = now - lastRenderTimestampRef.current;
        if (elapsedSinceLastRender < minFrameInterval - 0.8) {
          rafRef.current = requestAnimationFrame(animate);
          return;
        }
        lastRenderTimestampRef.current = now - (elapsedSinceLastRender % minFrameInterval);
      } else {
        lastRenderTimestampRef.current = now;
      }

      // Tab Visibility check: if tab is hidden / minimized, pause heavy rendering to save 100% GPU
      if (typeof document !== "undefined" && document.hidden) {
        rafRef.current = requestAnimationFrame(animate);
        return;
      }

      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) return;

      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      if (w <= 0 || h <= 0) return;

      // Smart DPR: 1.0 or 1.25 in Performance Mode (Zero GPU FPS impact), up to 2.0 in fidelity mode
      const rawDpr = window.devicePixelRatio || 1;
      const dpr = performanceMode ? Math.min(rawDpr, 1.25) : Math.min(rawDpr, 2.0);
      const targetBufferW = Math.floor(w * dpr);
      const targetBufferH = Math.floor(h * dpr);

      // Keep canvas resolution synced to display pixel ratio
      if (canvas.width !== targetBufferW || canvas.height !== targetBufferH) {
        canvas.width = targetBufferW;
        canvas.height = targetBufferH;
      }

      // CRITICAL: Set DPI transform every frame so drawing uses logical CSS pixels
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const currentActiveMap = activeMapRef.current || normalizeMapId(mapId);
      const mapInfo = getMapInfo(currentActiveMap);

      const baseSize = Math.min(w, h);
      const size = baseSize * radarZoom;

      // Delta-time for frame-rate independent smooth interpolation
      const deltaMs = lastFrameTimeRef.current > 0 ? Math.min(now - lastFrameTimeRef.current, 100) : 16.667;
      lastFrameTimeRef.current = now;
      const deltaS = deltaMs / 1000;
      // Factor 12 = smooth pursuit that catches up in ~120ms without teleporting
      const smoothFactor = 1 - Math.exp(-12 * deltaS);

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
          const targetPanX = (0.5 - trackedPlayer.rx) * size;
          const targetPanY = (0.5 - trackedPlayer.ry) * size;
          if (!isDraggingRef.current) {
            const followSpeed = 1 - Math.exp(-15 * deltaS);
            panRef.current.x = lerp(panRef.current.x, targetPanX, followSpeed);
            panRef.current.y = lerp(panRef.current.y, targetPanY, followSpeed);
          }
        }
      }

      const offsetX = (w - size) / 2 + panRef.current.x;
      const offsetY = (h - size) / 2 + panRef.current.y;

      // ── Ultra-Fast Single Blit Offscreen Background ──────────────
      const bgCanvas = renderBackgroundToOffscreen(
        w,
        h,
        currentActiveMap,
        mapInfo,
        showGrid,
        offsetX,
        offsetY,
        size
      );
      ctx.drawImage(bgCanvas, 0, 0);

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
      playerList.sort((a, b) => {
        if (a.id === focusedPlayerId) return 1;
        if (b.id === focusedPlayerId) return -1;
        return 0;
      });

      playerList.forEach((p) => {
        const dx = p.tx - p.rx;
        const dy = p.ty - p.ry;
        const dist = Math.hypot(dx, dy);

        // Only hard-snap on truly impossible jumps (spawn, map change, teleport >50% of map)
        if (dist > 0.5 || isNaN(p.rx) || isNaN(p.ry)) {
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
      fpsCap,
      performanceMode,
    ]);

    useEffect(() => {
      rafRef.current = requestAnimationFrame(animate);
      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    }, [animate]);

    // Canvas Resize & Display Scaler
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ro = new ResizeObserver(() => {
        const rect = canvas.getBoundingClientRect();
        const rawDpr = window.devicePixelRatio || 1;
        const dpr = performanceMode ? Math.min(rawDpr, 1.25) : Math.min(rawDpr, 2.0);
        const targetW = Math.floor(rect.width * dpr);
        const targetH = Math.floor(rect.height * dpr);
        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW;
          canvas.height = targetH;
        }
      });
      ro.observe(canvas);
      return () => ro.disconnect();
    }, [performanceMode]);

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

      // Quick click detection for player selection
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
            let minDistance = 34;

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

    // Canvas Native Wheel & Multi-Touch Gesture Handling
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
        e.preventDefault();
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
                let minDistance = 42;

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
        className="w-full h-full block cursor-grab active:cursor-grabbing touch-none select-none gpu-perf"
        aria-label={`CS2 Radar Canvas – ${mapId}`}
      />
    );
  }
);

export default RadarCanvas;
