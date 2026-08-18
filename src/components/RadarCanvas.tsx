"use client";

import React, {
  useRef,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { worldToFraction, getMapInfo, MAPS } from "@/lib/mapData";
import type { MapInfo } from "@/lib/mapData";
import type { RadarPayload, PlayerData, BombData } from "@/lib/radarStore";

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

export interface RadarCanvasProps {
  mapId: string;
  payload: RadarPayload | null;
  onFpsUpdate?: (fps: number) => void;
  showGrid?: boolean;
  showNames?: boolean;
  showVisionCones?: boolean;
  radarZoom?: number;
}

export interface RadarCanvasHandle {
  getCanvas: () => HTMLCanvasElement | null;
  resetView: () => void;
}

// ─── Visual Constants ────────────────────────────────────────────────────────
const LERP_ALPHA = 0.92; // Ultra responsive real-time (no delay)
const BASE_PLAYER_RADIUS = 9.5;
const CONE_LENGTH = 28;
const CONE_HALF_ANGLE = Math.PI / 6; // 30°
const DEATH_FADE_DURATION_MS = 10000; // Keep dead players visible during round

const HEALTH_BAR_W = 24;
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

// ─── Draw C4 Bomb Marker ───────────────────────────────────────────────────
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
  now: number
): boolean {
  if (isNaN(cx) || isNaN(cy)) return false;
  const isT = p.team === "T";
  const alive = p.isAlive;

  let opacity = 1.0;

  if (!alive) {
    if (!p.deathTimestamp) {
      p.deathTimestamp = now;
    }
    // Keep dead players visible with translucent ghost marker (never vanish if still in JSON)
    opacity = 0.65;
  }

  ctx.save();
  ctx.globalAlpha = opacity;

  // ── FOV Vision Cone ──────────────────────────────────────────────
  if (alive && showVisionCones) {
    const yawRad = degToRad(-p.yaw);
    const dirX = Math.cos(yawRad);
    const dirY = Math.sin(yawRad);

    ctx.save();
    ctx.fillStyle = isT ? COLOR_CONE_T : COLOR_CONE_CT;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    const baseAngle = Math.atan2(dirY, dirX);
    const angleLeft = baseAngle - CONE_HALF_ANGLE;
    const angleRight = baseAngle + CONE_HALF_ANGLE;
    ctx.lineTo(
      cx + Math.cos(angleLeft) * CONE_LENGTH,
      cy + Math.sin(angleLeft) * CONE_LENGTH
    );
    ctx.arc(cx, cy, CONE_LENGTH, angleLeft, angleRight, false);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = isT ? "#fde047" : "#7dd3fc";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(
      cx + dirX * (BASE_PLAYER_RADIUS + 7),
      cy + dirY * (BASE_PLAYER_RADIUS + 7)
    );
    ctx.stroke();
    ctx.restore();
  }

  // ── Player Dot (Strictly centered on map pixel) ───────────────────
  const mainColor = alive
    ? isT
      ? COLOR_T
      : COLOR_CT
    : isT
    ? COLOR_T_DEAD
    : COLOR_CT_DEAD;

  if (alive) {
    ctx.shadowColor = isT ? COLOR_T_GLOW : COLOR_CT_GLOW;
    ctx.shadowBlur = 12;
  }

  ctx.beginPath();
  ctx.arc(cx, cy, BASE_PLAYER_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = mainColor;
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.strokeStyle = alive ? "#ffffff" : "rgba(255,255,255,0.4)";
  ctx.lineWidth = 2;
  ctx.stroke();

  if (alive) {
    ctx.fillStyle = isT ? "#1c1917" : "#0f172a";
    ctx.font = `bold 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(p.team, cx, cy);
  }

  // ── Death Circle with X ──────────────────────────────────────────
  if (!alive) {
    ctx.beginPath();
    ctx.arc(cx, cy, BASE_PLAYER_RADIUS + 1, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(244, 63, 94, 0.4)";
    ctx.fill();
    ctx.strokeStyle = COLOR_DEAD_X;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2.5;
    const xSize = 5.5;
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
        const waveRadius = BASE_PLAYER_RADIUS + waveProgress * 16;
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
    const bx = cx - HEALTH_BAR_W / 2;
    const by = cy + BASE_PLAYER_RADIUS + 4;

    ctx.fillStyle = COLOR_HP_BG;
    ctx.beginPath();
    ctx.roundRect(bx, by, HEALTH_BAR_W, HEALTH_BAR_H, 2);
    ctx.fill();

    const hpW = (Math.max(0, Math.min(100, p.health)) / 100) * HEALTH_BAR_W;
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
      ctx.roundRect(bx, aby, HEALTH_BAR_W, ARMOR_BAR_H, 1.5);
      ctx.fill();

      const armorW =
        (Math.max(0, Math.min(100, p.armor)) / 100) * HEALTH_BAR_W;
      ctx.fillStyle = COLOR_ARMOR;
      ctx.beginPath();
      ctx.roundRect(bx, aby, armorW, ARMOR_BAR_H, 1.5);
      ctx.fill();
    }
  }

  // ── Vertical Level Arrow (Z-level) ───────────────────────────────
  const zDelta = p.z - mapInfo.zMid;
  const zThreshold = 75;
  if (alive && Math.abs(zDelta) > zThreshold) {
    const isUp = zDelta > 0;
    const ax = cx + BASE_PLAYER_RADIUS + 4.5;
    const ay = cy;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    if (isUp) {
      ctx.moveTo(ax, ay - 6);
      ctx.lineTo(ax + 4, ay + 3);
      ctx.lineTo(ax - 4, ay + 3);
    } else {
      ctx.moveTo(ax, ay + 6);
      ctx.lineTo(ax + 4, ay - 3);
      ctx.lineTo(ax - 4, ay - 3);
    }
    ctx.closePath();
    ctx.fill();
  }

  // ── Player Name Tag ──────────────────────────────────────────────
  if (showNames) {
    const labelY = cy - BASE_PLAYER_RADIUS - 4;
    ctx.font =
      "bold 10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";

    const txt = p.name ? p.name.slice(0, 14) : "Player";
    const metrics = ctx.measureText(txt);

    ctx.fillStyle = "rgba(4, 7, 18, 0.88)";
    ctx.strokeStyle = isT
      ? "rgba(245, 158, 11, 0.4)"
      : "rgba(56, 189, 248, 0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(
      cx - metrics.width / 2 - 4,
      labelY - 12,
      metrics.width + 8,
      13,
      3
    );
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = alive ? "#f8fafc" : "rgba(203, 213, 225, 0.5)";
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
      radarZoom = 1.0,
    },
    ref
  ) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const stateRef = useRef<Map<string, InterpolatedPlayer>>(new Map());
    const bombRef = useRef<InterpolatedBomb | null>(null);
    const rafRef = useRef<number>(0);
    const fpsRef = useRef({ frames: 0, lastTime: performance.now() });

    // Interactive Drag / Pan & Wheel Zoom State
    const panRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const isDraggingRef = useRef(false);
    const dragStartRef = useRef<{ x: number; y: number }>({
      x: 0,
      y: 0,
    });

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

    // Synchronous payload processing — runs inline every render,
    // NOT inside useEffect, so React batching can never skip players.
    if (payload !== lastPayloadRef.current) {
      lastPayloadRef.current = payload;

      if (!payload) {
        bombRef.current = null;
        stateRef.current.clear();
      } else {
        const mapInfo = getMapInfo(payload.map || mapId);
        const currentState = stateRef.current;
        const incomingIds = new Set<string>();
        const now = Date.now();

        // Update Bomb interpolation target
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

        // Update ALL players interpolation targets — process every single one
        const rawList = Array.isArray(payload.players) ? payload.players : [];
        for (let i = 0; i < rawList.length; i++) {
          const p = rawList[i];
          const playerId = String(p.id || `p_${i}`);
          incomingIds.add(playerId);
          const { fx, fy } = worldToFraction(p.x, p.y, mapInfo);
          const existing = currentState.get(playerId);

          if (existing) {
            // Update death/alive transition
            if (existing.wasAlive && !p.isAlive) {
              existing.deathTimestamp = now;
            } else if (p.isAlive) {
              existing.deathTimestamp = undefined;
            }
            existing.wasAlive = p.isAlive;

            // Copy all player data fields
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

            // Set interpolation targets
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
      }
    }

    const animate = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;
      const mapInfo = getMapInfo(mapId);

      // Base square size that fits in viewport
      const baseSize = Math.min(w, h);
      const size = baseSize * radarZoom;

      // Center offset + user pan offset
      const offsetX = (w - size) / 2 + panRef.current.x;
      const offsetY = (h - size) / 2 + panRef.current.y;

      const now = performance.now();
      fpsRef.current.frames++;
      if (now - fpsRef.current.lastTime >= 1000) {
        onFpsUpdate?.(fpsRef.current.frames);
        fpsRef.current.frames = 0;
        fpsRef.current.lastTime = now;
      }

      ctx.clearRect(0, 0, w, h);
      drawMapBackground(
        ctx,
        w,
        h,
        mapId,
        mapInfo,
        showGrid,
        offsetX,
        offsetY,
        size
      );

      const realNow = Date.now();

      // Draw C4 Bomb if present
      if (bombRef.current) {
        const b = bombRef.current;
        b.rx = lerp(b.rx, b.tx, LERP_ALPHA);
        b.ry = lerp(b.ry, b.ty, LERP_ALPHA);
        const bcx = offsetX + b.rx * size;
        const bcy = offsetY + b.ry * size;
        drawBomb(ctx, b, bcx, bcy, mapInfo, realNow);
      }

      // Draw Players
      stateRef.current.forEach((p) => {
        p.rx = lerp(p.rx, p.tx, LERP_ALPHA);
        p.ry = lerp(p.ry, p.ty, LERP_ALPHA);

        const cx = offsetX + p.rx * size;
        const cy = offsetY + p.ry * size;

        drawPlayer(
          ctx,
          p,
          cx,
          cy,
          mapInfo,
          showNames,
          showVisionCones,
          realNow
        );
      });

      rafRef.current = requestAnimationFrame(animate);
    }, [
      mapId,
      onFpsUpdate,
      showGrid,
      showNames,
      showVisionCones,
      radarZoom,
    ]);

    useEffect(() => {
      rafRef.current = requestAnimationFrame(animate);
      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    }, [animate]);

    // Handle mouse drag / pan
    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
      isDraggingRef.current = true;
      dragStartRef.current = {
        x: e.clientX - panRef.current.x,
        y: e.clientY - panRef.current.y,
      };
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDraggingRef.current) return;
      panRef.current = {
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y,
      };
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
    };

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ro = new ResizeObserver(() => {
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(rect.width * dpr);
        canvas.height = Math.floor(rect.height * dpr);
        const ctx = canvas.getContext("2d");
        if (ctx) ctx.scale(dpr, dpr);
      });
      ro.observe(canvas);
      return () => ro.disconnect();
    }, []);

    return (
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="w-full h-full block cursor-grab active:cursor-grabbing"
        aria-label={`CS2 Radar Canvas – ${mapId}`}
      />
    );
  }
);

export default RadarCanvas;
