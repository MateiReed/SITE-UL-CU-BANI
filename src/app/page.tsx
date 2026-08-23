"use client";

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import dynamic from "next/dynamic";
import {
  Radio,
  Activity,
  Zap,
  Globe,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Play,
  Pause,
  Shield,
  Crosshair,
  Flame,
  Wind,
  Layers,
  Grid,
  Search,
  Copy,
  Download,
  Terminal,
  Check,
  ChevronLeft,
  ChevronRight,
  Sliders,
  Users,
  Trash2,
  Code,
  Keyboard,
  FileJson,
  Target,
  Sparkles,
  GripHorizontal,
  X,
  ChevronUp,
  Eye,
  RotateCw,
  RotateCcw,
  Menu,
  Smartphone,
  Plus,
  Minus,
  SlidersHorizontal,
} from "lucide-react";
import { MAPS, normalizeMapId } from "@/lib/mapData";
import type { RadarPayload, ExecutorPayload, PlayerData } from "@/lib/radarStore";
import { transformExecutorPayload } from "@/lib/radarStore";

const RadarCanvas = dynamic(() => import("@/components/RadarCanvas"), {
  ssr: false,
});

export type StreamMode = "websocket" | "http";
type ConnectionStatus = "live" | "awaiting" | "connecting" | "offline";
type InspectorSize = "compact" | "expanded" | "modal";

function getWeaponBadgeStyle(name?: string) {
  if (!name) return { bg: "bg-slate-900/80", text: "text-slate-400", border: "border-slate-800" };
  const upper = name.toUpperCase();
  if (upper.includes("AWP") || upper.includes("SSG") || upper.includes("SCAR") || upper.includes("G3SG1")) {
    return { bg: "bg-purple-950/50", text: "text-purple-300", border: "border-purple-500/30" };
  }
  if (upper.includes("AK") || upper.includes("M4") || upper.includes("GALIL") || upper.includes("FAMAS") || upper.includes("AUG") || upper.includes("SG")) {
    return { bg: "bg-amber-950/50", text: "text-amber-300", border: "border-amber-500/30" };
  }
  if (upper.includes("DEAGLE") || upper.includes("DESERT") || upper.includes("USP") || upper.includes("GLOCK") || upper.includes("P250") || upper.includes("FIVE") || upper.includes("CZ") || upper.includes("REVOLVER")) {
    return { bg: "bg-sky-950/50", text: "text-sky-300", border: "border-sky-500/30" };
  }
  if (upper.includes("MP9") || upper.includes("MAC") || upper.includes("MP7") || upper.includes("MP5") || upper.includes("UMP") || upper.includes("P90") || upper.includes("BIZON")) {
    return { bg: "bg-emerald-950/50", text: "text-emerald-300", border: "border-emerald-500/30" };
  }
  return { bg: "bg-slate-900/80", text: "text-slate-300", border: "border-slate-800" };
}

function PlayerCard({
  player,
  isFocused,
  isFollowing = false,
  onSelect,
  onToggleFollow,
}: {
  player: PlayerData;
  isFocused: boolean;
  isFollowing?: boolean;
  onSelect: () => void;
  onToggleFollow?: () => void;
}) {
  const isT = player.team === "T";
  const alive = player.isAlive;
  const wStyle = getWeaponBadgeStyle(player.currentWeapon);

  const hpPercent = Math.max(0, Math.min(100, player.health));
  const hpColor =
    player.health > 50
      ? "bg-emerald-500"
      : player.health > 20
      ? "bg-amber-500"
      : "bg-rose-500";

  return (
    <div
      onClick={onSelect}
      className={`group rounded-xl p-2.5 transition-all duration-150 cursor-pointer relative overflow-hidden border ${
        !alive
          ? "bg-[#0d0f15]/40 border-white/[0.03] opacity-40 grayscale hover:opacity-70"
          : isFocused
          ? isT
            ? "bg-amber-950/25 border-amber-500/50 shadow-md shadow-amber-500/10"
            : "bg-cyan-950/25 border-cyan-500/50 shadow-md shadow-cyan-500/10"
          : isT
          ? "bg-[#11131b]/70 border-amber-500/15 hover:border-amber-500/35 hover:bg-[#151822]"
          : "bg-[#11131b]/70 border-cyan-500/15 hover:border-cyan-500/35 hover:bg-[#151822]"
      }`}
    >
      {/* Left Active Accent Strip */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-1 transition-colors ${
          !alive
            ? "bg-slate-800"
            : isT
            ? isFocused
              ? "bg-amber-400"
              : "bg-amber-500/60 group-hover:bg-amber-400"
            : isFocused
            ? "bg-cyan-400"
            : "bg-cyan-500/60 group-hover:bg-cyan-400"
        }`}
      />

      <div className="pl-1.5 space-y-2">
        {/* Top row: Team badge + Name + C4 tag + Focus/Follow */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0 truncate">
            {/* Team Tag */}
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 tracking-wider ${
                isT
                  ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                  : "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
              }`}
            >
              {isT ? "T" : "CT"}
            </span>

            {player.hasBomb && (
              <span
                className="text-[9px] px-1.5 py-0.2 bg-rose-500/20 text-rose-300 rounded border border-rose-500/40 font-mono font-bold animate-pulse shrink-0 flex items-center gap-1"
                title="Carrying C4 Explosive"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
                C4
              </span>
            )}

            <span
              className={`font-mono text-xs font-semibold truncate ${
                !alive
                  ? "text-slate-500 line-through"
                  : isT
                  ? "text-slate-200 group-hover:text-amber-200"
                  : "text-slate-200 group-hover:text-cyan-200"
              }`}
            >
              {player.name}
            </span>

            {isFocused && (
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shrink-0">
                FOCUS
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isFocused && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFollow?.();
                }}
                className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-md border transition-all flex items-center gap-1 ${
                  isFollowing
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-400 animate-pulse"
                    : "bg-slate-800 hover:bg-slate-700 text-cyan-300 border-cyan-500/30"
                }`}
                title="Toggle follow camera tracking on this player (Key: T / P)"
              >
                <Crosshair className="w-2.5 h-2.5" />
                <span>{isFollowing ? "TRACKING" : "FOLLOW"}</span>
              </button>
            )}

            {alive ? (
              <span className="text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                ALIVE
              </span>
            ) : (
              <span className="text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-400 border border-rose-500/25">
                DEAD
              </span>
            )}
          </div>
        </div>

        {/* Middle row: Weapon badge + Armor + Health value */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 truncate">
            {player.currentWeapon ? (
              <span
                className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded border ${wStyle.bg} ${wStyle.text} ${wStyle.border} truncate`}
              >
                {player.currentWeapon}
              </span>
            ) : (
              <span className="text-[10px] font-mono text-slate-500 italic">
                --
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 font-mono text-[10px] shrink-0">
            <span className="text-slate-400 flex items-center gap-1 bg-slate-900/60 px-1.5 py-0.5 rounded border border-white/[0.04]">
              <Shield className="w-2.5 h-2.5 text-cyan-400" />
              <span>{player.armor}</span>
            </span>
            <span
              className={`font-semibold px-1.5 py-0.5 rounded border ${
                player.health > 50
                  ? "text-emerald-300 bg-emerald-950/30 border-emerald-500/20"
                  : player.health > 20
                  ? "text-amber-300 bg-amber-950/30 border-amber-500/20"
                  : "text-rose-300 bg-rose-950/30 border-rose-500/20"
              }`}
            >
              {player.health} HP
            </span>
          </div>
        </div>

        {/* Bottom Health Bar */}
        <div className="w-full h-1 bg-slate-950/80 rounded-full overflow-hidden border border-white/[0.04]">
          <div
            className={`h-full ${hpColor} transition-all duration-300 rounded-full`}
            style={{ width: `${alive ? hpPercent : 0}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Sound System (Synthesized Web Audio API) ──────────────────────────────
class SoundFX {
  private ctx: AudioContext | null = null;
  public enabled = false;

  private init() {
    if (!this.ctx && typeof window !== "undefined") {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
  }

  public playPing() {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(
        440,
        this.ctx.currentTime + 0.06
      );
      gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        this.ctx.currentTime + 0.06
      );
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.06);
    } catch {
      // Audio autoplay policy fallback
    }
  }
}

const sfx = new SoundFX();

// ─── Mock Data Simulator ───────────────────────────────────────────────────
function generateMockPayload(mapId: string, tick: number): RadarPayload {
  const currentMap = MAPS.find((m) => m.id === mapId) ?? MAPS[0];
  const span = currentMap.scale * 1024;
  const xMin = currentMap.pos_x;
  const yMin = currentMap.pos_y - span;
  const xRange = span;
  const yRange = span;

  const tPlayers = [
    { id: "76561198000000001", name: "ZywOo", baseX: 0.35, baseY: 0.42, weapon: "AK-47" },
    { id: "76561198000000002", name: "s1mple", baseX: 0.43, baseY: 0.52, weapon: "AWP" },
    { id: "76561198000000003", name: "NiKo", baseX: 0.29, baseY: 0.65, weapon: "Deagle" },
    { id: "76561198000000004", name: "m0NESY", baseX: 0.48, baseY: 0.36, weapon: "Galil AR" },
    { id: "76561198000000005", name: "b1t", baseX: 0.32, baseY: 0.24, weapon: "MAC-10" },
  ];

  const ctPlayers = [
    { id: "76561198000000006", name: "ropz", baseX: 0.64, baseY: 0.44, weapon: "M4A1-S" },
    { id: "76561198000000007", name: "donk", baseX: 0.72, baseY: 0.58, weapon: "AK-47" },
    { id: "76561198000000008", name: "frozen", baseX: 0.79, baseY: 0.48, weapon: "M4A4" },
    { id: "76561198000000009", name: "broky", baseX: 0.67, baseY: 0.28, weapon: "AWP" },
    { id: "76561198000000010", name: "Aleksib", baseX: 0.58, baseY: 0.68, weapon: "USP-S" },
  ];

  const t = tick * 0.02;

  const carrierX = xMin + (tPlayers[0].baseX + Math.sin(t) * 0.07) * xRange;
  const carrierY = yMin + (tPlayers[0].baseY + Math.cos(t) * 0.07) * yRange;

  return {
    map: mapId,
    timestamp: Date.now(),
    bomb: {
      x: carrierX,
      y: carrierY,
      z: currentMap.zMid,
      isCarried: true,
      carrierId: "76561198000000001",
    },
    players: [
      ...tPlayers.map((p, i) => ({
        id: p.id,
        name: p.name,
        team: "T" as const,
        x: xMin + (p.baseX + Math.sin(t + i * 1.2) * 0.07) * xRange,
        y: yMin + (p.baseY + Math.cos(t + i * 0.8) * 0.07) * yRange,
        z: currentMap.zMid + Math.sin(t + i) * 35,
        yaw: (tick * 1.6 + i * 72) % 360,
        health: Math.max(0, 100 - ((tick + i * 17) % 75)),
        armor: Math.max(0, 100 - ((tick + i * 11 + 10) % 110)),
        isAlive: (tick + i * 31) % 120 < 105,
        hasBomb: i === 0,
        currentWeapon: p.weapon,
      })),
      ...ctPlayers.map((p, i) => ({
        id: p.id,
        name: p.name,
        team: "CT" as const,
        x: xMin + (p.baseX + Math.sin(t + i * 1.1 + 2) * 0.06) * xRange,
        y: yMin + (p.baseY + Math.cos(t + i * 0.9 + 1) * 0.07) * yRange,
        z: currentMap.zMid + Math.cos(t + i) * 45,
        yaw: (tick * 1.3 + i * 72 + 180) % 360,
        health: Math.max(0, 100 - ((tick + i * 23 + 40) % 75)),
        armor: Math.max(0, 100 - ((tick + i * 13 + 20) % 110)),
        isAlive: (tick + i * 41 + 15) % 120 < 110,
        hasBomb: false,
        currentWeapon: p.weapon,
      })),
    ],
    smokes: [
      {
        id: "smoke_0",
        x: xMin + 0.45 * xRange,
        y: yMin + 0.48 * yRange,
        z: currentMap.zMid,
      },
      {
        id: "smoke_1",
        x: xMin + 0.58 * xRange,
        y: yMin + 0.38 * yRange,
        z: currentMap.zMid,
      },
    ],
    molotovs: [
      {
        id: "molo_0",
        x: xMin + 0.38 * xRange,
        y: yMin + 0.59 * yRange,
        z: currentMap.zMid,
      },
      {
        id: "molo_1",
        x: xMin + 0.68 * xRange,
        y: yMin + 0.52 * yRange,
        z: currentMap.zMid,
      },
    ],
    guns: [
      {
        id: "gun_0_AK-47",
        name: "AK-47",
        x: xMin + 0.41 * xRange,
        y: yMin + 0.44 * yRange,
        z: currentMap.zMid,
      },
      {
        id: "gun_1_AWP",
        name: "AWP",
        x: xMin + 0.62 * xRange,
        y: yMin + 0.46 * yRange,
        z: currentMap.zMid,
      },
      {
        id: "gun_2_M4A1-S",
        name: "M4A1-S",
        x: xMin + 0.54 * xRange,
        y: yMin + 0.61 * yRange,
        z: currentMap.zMid,
      },
    ],
  };
}

const HTTP_POLL_INTERVAL = 30; // 33Hz real-time fast polling

// ─── Modern SaaS Toggle Switch Component ──────────────────────────────────
function ToggleSwitch({
  checked,
  onChange,
  label,
  shortcut,
  icon,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  label: string;
  shortcut?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div
      onClick={() => onChange(!checked)}
      className={`group flex items-center justify-between py-2 px-2.5 rounded-xl cursor-pointer transition-all duration-150 border ${
        checked
          ? "bg-[#141824] border-cyan-500/35 text-slate-100"
          : "bg-[#0d0f15]/60 border-white/[0.04] text-slate-400 hover:bg-[#131620] hover:text-slate-200"
      }`}
    >
      <div className="flex items-center gap-2 truncate">
        {icon && <span className="text-slate-400 group-hover:text-cyan-400 transition-colors shrink-0">{icon}</span>}
        <span className="text-xs font-mono truncate font-medium">{label}</span>
        {shortcut && (
          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-900 text-slate-400 border border-white/[0.06] shrink-0">
            {shortcut}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0 ml-2">
        <div
          className={`w-8 h-4 rounded-full transition-colors duration-150 p-0.5 relative flex items-center ${
            checked ? "bg-cyan-500" : "bg-slate-800 border border-white/[0.08]"
          }`}
        >
          <div
            className={`w-3 h-3 rounded-full bg-white shadow-sm transform transition-transform duration-150 ${
              checked ? "translate-x-4" : "translate-x-0"
            }`}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Syntax Highlighted JSON Viewer ─────────────────────────────────────────
function HighlightedJson({
  data,
  searchTerm = "",
}: {
  data: unknown;
  searchTerm?: string;
}) {
  const jsonString = useMemo(() => {
    if (!data) return "// Waiting for telemetry packet...";
    return JSON.stringify(data, null, 2);
  }, [data]);

  const renderedLines = useMemo(() => {
    if (!data) {
      return (
        <span className="text-slate-500 font-mono italic">
          // Waiting for telemetry data from executor...
        </span>
      );
    }

    const lines = jsonString.split("\n");
    return lines.map((line, idx) => {
      let formattedLine = line
        .replace(
          /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
          (match) => {
            let cls = "text-amber-300"; // number
            if (/^"/.test(match)) {
              if (/:$/.test(match)) {
                cls = "text-cyan-300 font-semibold"; // key
              } else {
                cls = "text-emerald-300"; // string
              }
            } else if (/true|false/.test(match)) {
              cls = "text-purple-400 font-bold"; // boolean
            } else if (/null/.test(match)) {
              cls = "text-rose-400 font-bold"; // null
            }
            return `<span class="${cls}">${match}</span>`;
          }
        );

      if (searchTerm.trim()) {
        const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(`(${escaped})`, "gi");
        formattedLine = formattedLine.replace(
          regex,
          '<mark class="bg-cyan-400 text-black px-1 rounded font-bold">$1</mark>'
        );
      }

      return (
        <div key={idx} className="table-row leading-5 hover:bg-white/[0.03]">
          <span className="table-cell pr-4 text-right select-none text-slate-600 text-[11px] font-mono w-10">
            {idx + 1}
          </span>
          <span
            className="table-cell whitespace-pre font-mono text-xs"
            dangerouslySetInnerHTML={{ __html: formattedLine }}
          />
        </div>
      );
    });
  }, [jsonString, data, searchTerm]);

  return (
    <div className="font-mono text-xs overflow-x-auto select-text table w-full">
      {renderedLines}
    </div>
  );
}

export default function Page() {
  const [mounted, setMounted] = useState(false);
  const [selectedMap, setSelectedMap] = useState("de_dust2");
  const [payload, setPayload] = useState<RadarPayload | null>(null);
  const [rawPayload, setRawPayload] = useState<unknown>(null);

  // ── Protocol Mode Selector (Default: WebSocket) ───────────────────
  const [streamMode, setStreamMode] = useState<StreamMode>("websocket");
  const [status, setStatus] = useState<ConnectionStatus>("awaiting");

  const [fps, setFps] = useState(0);
  const [latency, setLatency] = useState<number | null>(null);
  const [useMock, setUseMock] = useState(false);
  const [mockTick, setMockTick] = useState(0);

  // Inspector & UI Controls
  const [activeTab, setActiveTab] = useState<
    "players" | "utils" | "raw" | "api" | "shortcuts"
  >("players");
  const [inspectorSize, setInspectorSize] = useState<InspectorSize>("compact");
  const [jsonSearchQuery, setJsonSearchQuery] = useState("");
  const [packetCount, setPacketCount] = useState(0);
  const [lastPacketTime, setLastPacketTime] = useState<string>("--");
  const [timeAgo, setTimeAgo] = useState<string>("Waiting for data...");
  const [playerSearch, setPlayerSearch] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [isFollowingPlayer, setIsFollowingPlayer] = useState(false);
  const [copiedToast, setCopiedToast] = useState<string | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [autoFollowMap, setAutoFollowMap] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"players" | "settings">("players");
  const [sidebarTeamTab, setSidebarTeamTab] = useState<"T" | "CT">("T");
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [mobileLayersOpen, setMobileLayersOpen] = useState(false);
  const [isLandscapeLocked, setIsLandscapeLocked] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);

  const [fullscreenPlayersVisible, setFullscreenPlayersVisible] = useState(true);
  const [rosterPos, setRosterPos] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingRoster, setIsDraggingRoster] = useState(false);
  const dragStartRef = useRef<{
    startMouseX: number;
    startMouseY: number;
    startPosX: number;
    startPosY: number;
  } | null>(null);

  // Draggable Follow HUD State
  const [followHudPos, setFollowHudPos] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingFollowHud, setIsDraggingFollowHud] = useState(false);
  const [isFollowHudMinimized, setIsFollowHudMinimized] = useState(false);
  const followHudDragStartRef = useRef<{
    startMouseX: number;
    startMouseY: number;
    startPosX: number;
    startPosY: number;
  } | null>(null);

  // Canvas Viewport Controls
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [showNames, setShowNames] = useState(true);
  const [showVisionCones, setShowVisionCones] = useState(true);
  const [showSmokes, setShowSmokes] = useState(true);
  const [showMolotovs, setShowMolotovs] = useState(true);
  const [showGuns, setShowGuns] = useState(true);
  const [radarZoom, setRadarZoom] = useState(1.0);

  const radarContainerRef = useRef<HTMLDivElement>(null);

  const resetRadarView = useCallback(() => {
    setRadarZoom(1.0);
    setIsFollowingPlayer(false);
  }, []);

  const handleSelectPlayer = useCallback((id: string | null) => {
    setSelectedPlayerId((prev) => {
      if (id === null || id === prev) {
        setIsFollowingPlayer(false);
        return null;
      }
      return id;
    });
  }, []);

  const toggleFollowPlayer = useCallback(() => {
    if (!selectedPlayerId) return;
    setIsFollowingPlayer((f) => {
      const next = !f;
      if (next && radarZoom <= 1.0) {
        setRadarZoom(1.8);
      }
      return next;
    });
  }, [selectedPlayerId, radarZoom]);

  const handleFollowHudPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button") || (e.target as HTMLElement).closest("input")) return;

    e.preventDefault();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}

    const container = radarContainerRef.current;
    let initialX = followHudPos?.x;
    let initialY = followHudPos?.y;

    if (initialX === undefined || initialY === undefined) {
      if (container) {
        const rect = container.getBoundingClientRect();
        initialX = Math.max(16, (rect.width - 540) / 2);
        initialY = Math.max(16, rect.height - 130);
      } else {
        initialX = 40;
        initialY = 400;
      }
    }

    followHudDragStartRef.current = {
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startPosX: initialX,
      startPosY: initialY,
    };
    setIsDraggingFollowHud(true);
  }, [followHudPos]);

  const handleFollowHudPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!followHudDragStartRef.current) return;
    e.preventDefault();

    const dx = e.clientX - followHudDragStartRef.current.startMouseX;
    const dy = e.clientY - followHudDragStartRef.current.startMouseY;

    const container = radarContainerRef.current;
    const maxW = container ? container.clientWidth - 160 : window.innerWidth - 160;
    const maxH = container ? container.clientHeight - 60 : window.innerHeight - 60;

    const newX = Math.max(8, Math.min(maxW, followHudDragStartRef.current.startPosX + dx));
    const newY = Math.max(8, Math.min(maxH, followHudDragStartRef.current.startPosY + dy));

    setFollowHudPos({ x: newX, y: newY });
  }, []);

  const handleFollowHudPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    followHudDragStartRef.current = null;
    setIsDraggingFollowHud(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  }, []);

  const handleRosterPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button")) return;

    e.preventDefault();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}

    const currentX = rosterPos?.x ?? 16;
    const currentY = rosterPos?.y ?? 64;

    dragStartRef.current = {
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startPosX: currentX,
      startPosY: currentY,
    };
    setIsDraggingRoster(true);
  }, [rosterPos]);

  const handleRosterPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) return;
    e.preventDefault();

    const dx = e.clientX - dragStartRef.current.startMouseX;
    const dy = e.clientY - dragStartRef.current.startMouseY;

    const newX = Math.max(8, Math.min(window.innerWidth - 340, dragStartRef.current.startPosX + dx));
    const newY = Math.max(8, Math.min(window.innerHeight - 120, dragStartRef.current.startPosY + dy));

    setRosterPos({ x: newX, y: newY });
  }, []);

  const handleRosterPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    dragStartRef.current = null;
    setIsDraggingRoster(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  }, []);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mockIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPacketDateRef = useRef<number>(0);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      const checkMobile = () => {
        const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
        const isSmall = window.innerWidth < 1024;
        setIsMobileDevice(isTouch || isSmall);
      };
      checkMobile();
      window.addEventListener("resize", checkMobile);
      return () => window.removeEventListener("resize", checkMobile);
    }
  }, []);

  // Relative timestamp and idle status checker
  useEffect(() => {
    const timer = setInterval(() => {
      if (lastPacketDateRef.current > 0) {
        const diff = Math.floor(
          (Date.now() - lastPacketDateRef.current) / 1000
        );
        setTimeAgo(`${diff}s ago`);
        if (!useMock && diff > 4) {
          setStatus("awaiting");
        }
      } else {
        setTimeAgo("Waiting for data...");
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [useMock]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNowFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isNowFullscreen);
      if (!isNowFullscreen) {
        setIsLandscapeLocked(false);
        if (typeof window !== "undefined" && window.screen?.orientation && "unlock" in window.screen.orientation) {
          try {
            (window.screen.orientation as unknown as { unlock: () => void }).unlock();
          } catch {}
        }
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
    };
  }, []);

  // Cinematic Fullscreen & Mobile Landscape Orientation Locker
  const toggleFullscreen = useCallback(async (lockLandscape: boolean | React.MouseEvent = false) => {
    const shouldLock = lockLandscape === true;
    try {
      if (!document.fullscreenElement) {
        const el = radarContainerRef.current || document.documentElement;
        if (el.requestFullscreen) {
          await el.requestFullscreen();
        } else if ((el as unknown as { webkitRequestFullscreen: () => Promise<void> }).webkitRequestFullscreen) {
          await (el as unknown as { webkitRequestFullscreen: () => Promise<void> }).webkitRequestFullscreen();
        }
        setIsFullscreen(true);

        if (shouldLock && typeof window !== "undefined" && window.screen?.orientation && "lock" in window.screen.orientation) {
          try {
            await (window.screen.orientation as unknown as { lock: (type: string) => Promise<void> }).lock("landscape");
            setIsLandscapeLocked(true);
          } catch {
            // Orientation lock may fail on devices without permission, fullscreen still works
          }
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as unknown as { webkitExitFullscreen: () => Promise<void> }).webkitExitFullscreen) {
          await (document as unknown as { webkitExitFullscreen: () => Promise<void> }).webkitExitFullscreen();
        }
        setIsFullscreen(false);
        setIsLandscapeLocked(false);

        if (typeof window !== "undefined" && window.screen?.orientation && "unlock" in window.screen.orientation) {
          try {
            (window.screen.orientation as unknown as { unlock: () => void }).unlock();
          } catch {}
        }
      }
    } catch {
      setIsFullscreen((v) => !v);
    }
  }, []);

  const toggleFullscreenLandscape = useCallback(() => {
    toggleFullscreen(true);
  }, [toggleFullscreen]);

  // Keyboard Shortcuts (QoL)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement).tagName === "INPUT" ||
        (e.target as HTMLElement).tagName === "TEXTAREA"
      ) {
        return;
      }
      const key = e.key.toLowerCase();
      if (key === "f") {
        e.preventDefault();
        toggleFullscreen(false);
      } else if (key === "l") {
        e.preventDefault();
        toggleFullscreen(true);
      } else if (key === "d") {
        e.preventDefault();
        setUseMock((v) => !v);
      } else if (key === "g") {
        e.preventDefault();
        setShowGrid((v) => !v);
      } else if (key === "n") {
        e.preventDefault();
        setShowNames((v) => !v);
      } else if (key === "v") {
        e.preventDefault();
        setShowVisionCones((v) => !v);
      } else if (key === "s") {
        e.preventDefault();
        setShowSmokes((v) => !v);
      } else if (key === "k") {
        e.preventDefault();
        setShowMolotovs((v) => !v);
      } else if (key === "u") {
        e.preventDefault();
        setShowGuns((v) => !v);
      } else if (key === "m") {
        e.preventDefault();
        setAudioEnabled((v) => {
          sfx.enabled = !v;
          return !v;
        });
      } else if (key === "t" || key === "p") {
        e.preventDefault();
        if (selectedPlayerId) {
          toggleFollowPlayer();
        }
      } else if (key === "+" || key === "=") {
        e.preventDefault();
        setRadarZoom((z) => Math.min(3.5, Number((z + 0.2).toFixed(2))));
      } else if (key === "-" || key === "_") {
        e.preventDefault();
        setRadarZoom((z) => Math.max(0.6, Number((z - 0.2).toFixed(2))));
      } else if (key === "0") {
        e.preventDefault();
        resetRadarView();
      } else if (key === "i") {
        e.preventDefault();
        setInspectorSize((s) =>
          s === "compact" ? "expanded" : s === "expanded" ? "modal" : "compact"
        );
      } else if (key === "escape") {
        if (mobileDrawerOpen) {
          setMobileDrawerOpen(false);
        } else if (mobileLayersOpen) {
          setMobileLayersOpen(false);
        } else if (selectedPlayerId) {
          handleSelectPlayer(null);
        } else if (inspectorSize === "modal") {
          setInspectorSize("expanded");
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleFullscreen, inspectorSize, selectedPlayerId, toggleFollowPlayer, handleSelectPlayer, resetRadarView, mobileDrawerOpen, mobileLayersOpen]);

  const selectedMapRef = useRef(selectedMap);
  selectedMapRef.current = selectedMap;
  const autoFollowMapRef = useRef(autoFollowMap);
  autoFollowMapRef.current = autoFollowMap;

  // Process incoming telemetry packet
  const handleIncomingPayload = useCallback(
    (incomingData: unknown) => {
      if (!incomingData || typeof incomingData !== "object") return;
      const incomingObj = incomingData as Record<string, unknown>;

      const rawToSave = incomingObj._raw !== undefined ? incomingObj._raw : incomingData;
      setRawPayload(rawToSave);

      const data = transformExecutorPayload(
        incomingObj as unknown as ExecutorPayload
      );

      const now = Date.now();
      if (data.timestamp) {
        setLatency(Math.max(0, now - data.timestamp));
      }
      setPayload(data);
      setPacketCount((c) => c + 1);
      lastPacketDateRef.current = now;
      setLastPacketTime(new Date().toLocaleTimeString());
      sfx.playPing();

      if (autoFollowMapRef.current && data.map) {
        const autoMap = normalizeMapId(data.map);
        if (autoMap !== selectedMapRef.current) {
          setSelectedMap(autoMap);
        }
      }
      setStatus("live");
    },
    []
  );

  // ── Protocol Transport: WebSocket Mode (Default) ───────────────────
  const startWebSocket = useCallback(() => {
    if (typeof window === "undefined") return;

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/api/radar/ws`;

    setStatus("connecting");

    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
    } catch {
      setStatus("offline");
      return;
    }

    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("awaiting");
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        const raw = event.data;
        if (!raw) return;
        const parsed = JSON.parse(raw as string);

        if (parsed?.type === "CLEARED") {
          setPayload(null);
          setRawPayload(null);
          setStatus("awaiting");
        } else if (parsed && typeof parsed === "object") {
          handleIncomingPayload(parsed);
        }
      } catch {}
    };

    ws.onerror = () => {
      setStatus("offline");
    };

    ws.onclose = () => {
      wsRef.current = null;
      setStatus("offline");
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = setTimeout(startWebSocket, 3000);
    };
  }, [handleIncomingPayload]);

  // ── Protocol Transport: HTTP Polling Mode ──────────────────────────
  const startHttpPolling = useCallback(() => {
    setStatus("awaiting");

    const poll = async () => {
      try {
        const res = await fetch("/api/radar", { cache: "no-store" });
        if (res.ok) {
          const json = await res.json();
          if (json?.state || json?.raw) {
            const rawObj = json.raw ?? json.state;
            const stateObj = json.state ?? json.raw;
            setRawPayload(rawObj);
            handleIncomingPayload({ ...stateObj, _raw: rawObj });
          }
        }
      } catch {}
    };

    poll();
    const timer = setInterval(poll, HTTP_POLL_INTERVAL);
    pollTimerRef.current = timer;
  }, [handleIncomingPayload]);

  // Handle active transport based on streamMode
  useEffect(() => {
    if (useMock) return;

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);

    if (streamMode === "websocket") {
      startWebSocket();
    } else {
      startHttpPolling();
    }

    return () => {
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {}
        wsRef.current = null;
      }
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [streamMode, useMock, startWebSocket, startHttpPolling]);

  // Mock simulation
  useEffect(() => {
    if (useMock) {
      mockIntervalRef.current = setInterval(() => {
        setMockTick((t) => {
          const next = t + 1;
          const p = generateMockPayload(selectedMap, next);
          setPayload(p);
          setLatency(0);
          setStatus("live");
          setPacketCount((c) => c + 1);
          lastPacketDateRef.current = Date.now();
          setLastPacketTime(new Date().toLocaleTimeString());
          return next;
        });
      }, 30);
    } else {
      if (mockIntervalRef.current) clearInterval(mockIntervalRef.current);
    }
    return () => {
      if (mockIntervalRef.current) clearInterval(mockIntervalRef.current);
    };
  }, [useMock, selectedMap]);

  const handleMapChange = (mapId: string) => {
    setSelectedMap(mapId);
    if (useMock) setMockTick(0);
  };

  const handleClearRadar = async () => {
    setPayload(null);
    setRawPayload(null);
    setSelectedPlayerId(null);
    setStatus("awaiting");
    try {
      await fetch("/api/radar", { method: "DELETE" });
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "CLEAR" }));
      }
    } catch {}
  };

  const copyToClipboard = (text: string, label = "Copied to clipboard!") => {
    navigator.clipboard.writeText(text);
    setCopiedToast(label);
    setTimeout(() => setCopiedToast(null), 2000);
  };

  const downloadJson = () => {
    if (!rawPayload) return;
    const blob = new Blob([JSON.stringify(rawPayload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cs2_telemetry_${selectedMap}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    copyToClipboard("", "JSON file downloaded!");
  };

  const currentMap = MAPS.find((m) => m.id === selectedMap) ?? MAPS[0];

  const tPlayers = useMemo(
    () => payload?.players.filter((p) => p.team === "T") ?? [],
    [payload]
  );
  const ctPlayers = useMemo(
    () => payload?.players.filter((p) => p.team === "CT") ?? [],
    [payload]
  );

  const tAlive = useMemo(
    () => tPlayers.filter((p) => p.isAlive).length,
    [tPlayers]
  );
  const ctAlive = useMemo(
    () => ctPlayers.filter((p) => p.isAlive).length,
    [ctPlayers]
  );

  const tTotalHp = useMemo(
    () =>
      tPlayers.reduce((acc, p) => acc + (p.isAlive ? p.health : 0), 0),
    [tPlayers]
  );
  const ctTotalHp = useMemo(
    () =>
      ctPlayers.reduce((acc, p) => acc + (p.isAlive ? p.health : 0), 0),
    [ctPlayers]
  );

  const filteredPlayers = useMemo(() => {
    if (!payload?.players) return [];
    if (!playerSearch.trim()) return payload.players;
    const q = playerSearch.toLowerCase();
    return payload.players.filter(
      (p) =>
        p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)
    );
  }, [payload, playerSearch]);

  const selectedPlayer = useMemo(() => {
    if (!selectedPlayerId || !payload?.players) return null;
    return (
      payload.players.find((p) => p.id === selectedPlayerId) ?? null
    );
  }, [selectedPlayerId, payload]);

  // Status Badge Configuration
  const isWs = streamMode === "websocket";
  const badgeConfig = {
    live: {
      label: isWs ? "WS STREAM LIVE" : "HTTP STREAM LIVE",
      color: "text-emerald-400",
      dot: "bg-emerald-400",
      bg: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
    },
    awaiting: {
      label: isWs ? "WS AWAITING DATA" : "HTTP AWAITING DATA",
      color: "text-amber-400",
      dot: "bg-amber-400",
      bg: "bg-amber-500/10 border-amber-500/30 text-amber-300",
    },
    connecting: {
      label: "CONNECTING...",
      color: "text-sky-400",
      dot: "bg-sky-400 animate-ping",
      bg: "bg-sky-500/10 border-sky-500/30 text-sky-300",
    },
    offline: {
      label: "SOCKET OFFLINE",
      color: "text-rose-400",
      dot: "bg-rose-500",
      bg: "bg-rose-500/10 border-rose-500/30 text-rose-300",
    },
  }[status];

  if (!mounted) {
    return <div className="h-screen w-screen bg-[#090a0f]" />;
  }

  const getInspectorHeightClass = () => {
    if (inspectorSize === "compact") return "h-44";
    if (inspectorSize === "expanded") return "h-80 md:h-96";
    return "h-44";
  };

  return (
    <div
      className="h-screen w-screen bg-[#090a0f] text-slate-100 flex flex-col font-sans overflow-hidden select-none relative"
      suppressHydrationWarning
    >
      {/* ── Toast Notification ── */}
      {copiedToast && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 animate-toast pointer-events-none">
          <div className="bg-[#141824] text-slate-100 font-mono text-xs px-4 py-2 rounded-full shadow-2xl shadow-black/80 flex items-center gap-2 border border-cyan-500/40 backdrop-blur-xl">
            <Check className="w-3.5 h-3.5 text-cyan-400" />
            <span>{copiedToast}</span>
          </div>
        </div>
      )}

      {/* ── Top Command Bar (Linear/Vercel Style) ── */}
      <header
        className={`h-12 border-b border-white/[0.06] bg-[#0c0e14]/90 backdrop-blur-xl px-3 sm:px-4 flex items-center justify-between gap-2 shrink-0 z-30 transition-all duration-300 ${
          isFullscreen ? "-translate-y-14 opacity-0 pointer-events-none" : "translate-y-0 opacity-100"
        }`}
      >
        {/* Left Branding & Mobile Menu Trigger */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {/* Mobile Drawer Trigger Button */}
          <button
            onClick={() => setMobileDrawerOpen(true)}
            className="lg:hidden p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] active:scale-95 border border-white/[0.08] text-slate-300 hover:text-white flex items-center gap-1.5 min-h-[38px] transition-all"
            title="Open Mobile Roster & Settings Drawer"
            aria-label="Open Mobile Drawer"
          >
            <Menu className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="text-xs font-mono font-bold text-slate-200">
              {tAlive + ctAlive} ALIVE
            </span>
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center font-mono font-black text-[11px] text-white shadow-sm shadow-cyan-500/20 border border-white/20 shrink-0">
              CS2
            </div>
            <div className="truncate hidden xs:block">
              <div className="flex items-center gap-1.5 leading-none">
                <span className="text-xs font-mono font-bold tracking-wider uppercase text-white truncate">
                  TACTICAL RADAR
                </span>
                <span className="text-[9px] text-cyan-400 font-mono font-semibold px-1.5 py-0.2 rounded bg-cyan-500/10 border border-cyan-500/20 shrink-0">
                  PRO
                </span>
              </div>
            </div>
          </div>

          <div className="h-4 w-px bg-white/[0.08] hidden md:block" />

          {/* Current Map Chip */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs font-mono bg-white/[0.03] px-2.5 py-1 rounded-md border border-white/[0.05]">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: currentMap.accent }}
            />
            <span className="text-slate-200 font-medium">{currentMap.displayName}</span>
            <span className="text-slate-500 text-[10px]">({currentMap.id})</span>
          </div>
        </div>

        {/* Center: Stream Protocol Toggle + Match Health Status (Desktop) */}
        <div className="hidden lg:flex items-center gap-4">
          {/* Protocol Toggle */}
          <div className="flex items-center bg-black/40 border border-white/[0.08] p-0.5 rounded-lg">
            <button
              onClick={() => setStreamMode("websocket")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-medium transition-all flex items-center gap-1.5 ${
                streamMode === "websocket"
                  ? "bg-[#181c28] text-amber-300 border border-amber-500/30 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title="Real-time WebSocket streaming socket"
            >
              <Zap className="w-3 h-3 text-amber-400" />
              <span>WEBSOCKET</span>
            </button>
            <button
              onClick={() => setStreamMode("http")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-medium transition-all flex items-center gap-1.5 ${
                streamMode === "http"
                  ? "bg-[#181c28] text-cyan-300 border border-cyan-500/30 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title="HTTP POST telemetry polling"
            >
              <Globe className="w-3 h-3 text-cyan-400" />
              <span>HTTP POST</span>
            </button>
          </div>

          {/* Match Roster Balance Indicator */}
          <div className="flex items-center gap-3 bg-black/30 border border-white/[0.06] px-3 py-1 rounded-lg">
            {/* T Side */}
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
              <div className="flex items-center gap-1.5 font-mono text-[11px]">
                <span className="text-amber-400 font-semibold">T</span>
                <span className="text-slate-300 font-bold">
                  {tAlive}/{tPlayers.length || 0}
                </span>
                <span className="text-slate-500 text-[10px]">({tTotalHp} HP)</span>
              </div>
            </div>

            <span className="text-slate-600 font-mono text-[10px] font-bold">VS</span>

            {/* CT Side */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 font-mono text-[11px]">
                <span className="text-slate-500 text-[10px]">({ctTotalHp} HP)</span>
                <span className="text-slate-300 font-bold">
                  {ctAlive}/{ctPlayers.length || 0}
                </span>
                <span className="text-cyan-400 font-semibold">CT</span>
              </div>
              <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" />
            </div>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Status Indicator */}
          <div
            className={`hidden sm:flex items-center gap-1.5 border rounded-lg px-2.5 py-1 text-[11px] font-mono font-medium transition-all ${badgeConfig.bg}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${badgeConfig.dot}`} />
            <span className="truncate">{badgeConfig.label}</span>
          </div>

          {/* Performance Pill: FPS & Ping */}
          <div className="hidden md:flex items-center gap-2 bg-black/40 border border-white/[0.06] rounded-lg px-2.5 py-1 text-[11px] font-mono">
            <div className="flex items-center gap-1">
              <Activity className="w-3 h-3 text-slate-500" />
              <span className={fps >= 50 ? "text-emerald-400 font-semibold" : "text-amber-400 font-semibold"}>
                {fps} FPS
              </span>
            </div>
            <span className="text-slate-700">|</span>
            <div className="flex items-center gap-1">
              <span className="text-slate-500 text-[10px]">PING</span>
              <span className={latency !== null && latency < 50 ? "text-emerald-400 font-semibold" : "text-amber-400 font-semibold"}>
                {latency !== null ? `${latency}ms` : "--"}
              </span>
            </div>
          </div>

          {/* Audio Feedback Button */}
          <button
            onClick={() => {
              setAudioEnabled((v) => {
                sfx.enabled = !v;
                return !v;
              });
            }}
            className={`p-2 rounded-lg border text-xs font-mono transition-all active:scale-95 min-h-[38px] flex items-center justify-center ${
              audioEnabled
                ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-300"
                : "bg-white/[0.03] border-white/[0.06] text-slate-400 hover:text-slate-200 hover:border-white/[0.12]"
            }`}
            title="Toggle Radar Audio Ping (Key: M)"
            aria-label="Toggle Audio"
          >
            {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Demo Simulator Toggle */}
          <button
            onClick={() => setUseMock((v) => !v)}
            className={`text-xs font-mono font-medium px-2.5 py-1.5 rounded-lg border transition-all active:scale-95 flex items-center gap-1.5 min-h-[38px] ${
              useMock
                ? "bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-sm"
                : "bg-white/[0.03] border-white/[0.06] text-slate-400 hover:text-slate-200 hover:border-white/[0.12]"
            }`}
            title="Toggle Live Demo Simulator (Key: D)"
            aria-label="Toggle Demo Simulation"
          >
            {useMock ? <Pause className="w-3.5 h-3.5 text-amber-400" /> : <Play className="w-3.5 h-3.5 text-slate-400" />}
            <span className="hidden sm:inline">{useMock ? "SIMULATOR ON" : "DEMO SIM"}</span>
          </button>

          {/* Landscape Fullscreen Quick Button */}
          <button
            onClick={toggleFullscreenLandscape}
            className="flex items-center gap-1.5 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/30 hover:to-blue-500/30 border border-cyan-500/40 text-cyan-300 text-xs font-mono font-bold px-2.5 sm:px-3 py-1.5 rounded-lg transition-all active:scale-95 min-h-[38px] shadow-sm"
            title="Rotate & Open Fullscreen Landscape (Key: L)"
            aria-label="Fullscreen Landscape"
          >
            <Smartphone className="w-3.5 h-3.5 rotate-90 text-cyan-400" />
            <span className="hidden sm:inline">LANDSCAPE</span>
          </button>

          {/* Regular Fullscreen Button */}
          <button
            onClick={() => toggleFullscreen(false)}
            className="hidden sm:flex items-center gap-1.5 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/[0.15] text-slate-300 hover:text-white text-xs font-mono font-medium px-2.5 py-1.5 rounded-lg transition-all active:scale-95 min-h-[38px]"
            title="Toggle Fullscreen (Key: F)"
            aria-label="Toggle Fullscreen"
          >
            <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden md:inline">FULLSCREEN</span>
          </button>
        </div>
      </header>

      {/* ── Mobile Slide-in Drawer (Roster & Settings) ── */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop */}
          <div
            onClick={() => setMobileDrawerOpen(false)}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm animate-fade-in transition-opacity"
          />

          {/* Drawer Body */}
          <div className="relative w-[85%] max-w-sm bg-[#0c0e14]/98 border-r border-white/[0.1] h-full flex flex-col z-10 shadow-2xl animate-slide-up overflow-hidden">
            {/* Drawer Header */}
            <div className="p-3 border-b border-white/[0.08] flex items-center justify-between bg-black/40">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-md bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-mono font-bold text-xs">
                  CS2
                </div>
                <div>
                  <div className="text-xs font-mono font-bold text-white uppercase">COMMAND MENU</div>
                  <div className="text-[10px] font-mono text-cyan-400">{tAlive + ctAlive} PLAYERS ALIVE</div>
                </div>
              </div>

              <button
                onClick={() => setMobileDrawerOpen(false)}
                className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-white/[0.08] active:scale-95"
                aria-label="Close Mobile Drawer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Navigation Tabs */}
            <div className="p-2 border-b border-white/[0.06] bg-black/20 grid grid-cols-2 gap-1.5">
              <button
                onClick={() => setSidebarTab("players")}
                className={`py-2 px-3 rounded-lg text-xs font-mono font-bold transition-all flex items-center justify-center gap-2 border ${
                  sidebarTab === "players"
                    ? "bg-[#181c28] text-cyan-300 border-cyan-500/40 shadow-sm"
                    : "bg-black/30 border-white/[0.04] text-slate-400 hover:text-slate-200"
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>ROSTER ({payload?.players.length ?? 0})</span>
              </button>
              <button
                onClick={() => setSidebarTab("settings")}
                className={`py-2 px-3 rounded-lg text-xs font-mono font-bold transition-all flex items-center justify-center gap-2 border ${
                  sidebarTab === "settings"
                    ? "bg-[#181c28] text-cyan-300 border-cyan-500/40 shadow-sm"
                    : "bg-black/30 border-white/[0.04] text-slate-400 hover:text-slate-200"
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>MAPS & PREFS</span>
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-2.5 space-y-3">
              {sidebarTab === "players" ? (
                <div className="space-y-3">
                  {/* Team Filter Segmented Switch */}
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => setSidebarTeamTab("T")}
                      className={`py-2 px-2.5 rounded-xl text-xs font-mono font-bold transition-all flex items-center justify-between border ${
                        sidebarTeamTab === "T"
                          ? "bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-sm"
                          : "bg-black/30 border-white/[0.04] text-slate-400"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                        <span>TERRORISTS</span>
                      </div>
                      <span className="text-[11px] font-bold opacity-90">{tAlive}/{tPlayers.length}</span>
                    </button>

                    <button
                      onClick={() => setSidebarTeamTab("CT")}
                      className={`py-2 px-2.5 rounded-xl text-xs font-mono font-bold transition-all flex items-center justify-between border ${
                        sidebarTeamTab === "CT"
                          ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-300 shadow-sm"
                          : "bg-black/30 border-white/[0.04] text-slate-400"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-cyan-400" />
                        <span>COUNTER-T</span>
                      </div>
                      <span className="text-[11px] font-bold opacity-90">{ctAlive}/{ctPlayers.length}</span>
                    </button>
                  </div>

                  {/* Player Cards */}
                  <div className="space-y-2">
                    {sidebarTeamTab === "T" ? (
                      tPlayers.length > 0 ? (
                        tPlayers.map((p) => (
                          <PlayerCard
                            key={p.id}
                            player={p}
                            isFocused={selectedPlayerId === p.id}
                            isFollowing={selectedPlayerId === p.id && isFollowingPlayer}
                            onSelect={() => {
                              handleSelectPlayer(p.id);
                              setMobileDrawerOpen(false);
                            }}
                            onToggleFollow={toggleFollowPlayer}
                          />
                        ))
                      ) : (
                        <div className="p-8 text-center text-slate-500 font-mono text-xs">
                          No Terrorists registered.
                        </div>
                      )
                    ) : ctPlayers.length > 0 ? (
                      ctPlayers.map((p) => (
                        <PlayerCard
                          key={p.id}
                          player={p}
                          isFocused={selectedPlayerId === p.id}
                          isFollowing={selectedPlayerId === p.id && isFollowingPlayer}
                          onSelect={() => {
                            handleSelectPlayer(p.id);
                            setMobileDrawerOpen(false);
                          }}
                          onToggleFollow={toggleFollowPlayer}
                        />
                      ))
                    ) : (
                      <div className="p-8 text-center text-slate-500 font-mono text-xs">
                        No Counter-Terrorists registered.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Mobile Maps & Settings */
                <div className="space-y-4">
                  {/* Map Selector */}
                  <div className="space-y-2">
                    <div className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span>COMPETITIVE MAP POOL</span>
                      <span className="text-[10px] text-cyan-400 font-bold">{MAPS.length} MAPS</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {MAPS.map((m) => {
                        const isSelected = selectedMap === m.id;
                        return (
                          <button
                            key={m.id}
                            onClick={() => {
                              handleMapChange(m.id);
                              setMobileDrawerOpen(false);
                            }}
                            className={`text-left p-2.5 rounded-xl text-xs font-mono transition-all flex items-center justify-between border truncate active:scale-95 ${
                              isSelected
                                ? "bg-cyan-500/20 border-cyan-500/60 text-cyan-300 font-bold shadow-md"
                                : "border-white/[0.06] bg-black/30 text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: m.accent }}
                              />
                              <span className="truncate">{m.displayName}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* HUD Preferences */}
                  <div className="space-y-2">
                    <div className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                      RADAR HUD PREFERENCES
                    </div>
                    <div className="space-y-1.5">
                      <ToggleSwitch
                        label="Player Names"
                        checked={showNames}
                        onChange={setShowNames}
                        icon={<Users className="w-3.5 h-3.5" />}
                      />
                      <ToggleSwitch
                        label="FOV Vision Cones"
                        checked={showVisionCones}
                        onChange={setShowVisionCones}
                        icon={<Eye className="w-3.5 h-3.5" />}
                      />
                      <ToggleSwitch
                        label="Active Smokes"
                        checked={showSmokes}
                        onChange={setShowSmokes}
                        icon={<Wind className="w-3.5 h-3.5" />}
                      />
                      <ToggleSwitch
                        label="Active Molotovs"
                        checked={showMolotovs}
                        onChange={setShowMolotovs}
                        icon={<Flame className="w-3.5 h-3.5" />}
                      />
                      <ToggleSwitch
                        label="Dropped Weapons"
                        checked={showGuns}
                        onChange={setShowGuns}
                        icon={<Layers className="w-3.5 h-3.5" />}
                      />
                      <ToggleSwitch
                        label="Tactical Reticle"
                        checked={showGrid}
                        onChange={setShowGrid}
                        icon={<Grid className="w-3.5 h-3.5" />}
                      />
                    </div>
                  </div>

                  {/* Landscape Mode Button in Drawer */}
                  <div className="pt-2">
                    <button
                      onClick={() => {
                        setMobileDrawerOpen(false);
                        toggleFullscreenLandscape();
                      }}
                      className="w-full py-2.5 px-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-mono font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 active:scale-95"
                    >
                      <Smartphone className="w-4 h-4 rotate-90" />
                      <span>START LANDSCAPE FULLSCREEN</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Main Workspace ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        {/* ── Left Tactical Ops Sidebar (Desktop) ── */}
        <aside
          className={`shrink-0 bg-[#0c0e14]/90 backdrop-blur-xl border-r border-white/[0.06] hidden lg:flex flex-col transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isFullscreen
              ? "-translate-x-full opacity-0 pointer-events-none w-0"
              : sidebarCollapsed
              ? "w-12"
              : "w-76 md:w-80"
          } overflow-hidden z-20`}
        >
          {/* Sidebar Header & Tabs */}
          <div className="p-2 border-b border-white/[0.06] flex items-center justify-between gap-2">
            {!sidebarCollapsed ? (
              <div className="flex items-center bg-black/40 border border-white/[0.06] p-0.5 rounded-lg flex-1">
                <button
                  onClick={() => setSidebarTab("players")}
                  className={`flex-1 py-1 rounded-md text-xs font-mono font-medium transition-all flex items-center justify-center gap-1.5 ${
                    sidebarTab === "players"
                      ? "bg-[#181c28] text-white border border-white/[0.08] shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Users className="w-3 h-3 text-cyan-400" />
                  <span>ROSTER ({payload?.players.length ?? 0})</span>
                </button>
                <button
                  onClick={() => setSidebarTab("settings")}
                  className={`flex-1 py-1 rounded-md text-xs font-mono font-medium transition-all flex items-center justify-center gap-1.5 ${
                    sidebarTab === "settings"
                      ? "bg-[#181c28] text-white border border-white/[0.08] shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Sliders className="w-3 h-3 text-slate-400" />
                  <span>SETTINGS</span>
                </button>
              </div>
            ) : (
              <div className="w-full flex justify-center">
                <Target className="w-4 h-4 text-cyan-400" />
              </div>
            )}

            <button
              onClick={() => setSidebarCollapsed((v) => !v)}
              className="p-1 rounded-md bg-white/[0.02] hover:bg-white/[0.08] text-slate-400 hover:text-white border border-white/[0.06] transition-colors"
              title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {sidebarCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
            </button>
          </div>

          {!sidebarCollapsed && (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {sidebarTab === "players" ? (
                /* PLAYERS ROSTER TAB */
                <div className="flex-1 flex flex-col min-h-0">
                  {/* Team Filter Segmented Switch */}
                  <div className="p-2 border-b border-white/[0.04] grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => setSidebarTeamTab("T")}
                      className={`py-1.5 px-2 rounded-lg text-xs font-mono font-semibold transition-all flex items-center justify-between border ${
                        sidebarTeamTab === "T"
                          ? "bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-sm"
                          : "bg-black/30 border-white/[0.04] text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        <span>TERRORISTS</span>
                      </div>
                      <span className="text-[10px] font-bold opacity-80">
                        {tAlive}/{tPlayers.length}
                      </span>
                    </button>

                    <button
                      onClick={() => setSidebarTeamTab("CT")}
                      className={`py-1.5 px-2 rounded-lg text-xs font-mono font-semibold transition-all flex items-center justify-between border ${
                        sidebarTeamTab === "CT"
                          ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-300 shadow-sm"
                          : "bg-black/30 border-white/[0.04] text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                        <span>COUNTER-T</span>
                      </div>
                      <span className="text-[10px] font-bold opacity-80">
                        {ctAlive}/{ctPlayers.length}
                      </span>
                    </button>
                  </div>

                  {/* Player Cards List */}
                  <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                    {sidebarTeamTab === "T" ? (
                      tPlayers.length > 0 ? (
                        tPlayers.map((p) => (
                          <PlayerCard
                            key={p.id}
                            player={p}
                            isFocused={selectedPlayerId === p.id}
                            isFollowing={selectedPlayerId === p.id && isFollowingPlayer}
                            onSelect={() => handleSelectPlayer(p.id)}
                            onToggleFollow={toggleFollowPlayer}
                          />
                        ))
                      ) : (
                        <div className="p-6 text-center text-slate-500 font-mono text-xs">
                          No Terrorists registered.
                        </div>
                      )
                    ) : ctPlayers.length > 0 ? (
                      ctPlayers.map((p) => (
                        <PlayerCard
                          key={p.id}
                          player={p}
                          isFocused={selectedPlayerId === p.id}
                          isFollowing={selectedPlayerId === p.id && isFollowingPlayer}
                          onSelect={() => handleSelectPlayer(p.id)}
                          onToggleFollow={toggleFollowPlayer}
                        />
                      ))
                    ) : (
                      <div className="p-6 text-center text-slate-500 font-mono text-xs">
                        No Counter-Terrorists registered.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* SETTINGS TAB */
                <div className="flex-1 overflow-y-auto p-3 space-y-4">
                  {/* Competitive Pool Grid */}
                  <div className="space-y-2">
                    <div className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span>COMPETITIVE MAP POOL</span>
                      <span className="text-[10px] text-cyan-400 font-bold">
                        {MAPS.length} MAPS
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      {MAPS.map((m) => {
                        const isSelected = selectedMap === m.id;
                        return (
                          <button
                            key={m.id}
                            onClick={() => handleMapChange(m.id)}
                            className={`text-left px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center justify-between border truncate ${
                              isSelected
                                ? "bg-cyan-500/15 border-cyan-500/50 text-cyan-300 font-semibold shadow-sm"
                                : "border-white/[0.04] bg-black/20 text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
                            }`}
                            title={m.displayName}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span
                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                style={{ backgroundColor: m.accent }}
                              />
                              <span className="truncate">{m.displayName}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* HUD Preferences */}
                  <div className="space-y-2">
                    <div className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                      RADAR HUD PREFERENCES
                    </div>
                    <div className="space-y-1">
                      <ToggleSwitch
                        label="Player Names"
                        shortcut="N"
                        checked={showNames}
                        onChange={setShowNames}
                        icon={<Users className="w-3.5 h-3.5" />}
                      />
                      <ToggleSwitch
                        label="FOV Vision Cones"
                        shortcut="V"
                        checked={showVisionCones}
                        onChange={setShowVisionCones}
                        icon={<Eye className="w-3.5 h-3.5" />}
                      />
                      <ToggleSwitch
                        label="Active Smokes"
                        shortcut="S"
                        checked={showSmokes}
                        onChange={setShowSmokes}
                        icon={<Wind className="w-3.5 h-3.5" />}
                      />
                      <ToggleSwitch
                        label="Active Molotovs"
                        shortcut="K"
                        checked={showMolotovs}
                        onChange={setShowMolotovs}
                        icon={<Flame className="w-3.5 h-3.5" />}
                      />
                      <ToggleSwitch
                        label="Dropped Weapons"
                        shortcut="U"
                        checked={showGuns}
                        onChange={setShowGuns}
                        icon={<Layers className="w-3.5 h-3.5" />}
                      />
                      <ToggleSwitch
                        label="Tactical Reticle"
                        shortcut="G"
                        checked={showGrid}
                        onChange={setShowGrid}
                        icon={<Grid className="w-3.5 h-3.5" />}
                      />
                      <ToggleSwitch
                        label="Auto-Follow Map"
                        shortcut="Auto"
                        checked={autoFollowMap}
                        onChange={setAutoFollowMap}
                        icon={<Sparkles className="w-3.5 h-3.5" />}
                      />

                      {/* Radar Zoom Slider */}
                      <div className="p-2.5 rounded-xl bg-black/30 border border-white/[0.05] space-y-1.5 mt-2">
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span className="text-slate-400">Radar Zoom:</span>
                          <span className="text-cyan-400 font-semibold">{radarZoom.toFixed(1)}x</span>
                        </div>
                        <input
                          type="range"
                          min="0.8"
                          max="1.5"
                          step="0.1"
                          value={radarZoom}
                          onChange={(e) => setRadarZoom(parseFloat(e.target.value))}
                          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Actions (Clear Radar) */}
                  <div className="pt-2">
                    <button
                      onClick={handleClearRadar}
                      className="w-full py-2 px-3 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 text-rose-300 text-xs font-mono font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>CLEAR RADAR STATE</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </aside>

        {/* ── Main Radar Canvas & Inspector Deck ── */}
        <main
          className={`flex-1 flex flex-col min-w-0 min-h-0 transition-all duration-300 ${
            isFullscreen ? "p-0 gap-0" : "p-2 sm:p-3 gap-2 sm:gap-3"
          }`}
        >
          {/* Radar Viewport */}
          <div
            ref={radarContainerRef}
            className={`flex-1 min-h-0 bg-[#06080e] overflow-hidden relative flex items-center justify-center transition-all duration-300 ${
              isFullscreen
                ? "h-screen w-screen !border-0 !rounded-none"
                : "rounded-xl sm:rounded-2xl border border-white/[0.07] shadow-2xl"
            }`}
          >
            <RadarCanvas
              mapId={selectedMap}
              payload={payload}
              onFpsUpdate={setFps}
              showGrid={showGrid}
              showNames={showNames}
              showVisionCones={showVisionCones}
              showSmokes={showSmokes}
              showMolotovs={showMolotovs}
              showGuns={showGuns}
              radarZoom={radarZoom}
              focusedPlayerId={selectedPlayerId}
              isFollowingPlayer={isFollowingPlayer}
              onSelectPlayer={handleSelectPlayer}
              onZoomChange={setRadarZoom}
            />

            {/* Top-Left Tactical Badge */}
            <div className="absolute top-2.5 left-2.5 sm:top-3 sm:left-3 flex items-center gap-2 pointer-events-none z-10">
              <div className="bg-[#0e1017]/85 backdrop-blur-md border border-white/[0.08] rounded-lg px-2.5 sm:px-3 py-1 flex items-center gap-2 shadow-lg">
                <span
                  className="w-2 h-2 rounded-full shadow-sm"
                  style={{ backgroundColor: currentMap.accent }}
                />
                <span className="text-xs font-mono font-bold uppercase text-white">
                  {currentMap.displayName}
                </span>
                <span className="text-[10px] font-mono text-slate-500 hidden xs:inline">
                  {currentMap.id}
                </span>
              </div>

              {/* Utility Entity Count Badges */}
              <div className="hidden sm:flex items-center gap-2 bg-[#0e1017]/85 backdrop-blur-md border border-white/[0.08] rounded-lg px-2.5 py-1 text-xs font-mono shadow-lg">
                <span className="text-slate-300 flex items-center gap-1">
                  <Wind className="w-3 h-3 text-slate-400" />
                  <span>{payload?.smokes?.length ?? 0}</span>
                </span>
                <span className="text-slate-700">•</span>
                <span className="text-amber-400 flex items-center gap-1">
                  <Flame className="w-3 h-3" />
                  <span>{payload?.molotovs?.length ?? 0}</span>
                </span>
                <span className="text-slate-700">•</span>
                <span className="text-cyan-400 flex items-center gap-1">
                  <Layers className="w-3 h-3" />
                  <span>{payload?.guns?.length ?? 0}</span>
                </span>
              </div>

              {isFullscreen && (
                <div className="bg-[#0e1017]/85 backdrop-blur-md border border-white/[0.08] rounded-lg px-2.5 sm:px-3 py-1 flex items-center gap-2 text-xs font-mono shadow-lg">
                  <span className="text-amber-400 font-semibold">{tAlive} T</span>
                  <span className="text-slate-600">vs</span>
                  <span className="text-cyan-400 font-semibold">{ctAlive} CT</span>
                  <span className="text-emerald-400 font-semibold hidden sm:inline">{fps} FPS</span>
                </div>
              )}
            </div>

            {/* ── Floating Mobile / Fullscreen Quick Controls Bar ── */}
            <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 z-40 flex items-center gap-1.5 bg-[#0e111a]/90 backdrop-blur-xl border border-white/[0.1] p-1.5 rounded-2xl shadow-2xl pointer-events-auto">
              {/* Zoom Out Button */}
              <button
                onClick={() => setRadarZoom((z) => Math.max(0.6, Number((z - 0.2).toFixed(2))))}
                className="w-9 h-9 rounded-xl bg-black/40 hover:bg-slate-800 active:scale-90 border border-white/[0.06] text-slate-200 hover:text-white flex items-center justify-center transition-all"
                title="Zoom Out (-)"
                aria-label="Zoom Out"
              >
                <Minus className="w-4 h-4" />
              </button>

              {/* Reset View Button */}
              <button
                onClick={resetRadarView}
                className="h-9 px-2.5 rounded-xl bg-black/40 hover:bg-slate-800 active:scale-90 border border-white/[0.06] text-cyan-300 hover:text-white text-xs font-mono font-bold flex items-center justify-center gap-1 transition-all"
                title="Reset View (1.0x)"
                aria-label="Reset View"
              >
                <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
                <span>{radarZoom.toFixed(1)}x</span>
              </button>

              {/* Zoom In Button */}
              <button
                onClick={() => setRadarZoom((z) => Math.min(3.5, Number((z + 0.2).toFixed(2))))}
                className="w-9 h-9 rounded-xl bg-black/40 hover:bg-slate-800 active:scale-90 border border-white/[0.06] text-slate-200 hover:text-white flex items-center justify-center transition-all"
                title="Zoom In (+)"
                aria-label="Zoom In"
              >
                <Plus className="w-4 h-4" />
              </button>

              {/* Layers Quick Toggle */}
              <button
                onClick={() => setMobileLayersOpen((v) => !v)}
                className={`h-9 px-2.5 rounded-xl border text-xs font-mono font-semibold flex items-center justify-center gap-1 transition-all active:scale-90 ${
                  mobileLayersOpen
                    ? "bg-cyan-500/25 border-cyan-500/60 text-cyan-200 shadow-md"
                    : "bg-black/40 border-white/[0.06] text-slate-300 hover:text-white"
                }`}
                title="Toggle Tactical Radar Layers"
                aria-label="Toggle Layers"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden sm:inline">LAYERS</span>
              </button>

              {/* Mobile Drawer Trigger in Bar */}
              <button
                onClick={() => setMobileDrawerOpen(true)}
                className="lg:hidden h-9 px-2.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 text-xs font-mono font-bold flex items-center justify-center gap-1 transition-all active:scale-90"
                title="Open Roster & Maps Menu"
                aria-label="Open Roster Menu"
              >
                <Users className="w-3.5 h-3.5" />
                <span>{tAlive + ctAlive}</span>
              </button>

              {/* Landscape Fullscreen Quick Switcher */}
              <button
                onClick={toggleFullscreenLandscape}
                className="h-9 px-2.5 rounded-xl bg-gradient-to-r from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/30 hover:to-blue-500/30 border border-cyan-500/40 text-cyan-200 text-xs font-mono font-bold flex items-center justify-center gap-1 transition-all active:scale-90"
                title="Toggle Landscape Fullscreen Mode"
                aria-label="Landscape Fullscreen"
              >
                <Smartphone className="w-3.5 h-3.5 rotate-90 text-cyan-400" />
                <span className="hidden sm:inline">LANDSCAPE</span>
              </button>
            </div>

            {/* ── Quick Tactical Layers Popover Modal ── */}
            {mobileLayersOpen && (
              <div className="absolute bottom-16 right-3 sm:bottom-18 sm:right-4 z-40 w-64 bg-[#0e111a]/95 backdrop-blur-2xl border border-white/[0.1] p-3 rounded-2xl shadow-2xl space-y-2 animate-slide-up pointer-events-auto">
                <div className="flex items-center justify-between border-b border-white/[0.08] pb-1.5">
                  <span className="text-xs font-mono font-bold text-slate-200 uppercase flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
                    <span>TACTICAL LAYERS</span>
                  </span>
                  <button
                    onClick={() => setMobileLayersOpen(false)}
                    className="p-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>

                <div className="space-y-1">
                  <ToggleSwitch
                    label="Player Names"
                    shortcut="N"
                    checked={showNames}
                    onChange={setShowNames}
                    icon={<Users className="w-3.5 h-3.5" />}
                  />
                  <ToggleSwitch
                    label="FOV Cones"
                    shortcut="V"
                    checked={showVisionCones}
                    onChange={setShowVisionCones}
                    icon={<Eye className="w-3.5 h-3.5" />}
                  />
                  <ToggleSwitch
                    label="Smokes"
                    shortcut="S"
                    checked={showSmokes}
                    onChange={setShowSmokes}
                    icon={<Wind className="w-3.5 h-3.5" />}
                  />
                  <ToggleSwitch
                    label="Molotovs"
                    shortcut="K"
                    checked={showMolotovs}
                    onChange={setShowMolotovs}
                    icon={<Flame className="w-3.5 h-3.5" />}
                  />
                  <ToggleSwitch
                    label="Dropped Guns"
                    shortcut="U"
                    checked={showGuns}
                    onChange={setShowGuns}
                    icon={<Layers className="w-3.5 h-3.5" />}
                  />
                  <ToggleSwitch
                    label="Tactical Grid"
                    shortcut="G"
                    checked={showGrid}
                    onChange={setShowGrid}
                    icon={<Grid className="w-3.5 h-3.5" />}
                  />
                </div>
              </div>
            )}

            {/* ── Focused Player Floating Tactical HUD & Follow Controller ── */}
            {selectedPlayer && (
              isFollowHudMinimized ? (
                /* Minimized Pill Badge (Draggable & Expandable) */
                <div
                  onPointerDown={handleFollowHudPointerDown}
                  onPointerMove={handleFollowHudPointerMove}
                  onPointerUp={handleFollowHudPointerUp}
                  style={
                    followHudPos
                      ? { left: followHudPos.x, top: followHudPos.y, position: "absolute" }
                      : { bottom: 16, left: "50%", transform: "translateX(-50%)", position: "absolute" }
                  }
                  className={`z-50 bg-[#0e111a]/95 backdrop-blur-xl border border-white/[0.1] rounded-xl px-3 py-1.5 shadow-2xl shadow-black/90 flex items-center gap-2 select-none animate-fade-in pointer-events-auto ${
                    isDraggingFollowHud ? "cursor-grabbing" : "cursor-grab"
                  }`}
                >
                  <GripHorizontal className="w-3.5 h-3.5 text-slate-500" />
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
                      selectedPlayer.team === "T"
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                        : "bg-cyan-500/20 text-cyan-200 border border-cyan-500/30"
                    }`}
                  >
                    {selectedPlayer.team}
                  </span>
                  <span className="font-mono font-bold text-xs text-white max-w-[120px] truncate">
                    {selectedPlayer.name}
                  </span>
                  <button
                    onClick={toggleFollowPlayer}
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border transition-all flex items-center gap-1 ${
                      isFollowingPlayer
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-400 animate-pulse"
                        : "bg-slate-800 hover:bg-slate-700 text-cyan-300 border-cyan-500/30"
                    }`}
                    title="Toggle Follow (Shortcut: T / P)"
                  >
                    <Crosshair className="w-2.5 h-2.5" />
                    <span>{isFollowingPlayer ? "TRACKING" : "FOLLOW"}</span>
                  </button>
                  <button
                    onClick={() => setIsFollowHudMinimized(false)}
                    className="px-2 py-0.5 rounded bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-[10px] font-mono font-bold flex items-center gap-1 transition-colors"
                    title="Reveal Controls"
                  >
                    <ChevronUp className="w-3 h-3" />
                    <span>REVEAL</span>
                  </button>
                  <button
                    onClick={() => handleSelectPlayer(null)}
                    className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-white/[0.06] text-xs transition-colors"
                    title="Unfocus Player (ESC)"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                /* Full Expanded HUD Panel (Draggable & Collapsible) */
                <div
                  style={
                    followHudPos
                      ? { left: followHudPos.x, top: followHudPos.y, position: "absolute" }
                      : { bottom: 20, left: "50%", transform: "translateX(-50%)", position: "absolute" }
                  }
                  className="z-50 w-[92%] max-w-lg bg-[#0e111a]/95 backdrop-blur-2xl border border-white/[0.1] rounded-2xl p-3 shadow-2xl shadow-black/90 flex flex-col gap-2 animate-slide-up pointer-events-auto select-none"
                >
                  {/* Top Row: Header, Stats, Follow Toggle, Controls */}
                  <div
                    onPointerDown={handleFollowHudPointerDown}
                    onPointerMove={handleFollowHudPointerMove}
                    onPointerUp={handleFollowHudPointerUp}
                    className={`flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap pb-1 border-b border-white/[0.06] ${
                      isDraggingFollowHud ? "cursor-grabbing" : "cursor-grab"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 pointer-events-none">
                      <GripHorizontal className="w-4 h-4 text-slate-500 shrink-0" />
                      <span
                        className={`px-1.5 py-0.5 rounded text-xs font-mono font-bold shrink-0 ${
                          selectedPlayer.team === "T"
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                            : "bg-cyan-500/20 text-cyan-200 border border-cyan-500/40"
                        }`}
                      >
                        {selectedPlayer.team}
                      </span>

                      {selectedPlayer.hasBomb && (
                        <span className="text-[10px] px-1.5 py-0.2 bg-rose-500/20 text-rose-200 rounded border border-rose-500/40 font-mono font-bold animate-pulse shrink-0">
                          C4
                        </span>
                      )}

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-white truncate">
                            {selectedPlayer.name}
                          </span>
                          <span className={`text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded shrink-0 ${
                            selectedPlayer.isAlive
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                              : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                          }`}>
                            {selectedPlayer.isAlive ? "ALIVE" : "DEAD"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400 mt-0.5">
                          {selectedPlayer.currentWeapon && (
                            <span className="text-amber-300 font-semibold">
                              {selectedPlayer.currentWeapon}
                            </span>
                          )}
                          <span>{selectedPlayer.health} HP</span>
                          <span>{selectedPlayer.armor} AP</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0 ml-auto pointer-events-auto">
                      <button
                        onClick={toggleFollowPlayer}
                        className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition-all flex items-center gap-1.5 shadow-md ${
                          isFollowingPlayer
                            ? "bg-emerald-500 text-slate-950 font-bold border border-emerald-300 shadow-emerald-500/30"
                            : "bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-white/[0.08]"
                        }`}
                        title="Toggle Follow Tracking Camera (Shortcut: T / P)"
                      >
                        <Crosshair className="w-3 h-3" />
                        <span>{isFollowingPlayer ? "TRACKING" : "FOLLOW"}</span>
                        <kbd className="text-[9px] px-1 bg-black/30 rounded">T</kbd>
                      </button>

                      <button
                        onClick={() => setIsFollowHudMinimized(true)}
                        className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-white/[0.08] transition-colors"
                        title="Minimize HUD"
                      >
                        <Minimize2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleSelectPlayer(null)}
                        className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-white/[0.08] transition-colors"
                        title="Unfocus Player (ESC)"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Bottom Row: Follow Zoom Level Slider & Presets */}
                  <div className="flex items-center justify-between gap-3 text-xs font-mono pointer-events-auto pt-0.5">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-slate-400 text-[11px]">Follow Zoom:</span>
                      <span className="text-cyan-400 font-semibold">{radarZoom.toFixed(1)}x</span>
                    </div>

                    <input
                      type="range"
                      min="0.6"
                      max="3.5"
                      step="0.1"
                      value={radarZoom}
                      onChange={(e) => setRadarZoom(parseFloat(e.target.value))}
                      className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                    />

                    <div className="flex items-center gap-1 shrink-0">
                      {[1.0, 1.6, 2.2, 3.0].map((z) => (
                        <button
                          key={z}
                          onClick={() => setRadarZoom(z)}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-medium transition-colors ${
                            Math.abs(radarZoom - z) < 0.05
                              ? "bg-cyan-500/20 text-cyan-200 border border-cyan-500/40 font-bold"
                              : "bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-transparent"
                          }`}
                        >
                          {z}x
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )
            )}

            {/* In Fullscreen: Floating Draggable Player Overlay */}
            {isFullscreen && (
              <div
                style={
                  rosterPos
                    ? { left: rosterPos.x, top: rosterPos.y, position: "absolute" }
                    : { left: 16, top: 56, position: "absolute" }
                }
                className={`z-30 flex flex-col pointer-events-auto max-h-[calc(100vh-5rem)] ${
                  fullscreenPlayersVisible ? "w-76" : "w-auto"
                }`}
              >
                {fullscreenPlayersVisible ? (
                  <div className="flex flex-col bg-[#0e111a]/95 backdrop-blur-2xl border border-white/[0.08] rounded-2xl p-2.5 shadow-2xl space-y-2 overflow-hidden animate-fade-in max-h-full">
                    {/* Draggable Header */}
                    <div
                      onPointerDown={handleRosterPointerDown}
                      onPointerMove={handleRosterPointerMove}
                      onPointerUp={handleRosterPointerUp}
                      className={`flex items-center justify-between border-b border-white/[0.06] pb-1.5 shrink-0 select-none ${
                        isDraggingRoster ? "cursor-grabbing" : "cursor-grab"
                      }`}
                    >
                      <div className="flex items-center gap-2 pointer-events-none">
                        <GripHorizontal className="w-3.5 h-3.5 text-slate-500" />
                        <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                          SQUAD ROSTER
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                          {tAlive + ctAlive} ALIVE
                        </span>
                      </div>
                      <button
                        onClick={() => setFullscreenPlayersVisible(false)}
                        className="p-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-white/[0.06] transition-colors"
                        title="Collapse player roster"
                      >
                        <ChevronLeft className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Player Cards */}
                    <div className="overflow-y-auto space-y-2.5 pr-0.5 max-h-[calc(100vh-9rem)]">
                      {/* Terrorists Section */}
                      <div className="space-y-1.5">
                        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-1.5 flex items-center justify-between text-xs font-mono">
                          <span className="font-bold text-amber-400">TERRORISTS</span>
                          <span className="text-[10px] text-amber-300 font-semibold">
                            {tAlive}/{tPlayers.length} ALIVE ({tTotalHp} HP)
                          </span>
                        </div>
                        <div className="space-y-1">
                          {tPlayers.map((p) => (
                            <PlayerCard
                              key={p.id}
                              player={p}
                              isFocused={selectedPlayerId === p.id}
                              isFollowing={selectedPlayerId === p.id && isFollowingPlayer}
                              onSelect={() => handleSelectPlayer(p.id)}
                              onToggleFollow={toggleFollowPlayer}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Counter-Terrorists Section */}
                      <div className="space-y-1.5 pt-1">
                        <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-1.5 flex items-center justify-between text-xs font-mono">
                          <span className="font-bold text-cyan-400">COUNTER-TERRORISTS</span>
                          <span className="text-[10px] text-cyan-300 font-semibold">
                            {ctAlive}/{ctPlayers.length} ALIVE ({ctTotalHp} HP)
                          </span>
                        </div>
                        <div className="space-y-1">
                          {ctPlayers.map((p) => (
                            <PlayerCard
                              key={p.id}
                              player={p}
                              isFocused={selectedPlayerId === p.id}
                              isFollowing={selectedPlayerId === p.id && isFollowingPlayer}
                              onSelect={() => handleSelectPlayer(p.id)}
                              onToggleFollow={toggleFollowPlayer}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setFullscreenPlayersVisible(true)}
                    className="bg-[#0e111a]/95 hover:bg-slate-800 backdrop-blur-xl border border-white/[0.08] rounded-xl px-3 py-1.5 text-xs font-mono font-semibold text-white shadow-2xl flex items-center gap-2 transition-all"
                  >
                    <Users className="w-3.5 h-3.5 text-cyan-400" />
                    <span>ROSTER ({tAlive + ctAlive})</span>
                  </button>
                )}
              </div>
            )}

            {/* In Fullscreen: Discrete Exit Button */}
            {isFullscreen && (
              <div className="absolute top-3 right-3 z-20 animate-fade-in pointer-events-auto">
                <button
                  onClick={toggleFullscreen}
                  className="bg-[#0e111a]/85 hover:bg-slate-800 backdrop-blur-md border border-white/[0.08] text-slate-200 hover:text-white px-3 py-1 rounded-lg text-xs font-mono font-medium flex items-center gap-1.5 shadow-lg transition-all"
                  title="Exit Fullscreen (ESC / F)"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>EXIT FULLSCREEN</span>
                </button>
              </div>
            )}

            {/* Waiting for Data Overlay */}
            {!useMock && (!payload || payload.players.length === 0) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#090a0f]/80 backdrop-blur-xl z-20 animate-fade-in p-4">
                <div className="text-center space-y-3 max-w-sm p-6 bg-[#0e111a]/90 border border-white/[0.08] rounded-2xl shadow-2xl backdrop-blur-2xl">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 mx-auto flex items-center justify-center text-cyan-400">
                    <Radio className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-white font-mono font-bold text-xs tracking-wide uppercase">
                      {streamMode === "websocket"
                        ? "AWAITING WEBSOCKET STREAM"
                        : "AWAITING HTTP POST TELEMETRY"}
                    </h3>
                    <p className="text-slate-400 font-mono text-[11px] leading-relaxed mt-1">
                      {streamMode === "websocket" ? (
                        <>
                          Transmit live packets to{" "}
                          <code className="text-cyan-400 bg-black/40 px-1.5 py-0.5 rounded border border-white/[0.06]">
                            ws://localhost:3000/api/radar/ws
                          </code>
                        </>
                      ) : (
                        <>
                          Send JSON packets to{" "}
                          <code className="text-cyan-400 bg-black/40 px-1.5 py-0.5 rounded border border-white/[0.06]">
                            POST /api/radar
                          </code>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-2 pt-1">
                    <button
                      onClick={() =>
                        setStreamMode((m) =>
                          m === "websocket" ? "http" : "websocket"
                        )
                      }
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-white/[0.08] text-slate-200 text-xs font-mono font-medium rounded-lg transition-all"
                    >
                      {streamMode === "websocket"
                        ? "Switch to HTTP POST"
                        : "Switch to WebSocket"}
                    </button>
                    <button
                      onClick={() => setUseMock(true)}
                      className="px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-mono font-bold rounded-lg transition-all shadow-md shadow-cyan-500/20"
                    >
                      LAUNCH SIMULATOR
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Bottom Telemetry Inspector Deck ── */}
          <div
            className={`${getInspectorHeightClass()} shrink-0 bg-[#0c0e14]/90 border border-white/[0.06] rounded-2xl flex flex-col overflow-hidden backdrop-blur-xl shadow-2xl transition-all duration-300 ${
              isFullscreen
                ? "translate-y-24 opacity-0 pointer-events-none h-0 p-0 border-0"
                : inspectorSize === "modal"
                ? "hidden"
                : "translate-y-0 opacity-100"
            }`}
          >
            {/* Inspector Header & Controls */}
            <div className="h-9 border-b border-white/[0.06] px-3 flex items-center justify-between bg-black/30 gap-2">
              {/* Left Title & Status Badges */}
              <div className="flex items-center gap-2 shrink-0">
                <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider">
                  TELEMETRY INSPECTOR
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {payload?.players.length ?? 0} PLAYERS
                </span>
                <span className="text-[10px] font-mono text-slate-500 hidden lg:inline">
                  Sync: {timeAgo}
                </span>
              </div>

              {/* Center Search (Players / JSON) */}
              {activeTab === "players" && (
                <div className="flex-1 max-w-xs hidden sm:block relative">
                  <Search className="w-3 h-3 text-slate-500 absolute left-2 top-1.5" />
                  <input
                    type="text"
                    placeholder="Search player or SteamID..."
                    value={playerSearch}
                    onChange={(e) => setPlayerSearch(e.target.value)}
                    className="w-full bg-black/40 border border-white/[0.06] rounded-md pl-6 pr-2 py-0.5 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
              )}
              {activeTab === "raw" && (
                <div className="flex-1 max-w-xs hidden sm:block relative">
                  <Search className="w-3 h-3 text-slate-500 absolute left-2 top-1.5" />
                  <input
                    type="text"
                    placeholder="Filter in JSON payload..."
                    value={jsonSearchQuery}
                    onChange={(e) => setJsonSearchQuery(e.target.value)}
                    className="w-full bg-black/40 border border-white/[0.06] rounded-md pl-6 pr-2 py-0.5 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
              )}

              {/* Right Tab Switcher & Size Control Tools */}
              <div className="flex items-center gap-1 shrink-0">
                {/* Reset Radar */}
                <button
                  onClick={handleClearRadar}
                  className="px-2 py-0.5 rounded-md text-[11px] font-mono font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/20 transition-all mr-1"
                  title="Clear Radar State"
                >
                  RESET
                </button>

                {/* Tabs */}
                <div className="flex items-center bg-black/40 border border-white/[0.06] p-0.5 rounded-md">
                  <button
                    onClick={() => setActiveTab("players")}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono transition-all ${
                      activeTab === "players"
                        ? "bg-[#181c28] text-white font-semibold border border-white/[0.08]"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    ROSTER
                  </button>
                  <button
                    onClick={() => setActiveTab("utils")}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono transition-all ${
                      activeTab === "utils"
                        ? "bg-[#181c28] text-white font-semibold border border-white/[0.08]"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    UTILS
                  </button>
                  <button
                    onClick={() => setActiveTab("raw")}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono transition-all ${
                      activeTab === "raw"
                        ? "bg-[#181c28] text-white font-semibold border border-white/[0.08]"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    RAW JSON
                  </button>
                  <button
                    onClick={() => setActiveTab("api")}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono transition-all hidden md:inline-block ${
                      activeTab === "api"
                        ? "bg-[#181c28] text-white font-semibold border border-white/[0.08]"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    API
                  </button>
                  <button
                    onClick={() => setActiveTab("shortcuts")}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono transition-all hidden lg:inline-block ${
                      activeTab === "shortcuts"
                        ? "bg-[#181c28] text-white font-semibold border border-white/[0.08]"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    SHORTCUTS
                  </button>
                </div>

                {/* Size Controllers: Expand / Modal */}
                <div className="flex items-center gap-1 pl-1">
                  <button
                    onClick={() =>
                      setInspectorSize((s) =>
                        s === "compact" ? "expanded" : "compact"
                      )
                    }
                    className="p-1 rounded-md bg-black/40 hover:bg-slate-800 border border-white/[0.06] text-slate-300 hover:text-white transition-all text-xs font-mono"
                    title={
                      inspectorSize === "compact"
                        ? "Expand Height"
                        : "Collapse Height"
                    }
                  >
                    {inspectorSize === "compact" ? "↕ EXPAND" : "🗕 COMPACT"}
                  </button>
                  <button
                    onClick={() => setInspectorSize("modal")}
                    className="p-1 rounded-md bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-xs font-mono transition-all"
                    title="Pop-out Fullscreen Inspector Dialog"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Inspector Body Content */}
            <div className="flex-1 overflow-y-auto p-2.5 font-mono text-xs">
              {activeTab === "players" && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/[0.06] text-slate-400 text-[11px]">
                        <th className="pb-1.5 px-2.5">STEAMID</th>
                        <th className="pb-1.5 px-2.5">NAME</th>
                        <th className="pb-1.5 px-2.5">TEAM</th>
                        <th className="pb-1.5 px-2.5">WEAPON</th>
                        <th className="pb-1.5 px-2.5">HP</th>
                        <th className="pb-1.5 px-2.5">ARMOR</th>
                        <th className="pb-1.5 px-2.5">POSITION (X, Y, Z)</th>
                        <th className="pb-1.5 px-2.5">YAW</th>
                        <th className="pb-1.5 px-2.5">STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPlayers.length > 0 ? (
                        filteredPlayers.map((p) => {
                          const isFocused = selectedPlayerId === p.id;
                          return (
                            <tr
                              key={p.id}
                              onClick={() => setSelectedPlayerId(p.id)}
                              className={`border-b border-white/[0.02] cursor-pointer transition-colors ${
                                isFocused
                                  ? "bg-cyan-500/[0.12] border-cyan-500/30"
                                  : "hover:bg-white/[0.03]"
                              }`}
                            >
                              <td className="py-1.5 px-2.5 text-slate-500 text-[10px]">
                                {p.id}
                              </td>
                              <td className="py-1.5 px-2.5 font-semibold text-white flex items-center gap-1.5">
                                {p.hasBomb && (
                                  <span
                                    className="text-[9px] px-1 py-0.2 bg-rose-500/20 text-rose-300 rounded border border-rose-500/40 font-bold"
                                    title="Carrying C4"
                                  >
                                    C4
                                  </span>
                                )}
                                <span>{p.name}</span>
                                {isFocused && (
                                  <span className="text-[8px] px-1 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold">
                                    FOCUS
                                  </span>
                                )}
                              </td>
                              <td className="py-1.5 px-2.5">
                                <span
                                  className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                    p.team === "T"
                                      ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                                      : "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30"
                                  }`}
                                >
                                  {p.team}
                                </span>
                              </td>
                              <td className="py-1.5 px-2.5">
                                {p.currentWeapon ? (
                                  <span className="px-1.5 py-0.2 bg-slate-900 text-amber-300 border border-amber-500/20 rounded text-[10px]">
                                    {p.currentWeapon}
                                  </span>
                                ) : (
                                  <span className="text-slate-600 text-[10px]">--</span>
                                )}
                              </td>
                              <td className="py-1.5 px-2.5 font-semibold">
                                <span
                                  className={
                                    p.health > 50
                                      ? "text-emerald-400"
                                      : p.health > 20
                                      ? "text-amber-400"
                                      : "text-rose-400"
                                  }
                                >
                                  {p.health}
                                </span>
                              </td>
                              <td className="py-1.5 px-2.5 text-cyan-400 font-semibold">
                                {p.armor}
                              </td>
                              <td className="py-1.5 px-2.5 text-slate-300 text-[11px]">
                                ({p.x.toFixed(1)}, {p.y.toFixed(1)}, {p.z.toFixed(1)})
                              </td>
                              <td className="py-1.5 px-2.5 text-slate-300">
                                {p.yaw.toFixed(1)}°
                              </td>
                              <td className="py-1.5 px-2.5">
                                {p.isAlive ? (
                                  <span className="text-emerald-400 font-semibold text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/10 border border-emerald-500/20">
                                    ALIVE
                                  </span>
                                ) : (
                                  <span className="text-rose-400 font-semibold text-[9px] px-1.5 py-0.2 rounded bg-rose-500/10 border border-rose-500/20">
                                    DEAD
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td
                            colSpan={9}
                            className="py-6 text-center text-slate-500 font-mono"
                          >
                            No players registered in current telemetry frame.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === "utils" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 p-1">
                  {/* Active Smokes */}
                  <div className="bg-black/30 border border-white/[0.05] rounded-xl p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between border-b border-white/[0.04] pb-1">
                      <span className="text-slate-300 font-bold flex items-center gap-1.5">
                        <Wind className="w-3.5 h-3.5 text-slate-400" />
                        <span>ACTIVE SMOKES</span>
                      </span>
                      <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded">
                        {payload?.smokes?.length ?? 0}
                      </span>
                    </div>
                    <div className="space-y-1 max-h-24 overflow-y-auto">
                      {payload?.smokes && payload.smokes.length > 0 ? (
                        payload.smokes.map((s, idx) => (
                          <div
                            key={s.id || idx}
                            className="flex items-center justify-between text-[11px] bg-black/40 p-1.5 rounded-lg border border-white/[0.03]"
                          >
                            <span className="text-slate-300">Smoke #{idx + 1}</span>
                            <span className="text-slate-400">
                              ({s.x.toFixed(1)}, {s.y.toFixed(1)})
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="text-slate-500 text-center py-2 text-[11px]">
                          No active smokes
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Active Molotovs */}
                  <div className="bg-black/30 border border-white/[0.05] rounded-xl p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between border-b border-white/[0.04] pb-1">
                      <span className="text-amber-300 font-bold flex items-center gap-1.5">
                        <Flame className="w-3.5 h-3.5 text-amber-400" />
                        <span>ACTIVE MOLOTOVS</span>
                      </span>
                      <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded">
                        {payload?.molotovs?.length ?? 0}
                      </span>
                    </div>
                    <div className="space-y-1 max-h-24 overflow-y-auto">
                      {payload?.molotovs && payload.molotovs.length > 0 ? (
                        payload.molotovs.map((m, idx) => (
                          <div
                            key={m.id || idx}
                            className="flex items-center justify-between text-[11px] bg-black/40 p-1.5 rounded-lg border border-amber-500/20"
                          >
                            <span className="text-amber-400">Molotov #{idx + 1}</span>
                            <span className="text-slate-400">
                              ({m.x.toFixed(1)}, {m.y.toFixed(1)})
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="text-slate-500 text-center py-2 text-[11px]">
                          No active molotovs
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Dropped Weapons */}
                  <div className="bg-black/30 border border-white/[0.05] rounded-xl p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between border-b border-white/[0.04] pb-1">
                      <span className="text-cyan-300 font-bold flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-cyan-400" />
                        <span>DROPPED GUNS</span>
                      </span>
                      <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.2 rounded">
                        {payload?.guns?.length ?? 0}
                      </span>
                    </div>
                    <div className="space-y-1 max-h-24 overflow-y-auto">
                      {payload?.guns && payload.guns.length > 0 ? (
                        payload.guns.map((g, idx) => (
                          <div
                            key={g.id || idx}
                            className="flex items-center justify-between text-[11px] bg-black/40 p-1.5 rounded-lg border border-cyan-500/20"
                          >
                            <span className="text-cyan-300">{g.name}</span>
                            <span className="text-slate-400">
                              ({g.x.toFixed(1)}, {g.y.toFixed(1)})
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="text-slate-500 text-center py-2 text-[11px]">
                          No dropped weapons
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "raw" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between pb-1">
                    <span className="text-slate-400 text-[11px]">
                      Last Payload Synced: {lastPacketTime} ({packetCount} packets total)
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={downloadJson}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-white/[0.08] rounded-lg text-slate-300 text-xs font-medium transition-all flex items-center gap-1"
                      >
                        <Download className="w-3 h-3" />
                        <span>DOWNLOAD .JSON</span>
                      </button>
                      <button
                        onClick={() =>
                          copyToClipboard(
                            JSON.stringify(rawPayload ?? payload, null, 2),
                            "JSON Payload Copied!"
                          )
                        }
                        className="px-2.5 py-1 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg text-xs transition-all flex items-center gap-1 shadow-sm"
                      >
                        <Copy className="w-3 h-3" />
                        <span>COPY JSON</span>
                      </button>
                    </div>
                  </div>
                  <div className="bg-black/40 p-2.5 rounded-xl border border-white/[0.05] max-h-56 overflow-y-auto">
                    <HighlightedJson
                      data={rawPayload}
                      searchTerm={jsonSearchQuery}
                    />
                  </div>
                </div>
              )}

              {activeTab === "api" && (
                <div className="space-y-2.5 text-xs">
                  {/* WebSocket Spec */}
                  <div className="p-3 bg-black/30 rounded-xl border border-white/[0.05] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-cyan-300 font-semibold flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5" />
                        <span>WebSocket Stream Endpoint:</span>
                      </span>
                      <button
                        onClick={() =>
                          copyToClipboard(
                            `${
                              typeof window !== "undefined" &&
                              window.location.protocol === "https:"
                                ? "wss:"
                                : "ws:"
                            }//${
                              typeof window !== "undefined"
                                ? window.location.host
                                : "localhost:3000"
                            }/api/radar/ws`,
                            "WebSocket URL Copied!"
                          )
                        }
                        className="px-2.5 py-0.5 bg-slate-800 border border-white/[0.08] rounded-md text-[11px] text-slate-200 hover:bg-slate-700 transition-colors flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" />
                        <span>COPY WS URL</span>
                      </button>
                    </div>
                    <div className="bg-black/50 p-2 rounded-lg text-cyan-300 font-mono select-all border border-white/[0.04]">
                      {typeof window !== "undefined" &&
                      window.location.protocol === "https:"
                        ? "wss:"
                        : "ws:"}
                      //
                      {typeof window !== "undefined"
                        ? window.location.host
                        : "localhost:3000"}
                      /api/radar/ws
                    </div>
                  </div>

                  {/* HTTP POST Spec */}
                  <div className="p-3 bg-black/30 rounded-xl border border-white/[0.05] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-cyan-300 font-semibold flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5" />
                        <span>HTTP POST Protocol:</span>
                      </span>
                      <button
                        onClick={() =>
                          copyToClipboard(
                            `curl -X POST ${
                              typeof window !== "undefined"
                                ? window.location.origin
                                : "http://localhost:3000"
                            }/api/radar -H "Content-Type: application/json" -d '{"map":"${selectedMap}","players":[{"steamid":"76561198000000000","name":"Player1","team":"CT","health":100,"armor":100,"alive":true,"pos":{"x":-1420.5,"y":623.1,"z":-120.0},"yaw":88.5}],"bomb":{"pos":{"x":240.2,"y":-1100.8,"z":-64.0}},"optional":{"utils":{"smokes":[{"pos":{"x":-1200.5,"y":450.2,"z":-118.0}}],"molotovs":[{"pos":{"x":-1350.0,"y":510.0,"z":-120.0}}]},"gun":[{"id":"AK-47","pos":{"x":240.2,"y":-1100.8,"z":-64.0}}]}}'`,
                            "cURL Command Copied!"
                          )
                        }
                        className="px-2.5 py-0.5 bg-slate-800 border border-white/[0.08] rounded-md text-[11px] text-slate-200 hover:bg-slate-700 transition-colors flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" />
                        <span>COPY CURL</span>
                      </button>
                    </div>
                    <pre className="text-emerald-300 bg-black/50 p-2.5 rounded-lg border border-white/[0.04] overflow-x-auto whitespace-pre-wrap select-all font-mono text-[11px]">
                      {`curl -X POST ${
                        typeof window !== "undefined"
                          ? window.location.origin
                          : "http://localhost:3000"
                      }/api/radar \\
  -H "Content-Type: application/json" \\
  -d '{
  "map": "${selectedMap}",
  "players": [
    {
      "steamid": "76561198000000000",
      "name": "Player1",
      "team": "CT",
      "health": 100,
      "armor": 100,
      "alive": true,
      "pos": { "x": -1420.5, "y": 623.1, "z": -120.0 },
      "yaw": 88.5
    }
  ],
  "bomb": {
    "pos": { "x": 240.2, "y": -1100.8, "z": -64.0 }
  }
}'`}
                    </pre>
                  </div>
                </div>
              )}

              {activeTab === "shortcuts" && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-1">
                  {[
                    { label: "Follow / Track Player", key: "T / P" },
                    { label: "Zoom In / Out", key: "+ / -" },
                    { label: "Fullscreen Radar", key: "F" },
                    { label: "Demo Simulator", key: "D" },
                    { label: "Cycle Inspector", key: "I" },
                    { label: "Player Names", key: "N" },
                    { label: "Vision FOV Cones", key: "V" },
                    { label: "Toggle Smokes", key: "S" },
                    { label: "Toggle Molotovs", key: "K" },
                    { label: "Toggle Weapons", key: "U" },
                    { label: "Tactical Reticle", key: "G" },
                    { label: "Toggle Audio", key: "M" },
                  ].map((sc) => (
                    <div
                      key={sc.label}
                      className="bg-black/30 border border-white/[0.05] rounded-lg p-2 flex items-center justify-between"
                    >
                      <span className="text-slate-300 text-[11px]">{sc.label}</span>
                      <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-white/[0.08] text-cyan-400 font-bold text-[11px]">
                        {sc.key}
                      </kbd>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* ── Maximized Telemetry Inspector Modal Dialog ── */}
      {inspectorSize === "modal" && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 md:p-6 animate-fade-in">
          <div className="bg-[#0e111a] border border-white/[0.1] rounded-2xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-modal-in">
            {/* Modal Header */}
            <div className="h-12 border-b border-white/[0.08] px-4 flex items-center justify-between bg-black/40">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <Terminal className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                    MAXIMIZED TELEMETRY INSPECTOR
                  </h2>
                  <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1.5">
                    <span>{currentMap.displayName}</span>
                    <span>•</span>
                    <span>{payload?.players.length ?? 0} players</span>
                    <span>•</span>
                    <span>Sync: {lastPacketTime}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-black/50 border border-white/[0.08] p-0.5 rounded-lg">
                  <button
                    onClick={() => setActiveTab("raw")}
                    className={`px-3 py-1 rounded-md text-xs font-mono font-medium transition-all ${
                      activeTab === "raw"
                        ? "bg-[#181c28] text-white border border-white/[0.08]"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    RAW JSON
                  </button>
                  <button
                    onClick={() => setActiveTab("players")}
                    className={`px-3 py-1 rounded-md text-xs font-mono font-medium transition-all ${
                      activeTab === "players"
                        ? "bg-[#181c28] text-white border border-white/[0.08]"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    PLAYERS TABLE
                  </button>
                  <button
                    onClick={() => setActiveTab("utils")}
                    className={`px-3 py-1 rounded-md text-xs font-mono font-medium transition-all ${
                      activeTab === "utils"
                        ? "bg-[#181c28] text-white border border-white/[0.08]"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    UTILITIES
                  </button>
                  <button
                    onClick={() => setActiveTab("api")}
                    className={`px-3 py-1 rounded-md text-xs font-mono font-medium transition-all ${
                      activeTab === "api"
                        ? "bg-[#181c28] text-white border border-white/[0.08]"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    API
                  </button>
                </div>

                <button
                  onClick={downloadJson}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 border border-white/[0.08] rounded-lg text-slate-200 text-xs font-mono transition-all flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>DOWNLOAD</span>
                </button>
                <button
                  onClick={() =>
                    copyToClipboard(
                      JSON.stringify(payload, null, 2),
                      "JSON Payload Copied!"
                    )
                  }
                  className="px-3 py-1 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold font-mono rounded-lg text-xs transition-all flex items-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>COPY</span>
                </button>
                <button
                  onClick={() => setInspectorSize("expanded")}
                  className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-white/[0.08] text-slate-400 hover:text-white transition-all ml-1"
                  title="Minimize (ESC)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Sub-Header Filter Bar */}
            <div className="px-4 py-2 bg-black/30 border-b border-white/[0.06] flex items-center justify-between gap-4">
              <div className="flex-1 max-w-md relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2" />
                <input
                  type="text"
                  placeholder="Filter keys, values, player names, or coordinates..."
                  value={jsonSearchQuery}
                  onChange={(e) => setJsonSearchQuery(e.target.value)}
                  className="w-full bg-black/50 border border-white/[0.08] rounded-lg pl-8 pr-3 py-1 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                />
              </div>
              <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
                <span>
                  Payload:{" "}
                  <strong className="text-emerald-400">
                    {(JSON.stringify(payload ?? {}).length / 1024).toFixed(2)} KB
                  </strong>
                </span>
                <span>•</span>
                <span>
                  Transport:{" "}
                  <strong className="text-cyan-400 uppercase">
                    {streamMode}
                  </strong>
                </span>
              </div>
            </div>

            {/* Modal Body Container */}
            <div className="flex-1 overflow-y-auto p-4 font-mono text-xs bg-black/20">
              {activeTab === "raw" && (
                <div className="rounded-xl p-3 bg-black/40 border border-white/[0.06]">
                  <HighlightedJson
                    data={rawPayload}
                    searchTerm={jsonSearchQuery}
                  />
                </div>
              )}

              {activeTab === "players" && (
                <div className="overflow-x-auto rounded-xl bg-black/40 border border-white/[0.06] p-3">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/[0.08] text-slate-400 text-xs">
                        <th className="pb-2 px-3">STEAMID</th>
                        <th className="pb-2 px-3">NAME</th>
                        <th className="pb-2 px-3">TEAM</th>
                        <th className="pb-2 px-3">WEAPON</th>
                        <th className="pb-2 px-3">HP</th>
                        <th className="pb-2 px-3">ARMOR</th>
                        <th className="pb-2 px-3">POSITION (X, Y, Z)</th>
                        <th className="pb-2 px-3">YAW</th>
                        <th className="pb-2 px-3">STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPlayers.length > 0 ? (
                        filteredPlayers.map((p) => {
                          const isFocused = selectedPlayerId === p.id;
                          return (
                            <tr
                              key={p.id}
                              onClick={() => setSelectedPlayerId(p.id)}
                              className={`border-b border-white/[0.03] cursor-pointer transition-colors ${
                                isFocused
                                  ? "bg-cyan-500/[0.14] border-cyan-500/40"
                                  : "hover:bg-white/[0.03]"
                              }`}
                            >
                              <td className="py-2 px-3 text-slate-500 text-xs">
                                {p.id}
                              </td>
                              <td className="py-2 px-3 font-semibold text-white flex items-center gap-2">
                                {p.hasBomb && (
                                  <span className="text-xs px-1.5 py-0.2 bg-rose-500/20 text-red-300 rounded border border-rose-500/40 font-bold">
                                    C4
                                  </span>
                                )}
                                <span>{p.name}</span>
                              </td>
                              <td className="py-2 px-3">
                                <span
                                  className={`px-2 py-0.5 rounded text-xs font-bold ${
                                    p.team === "T"
                                      ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                                      : "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30"
                                  }`}
                                >
                                  {p.team}
                                </span>
                              </td>
                              <td className="py-2 px-3">
                                {p.currentWeapon ? (
                                  <span className="px-2 py-0.5 bg-slate-900 text-amber-300 border border-amber-500/20 rounded text-xs font-mono">
                                    {p.currentWeapon}
                                  </span>
                                ) : (
                                  <span className="text-slate-600 text-xs">--</span>
                                )}
                              </td>
                              <td className="py-2 px-3 font-semibold">
                                <span
                                  className={
                                    p.health > 50
                                      ? "text-emerald-400"
                                      : p.health > 20
                                      ? "text-amber-400"
                                      : "text-rose-400"
                                  }
                                >
                                  {p.health}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-cyan-400 font-semibold">
                                {p.armor}
                              </td>
                              <td className="py-2 px-3 text-slate-300 text-xs">
                                ({p.x.toFixed(1)}, {p.y.toFixed(1)}, {p.z.toFixed(1)})
                              </td>
                              <td className="py-2 px-3 text-slate-300">
                                {p.yaw.toFixed(1)}°
                              </td>
                              <td className="py-2 px-3">
                                {p.isAlive ? (
                                  <span className="text-emerald-400 font-semibold text-xs px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                                    ALIVE
                                  </span>
                                ) : (
                                  <span className="text-rose-400 font-semibold text-xs px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20">
                                    DEAD
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td
                            colSpan={9}
                            className="py-8 text-center text-slate-500 font-mono"
                          >
                            No players found in this frame.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === "utils" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-black/40 border border-white/[0.06] rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between border-b border-white/[0.06] pb-2 font-bold text-slate-200">
                      <span>ACTIVE SMOKES</span>
                      <span className="text-xs bg-slate-800 px-2 py-0.5 rounded">
                        {payload?.smokes?.length ?? 0}
                      </span>
                    </div>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {payload?.smokes?.map((s, idx) => (
                        <div key={s.id || idx} className="flex justify-between p-1.5 bg-black/30 rounded">
                          <span>Smoke #{idx + 1}</span>
                          <span className="text-slate-400">({s.x.toFixed(1)}, {s.y.toFixed(1)})</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-black/40 border border-white/[0.06] rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between border-b border-white/[0.06] pb-2 font-bold text-amber-300">
                      <span>ACTIVE MOLOTOVS</span>
                      <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded">
                        {payload?.molotovs?.length ?? 0}
                      </span>
                    </div>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {payload?.molotovs?.map((m, idx) => (
                        <div key={m.id || idx} className="flex justify-between p-1.5 bg-black/30 rounded">
                          <span className="text-amber-400">Molotov #{idx + 1}</span>
                          <span className="text-slate-400">({m.x.toFixed(1)}, {m.y.toFixed(1)})</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-black/40 border border-white/[0.06] rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between border-b border-white/[0.06] pb-2 font-bold text-cyan-300">
                      <span>DROPPED GUNS</span>
                      <span className="text-xs bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded">
                        {payload?.guns?.length ?? 0}
                      </span>
                    </div>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {payload?.guns?.map((g, idx) => (
                        <div key={g.id || idx} className="flex justify-between p-1.5 bg-black/30 rounded">
                          <span className="text-cyan-300">{g.name}</span>
                          <span className="text-slate-400">({g.x.toFixed(1)}, {g.y.toFixed(1)})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "api" && (
                <div className="space-y-3">
                  <div className="p-3.5 bg-black/40 rounded-xl border border-white/[0.06] space-y-2">
                    <div className="text-cyan-300 font-bold">WebSocket Streaming Endpoint:</div>
                    <div className="p-2.5 bg-black/60 rounded-lg text-cyan-300 font-mono select-all">
                      {typeof window !== "undefined" && window.location.protocol === "https:" ? "wss:" : "ws:"}//{typeof window !== "undefined" ? window.location.host : "localhost:3000"}/api/radar/ws
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
