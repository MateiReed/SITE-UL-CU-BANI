"use client";

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import dynamic from "next/dynamic";
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
  if (!name) return { bg: "bg-slate-800", text: "text-slate-400", border: "border-slate-700" };
  const upper = name.toUpperCase();
  if (upper.includes("AWP") || upper.includes("SSG") || upper.includes("SCAR") || upper.includes("G3SG1")) {
    return { bg: "bg-purple-950/70", text: "text-purple-300", border: "border-purple-500/40" };
  }
  if (upper.includes("AK") || upper.includes("M4") || upper.includes("GALIL") || upper.includes("FAMAS") || upper.includes("AUG") || upper.includes("SG")) {
    return { bg: "bg-amber-950/70", text: "text-amber-300", border: "border-amber-500/40" };
  }
  if (upper.includes("DEAGLE") || upper.includes("DESERT") || upper.includes("USP") || upper.includes("GLOCK") || upper.includes("P250") || upper.includes("FIVE") || upper.includes("CZ") || upper.includes("REVOLVER")) {
    return { bg: "bg-sky-950/70", text: "text-sky-300", border: "border-sky-500/40" };
  }
  if (upper.includes("MP9") || upper.includes("MAC") || upper.includes("MP7") || upper.includes("MP5") || upper.includes("UMP") || upper.includes("P90") || upper.includes("BIZON")) {
    return { bg: "bg-emerald-950/70", text: "text-emerald-300", border: "border-emerald-500/40" };
  }
  return { bg: "bg-slate-800", text: "text-slate-300", border: "border-slate-700" };
}

function PlayerCard({
  player,
  isFocused,
  onSelect,
}: {
  player: PlayerData;
  isFocused: boolean;
  onSelect: () => void;
}) {
  const isT = player.team === "T";
  const alive = player.isAlive;
  const wStyle = getWeaponBadgeStyle(player.currentWeapon);

  const hpPercent = Math.max(0, Math.min(100, player.health));
  const hpColor =
    player.health > 50
      ? "from-emerald-500 to-green-400"
      : player.health > 20
      ? "from-amber-500 to-yellow-400"
      : "from-rose-500 to-red-600";

  return (
    <div
      onClick={onSelect}
      className={`group rounded-2xl p-2.5 transition-all duration-200 cursor-pointer border-y border-r relative overflow-hidden ${
        isT
          ? "border-l-[5px] border-l-amber-500 shadow-amber-500/5"
          : "border-l-[5px] border-l-cyan-400 shadow-cyan-500/5"
      } ${
        !alive
          ? "bg-slate-950/40 border-white/[0.04] opacity-35 grayscale hover:opacity-60"
          : isFocused
          ? isT
            ? "bg-gradient-to-r from-amber-950/70 via-slate-900/90 to-slate-950 border-amber-400 shadow-lg shadow-amber-500/25 scale-[1.01]"
            : "bg-gradient-to-r from-cyan-950/70 via-slate-900/90 to-slate-950 border-cyan-400 shadow-lg shadow-cyan-500/25 scale-[1.01]"
          : isT
          ? "bg-gradient-to-r from-amber-950/35 via-slate-900/80 to-slate-950/90 border-amber-500/25 hover:border-amber-400/60 hover:from-amber-950/50"
          : "bg-gradient-to-r from-cyan-950/35 via-slate-900/80 to-slate-950/90 border-cyan-500/25 hover:border-cyan-400/60 hover:from-cyan-950/50"
      }`}
    >
      {/* Top row: Team badge + Name + C4 icon + Status */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 truncate">
          {/* Prominent Team Badge */}
          {isT ? (
            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-mono font-black bg-amber-500/30 text-amber-300 border border-amber-400/60 shrink-0 tracking-wider shadow-sm shadow-amber-500/30">
              💣 T
            </span>
          ) : (
            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-mono font-black bg-cyan-500/30 text-cyan-200 border border-cyan-400/60 shrink-0 tracking-wider shadow-sm shadow-cyan-500/30">
              🛡️ CT
            </span>
          )}

          {player.hasBomb && (
            <span
              className="text-xs px-1.5 py-0.2 bg-red-500/30 text-red-200 rounded border border-red-500/60 font-black animate-pulse shrink-0"
              title="Carrying C4"
            >
              💣 C4
            </span>
          )}

          <span
            className={`font-mono font-bold text-xs truncate ${
              !alive
                ? "text-slate-400 line-through"
                : isT
                ? "text-amber-100 group-hover:text-amber-300"
                : "text-cyan-100 group-hover:text-cyan-300"
            }`}
          >
            {player.name}
          </span>

          {isFocused && (
            <span className="text-[9px] font-mono font-black px-1.5 rounded-full bg-cyan-500/30 text-cyan-200 border border-cyan-400 shrink-0">
              FOCUS
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {alive ? (
            <span className="text-[9px] font-mono font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
              ALIVE
            </span>
          ) : (
            <span className="text-[9px] font-mono font-black px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/40">
              DEAD
            </span>
          )}
        </div>
      </div>

      {/* Middle row: Weapon badge + Armor + Health value */}
      <div className="flex items-center justify-between gap-2 mt-2">
        <div className="flex items-center gap-1.5 truncate">
          {player.currentWeapon ? (
            <span
              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg border ${wStyle.bg} ${wStyle.text} ${wStyle.border} truncate shadow-sm`}
            >
              🔫 {player.currentWeapon}
            </span>
          ) : (
            <span className="text-[10px] font-mono text-slate-500 italic">
              No weapon
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 font-mono text-[10px] shrink-0">
          <span className="text-cyan-300 font-bold flex items-center gap-0.5 bg-cyan-950/50 px-1.5 py-0.5 rounded border border-cyan-800/40">
            🛡️ {player.armor}
          </span>
          <span
            className={`font-bold px-1.5 py-0.5 rounded border ${
              player.health > 50
                ? "text-emerald-300 bg-emerald-950/50 border-emerald-800/40"
                : player.health > 20
                ? "text-amber-300 bg-amber-950/50 border-amber-800/40"
                : "text-rose-300 bg-rose-950/50 border-rose-800/40"
            }`}
          >
            ❤️ {player.health}
          </span>
        </div>
      </div>

      {/* Bottom Health Bar */}
      <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden mt-2 border border-white/[0.04]">
        <div
          className={`h-full bg-gradient-to-r ${hpColor} transition-all duration-300 rounded-full`}
          style={{ width: `${alive ? hpPercent : 0}%` }}
        />
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
    { id: "76561198000000001", name: "ZywOo", baseX: 0.35, baseY: 0.42 },
    { id: "76561198000000002", name: "s1mple", baseX: 0.43, baseY: 0.52 },
    { id: "76561198000000003", name: "NiKo", baseX: 0.29, baseY: 0.65 },
    { id: "76561198000000004", name: "m0NESY", baseX: 0.48, baseY: 0.36 },
    { id: "76561198000000005", name: "b1t", baseX: 0.32, baseY: 0.24 },
  ];

  const ctPlayers = [
    { id: "76561198000000006", name: "ropz", baseX: 0.64, baseY: 0.44 },
    { id: "76561198000000007", name: "donk", baseX: 0.72, baseY: 0.58 },
    { id: "76561198000000008", name: "frozen", baseX: 0.79, baseY: 0.48 },
    { id: "76561198000000009", name: "broky", baseX: 0.67, baseY: 0.28 },
    { id: "76561198000000010", name: "Aleksib", baseX: 0.58, baseY: 0.68 },
  ];

  const t = tick * 0.02;

  // ZywOo is carrying the bomb
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
        hasBomb: i === 0, // ZywOo has C4
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

const HTTP_POLL_INTERVAL = 30; // 33Hz real-time ultra-fast polling

// ─── Modern Toggle Switch Component ────────────────────────────────────────
function ToggleSwitch({
  checked,
  onChange,
  label,
  shortcut,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  label: string;
  shortcut?: string;
}) {
  return (
    <div
      onClick={() => onChange(!checked)}
      className={`group flex items-center justify-between py-2 px-3 rounded-2xl cursor-pointer transition-all duration-200 border ${
        checked
          ? "bg-slate-800/90 border-cyan-500/40 shadow-sm shadow-cyan-500/15"
          : "bg-slate-950/40 border-white/[0.05] hover:bg-slate-800/40"
      }`}
    >
      <div className="flex items-center gap-2 truncate">
        <span
          className={`text-xs font-mono transition-colors truncate ${
            checked ? "text-slate-100 font-bold" : "text-slate-400 group-hover:text-slate-300"
          }`}
        >
          {label}
        </span>
        {shortcut && (
          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-white/[0.06] shrink-0">
            {shortcut}
          </span>
        )}
      </div>

      {/* Pill Slider */}
      <div className="flex items-center gap-2 shrink-0 ml-1">
        <span
          className={`text-[9px] font-mono font-black uppercase tracking-wider transition-colors ${
            checked ? "text-cyan-400" : "text-slate-500"
          }`}
        >
          {checked ? "ON" : "OFF"}
        </span>
        <div
          className={`w-9 h-5 rounded-full transition-all duration-200 p-0.5 relative flex items-center ${
            checked
              ? "bg-gradient-to-r from-cyan-500 to-blue-600 shadow-sm shadow-cyan-500/30"
              : "bg-slate-800 border border-white/[0.08]"
          }`}
        >
          <div
            className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform duration-200 ease-out flex items-center justify-center ${
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
          '<mark class="bg-cyan-400 text-black px-1 rounded font-black">$1</mark>'
        );
      }

      return (
        <div key={idx} className="table-row leading-5 hover:bg-white/[0.04]">
          <span className="table-cell pr-4 text-right select-none text-slate-500 text-[11px] font-mono w-10">
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
  const [lastPacketDate, setLastPacketDate] = useState<number>(0);
  const [timeAgo, setTimeAgo] = useState<string>("Waiting for data...");
  const [playerSearch, setPlayerSearch] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [copiedToast, setCopiedToast] = useState<string | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [autoFollowMap, setAutoFollowMap] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"players" | "settings">("players");
  const [sidebarTeamTab, setSidebarTeamTab] = useState<"T" | "CT">("T");
  const [fullscreenPlayersVisible, setFullscreenPlayersVisible] = useState(true);
  const [fullscreenTeamTab, setFullscreenTeamTab] = useState<"T" | "CT">("T");
  const [rosterPos, setRosterPos] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingRoster, setIsDraggingRoster] = useState(false);
  const dragStartRef = useRef<{
    startMouseX: number;
    startMouseY: number;
    startPosX: number;
    startPosY: number;
  } | null>(null);

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
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mockIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPacketDateRef = useRef<number>(0);

  useEffect(() => {
    setMounted(true);
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
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener(
        "fullscreenchange",
        handleFullscreenChange
      );
    };
  }, []);

  // Cinematic Fullscreen Toggle
  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        if (radarContainerRef.current) {
          await radarContainerRef.current.requestFullscreen();
          setIsFullscreen(true);
        }
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      setIsFullscreen((v) => !v);
    }
  }, []);

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
        toggleFullscreen();
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
      } else if (key === "i") {
        e.preventDefault();
        setInspectorSize((s) =>
          s === "compact" ? "expanded" : s === "expanded" ? "modal" : "compact"
        );
      } else if (key === "escape") {
        if (inspectorSize === "modal") {
          setInspectorSize("expanded");
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleFullscreen, inspectorSize]);

  const selectedMapRef = useRef(selectedMap);
  selectedMapRef.current = selectedMap;
  const autoFollowMapRef = useRef(autoFollowMap);
  autoFollowMapRef.current = autoFollowMap;

  // Process incoming telemetry packet
  const handleIncomingPayload = useCallback(
    (incomingData: unknown) => {
      if (!incomingData || typeof incomingData !== "object") return;
      const incomingObj = incomingData as Record<string, unknown>;

      // Extract raw body if attached as _raw, otherwise incomingData itself is the raw data
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
      setLastPacketDate(now);
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
      } catch {
        /* ignore */
      }
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
      } catch {
        /* ignore parse errors */
      }
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
      } catch {
        /* ignore poll network hiccups */
      }
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
      } catch {
        /* ignore */
      }
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
        } catch {
          /* ignore */
        }
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
          setLastPacketDate(Date.now());
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
    } catch {
      /* ignore */
    }
  };

  const copyToClipboard = (text: string, label = "Copied to clipboard!") => {
    navigator.clipboard.writeText(text);
    setCopiedToast(label);
    setTimeout(() => setCopiedToast(null), 2200);
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

  const bombCarrier = useMemo(() => {
    if (!payload?.bomb?.carrierId) return null;
    return (
      payload.players.find((p) => p.id === payload.bomb?.carrierId) ?? null
    );
  }, [payload]);

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
      dot: "bg-emerald-400 animate-pulse shadow-md shadow-emerald-500/50",
      bg: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
    },
    awaiting: {
      label: isWs ? "WS AWAITING DATA" : "HTTP AWAITING DATA",
      color: "text-amber-400",
      dot: "bg-amber-400 animate-pulse shadow-md shadow-amber-500/50",
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
    return <div className="h-screen w-screen bg-[#080d1a]" />;
  }

  // Calculate inspector height class
  const getInspectorHeightClass = () => {
    if (inspectorSize === "compact") return "h-44";
    if (inspectorSize === "expanded") return "h-80 md:h-96";
    return "h-44";
  };

  return (
    <div
      className="h-screen w-screen bg-[#080d1a] text-slate-100 flex flex-col font-sans overflow-hidden select-none relative"
      suppressHydrationWarning
    >
      {/* ── Ambient Background Lighting Mesh (Glassmorphism Glows) ── */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[350px] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none -z-10 animate-ambient-drift" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[300px] bg-cyan-500/8 rounded-full blur-[120px] pointer-events-none -z-10 animate-ambient-drift" />
      <div className="absolute top-1/2 left-10 w-[400px] h-[400px] bg-indigo-900/15 rounded-full blur-[160px] pointer-events-none -z-10" />

      {/* ── Dynamic Toast Notification ── */}
      {copiedToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 animate-toast">
          <div className="bg-gradient-to-r from-cyan-500 via-blue-600 to-cyan-400 text-white font-mono font-black text-xs px-5 py-2.5 rounded-full shadow-2xl shadow-cyan-500/40 flex items-center gap-2 border border-cyan-300/40 backdrop-blur-xl">
            <span>✨</span>
            <span>{copiedToast}</span>
          </div>
        </div>
      )}

      {/* ── Top Pro Esports Command Bar (Glassmorphic) ── */}
      <header
        className={`h-14 border-b border-slate-700/40 bg-slate-900/60 backdrop-blur-3xl px-4 flex items-center justify-between gap-4 shrink-0 z-30 shadow-2xl transition-all duration-500 ${
          isFullscreen ? "-translate-y-16 opacity-0 pointer-events-none" : "translate-y-0 opacity-100"
        }`}
      >
        {/* Left Branding */}
        <div className="flex items-center gap-3">
          <div className="relative group cursor-pointer">
            <div className="h-9 w-9 rounded-2xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-cyan-400 flex items-center justify-center font-mono font-black text-xs text-white shadow-lg shadow-cyan-500/30 border border-cyan-300/40 transition-transform duration-300 group-hover:scale-105 group-active:scale-95">
              CS2
            </div>
            <div className="absolute -inset-1 rounded-2xl bg-cyan-500/20 blur-sm -z-10 group-hover:bg-cyan-500/40 transition-colors" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black tracking-widest uppercase font-mono text-white">
                TACTICAL RADAR
              </span>
              <span className="text-[10px] text-cyan-400 font-mono font-black px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 shadow-sm">
                PRO STUDIO
              </span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
              <span className="text-slate-500">MAP:</span>
              <span className="text-cyan-400 font-bold tracking-wider">
                {currentMap.displayName}
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-400 font-mono">{currentMap.id}</span>
            </div>
          </div>
        </div>

        {/* Protocol Selector Pill (WebSocket vs HTTP POST) */}
        <div className="flex items-center bg-slate-950/70 border border-white/[0.08] p-1 rounded-2xl shadow-inner gap-1 backdrop-blur-2xl">
          <button
            onClick={() => setStreamMode("websocket")}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-black transition-all duration-300 flex items-center gap-1.5 ${
              streamMode === "websocket"
                ? "bg-gradient-to-r from-amber-500 to-orange-500 text-black shadow-md shadow-orange-500/30 scale-[1.02]"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.05]"
            }`}
            title="WebSocket streaming socket"
          >
            <span>⚡ WEBSOCKET</span>
          </button>
          <button
            onClick={() => setStreamMode("http")}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-black transition-all duration-300 flex items-center gap-1.5 ${
              streamMode === "http"
                ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/30 scale-[1.02]"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.05]"
            }`}
            title="HTTP POST telemetry polling"
          >
            <span>🌐 HTTP POST</span>
          </button>
        </div>

        {/* Center Team Health & Alive Ratio Bar */}
        <div className="hidden xl:flex items-center gap-6 bg-slate-900/60 border border-slate-700/40 px-4 py-1.5 rounded-2xl shadow-inner backdrop-blur-2xl">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-sm shadow-amber-400 animate-pulse" />
            <div className="text-left">
              <div className="text-[10px] font-mono font-black text-amber-400 flex items-center justify-between gap-3">
                <span>TERRORISTS</span>
                <span className="text-white">
                  {tAlive}/{tPlayers.length || 0}
                </span>
              </div>
              <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1 border border-white/[0.04]">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-500 rounded-full"
                  style={{
                    width: `${
                      tPlayers.length > 0
                        ? (tTotalHp / (tPlayers.length * 100)) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>

          <div className="text-xs font-mono font-black text-slate-500 px-1">VS</div>

          <div className="flex items-center gap-2.5">
            <div className="text-right">
              <div className="text-[10px] font-mono font-black text-cyan-400 flex items-center justify-between gap-3">
                <span className="text-white">
                  {ctAlive}/{ctPlayers.length || 0}
                </span>
                <span>COUNTER-T</span>
              </div>
              <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1 border border-white/[0.04]">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500 ml-auto rounded-full"
                  style={{
                    width: `${
                      ctPlayers.length > 0
                        ? (ctTotalHp / (ctPlayers.length * 100)) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400 animate-pulse" />
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2">
          {/* Status Badge */}
          <div
            className={`flex items-center gap-2 border rounded-2xl px-3 py-1 text-xs font-mono font-bold transition-all shadow-sm ${badgeConfig.bg}`}
          >
            <div className={`w-2 h-2 rounded-full ${badgeConfig.dot}`} />
            <span>{badgeConfig.label}</span>
          </div>

          {/* Performance Pill: FPS & Latency */}
          <div className="hidden sm:flex items-center gap-2 bg-slate-900/60 border border-slate-700/40 rounded-2xl px-3 py-1 text-xs font-mono backdrop-blur-2xl">
            <div className="flex items-center gap-1">
              <span className="text-slate-500 text-[10px]">FPS</span>
              <span
                className={
                  fps >= 50
                    ? "text-emerald-400 font-bold"
                    : "text-amber-400 font-bold"
                }
              >
                {fps}
              </span>
            </div>
            <span className="text-slate-700">|</span>
            <div className="flex items-center gap-1">
              <span className="text-slate-500 text-[10px]">PING</span>
              <span
                className={
                  latency !== null && latency < 50
                    ? "text-emerald-400 font-bold"
                    : "text-amber-400 font-bold"
                }
              >
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
            className={`p-2 rounded-2xl border text-xs font-mono transition-all duration-300 hover:scale-105 active:scale-95 ${
              audioEnabled
                ? "bg-cyan-500/20 border-cyan-500/60 text-cyan-300 shadow-md shadow-cyan-500/20"
                : "bg-slate-900/60 border-slate-700/40 text-slate-400 hover:text-slate-200 hover:border-slate-600"
            }`}
            title="Toggle Radar Audio Sound (Key: M)"
          >
            {audioEnabled ? "🔊" : "🔇"}
          </button>

          {/* Single Unified Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-1.5 bg-gradient-to-r from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 border border-slate-700/60 hover:border-cyan-500/40 text-slate-200 hover:text-white text-xs font-mono font-bold px-3.5 py-1.5 rounded-2xl transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg shadow-black/40"
            title="Toggle Cinematic Fullscreen (Key: F)"
          >
            <svg className="w-3.5 h-3.5 fill-current text-cyan-400" viewBox="0 0 24 24">
              <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
            </svg>
            <span className="hidden md:inline">FULLSCREEN</span>
          </button>

          {/* Demo Simulator Toggle */}
          <button
            onClick={() => setUseMock((v) => !v)}
            className={`text-xs font-mono font-black px-3.5 py-1.5 rounded-2xl border transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg flex items-center gap-1.5 ${
              useMock
                ? "bg-gradient-to-r from-amber-500/30 to-orange-500/30 border-amber-500 text-amber-300 shadow-amber-500/20"
                : "bg-slate-900/60 border-slate-700/40 text-slate-400 hover:text-slate-200 hover:border-slate-600"
            }`}
            title="Toggle Live Demo Simulator (Key: D)"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                useMock ? "bg-amber-400 animate-pulse" : "bg-slate-500"
              }`}
            />
            <span>{useMock ? "SIMULATOR ON" : "DEMO SIM"}</span>
          </button>
        </div>
      </header>

      {/* ── Main Workspace ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        {/* ── Left Tactical Sidebar (Comfortable Proportions Without Gaps) ── */}
        <aside
          className={`shrink-0 bg-slate-900/60 backdrop-blur-3xl border-r border-slate-700/40 flex flex-col transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isFullscreen
              ? "-translate-x-full opacity-0 pointer-events-none w-0"
              : sidebarCollapsed
              ? "w-14"
              : "w-80"
          } overflow-hidden z-20 shadow-2xl`}
        >
          {/* Sidebar Header & Collapse Switch */}
          <div className="py-2.5 px-3.5 border-b border-slate-700/40 flex items-center justify-between">
            {!sidebarCollapsed && (
              <div className="text-[11px] font-mono font-black text-slate-200 uppercase tracking-widest flex items-center gap-2">
                <span>🎯 TACTICAL OPS</span>
              </div>
            )}
            <button
              onClick={() => setSidebarCollapsed((v) => !v)}
              className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-400 hover:text-white border border-slate-700/40 transition-all ml-auto text-xs"
              title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {sidebarCollapsed ? "▶" : "◀"}
            </button>
          </div>

          {!sidebarCollapsed && (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {/* Main Sidebar Tabs: PLAYERS vs SETTINGS */}
              <div className="p-3 pb-2 shrink-0">
                <div className="grid grid-cols-2 p-1 bg-slate-950/80 rounded-2xl border border-white/[0.08] shadow-inner gap-1">
                  <button
                    onClick={() => setSidebarTab("players")}
                    className={`py-1.5 px-3 rounded-xl text-xs font-mono font-black transition-all duration-200 flex items-center justify-center gap-1.5 ${
                      sidebarTab === "players"
                        ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/25 scale-[1.02]"
                        : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.05]"
                    }`}
                  >
                    <span>👥 PLAYERS</span>
                    <span className="text-[10px] bg-black/30 px-1.5 py-0.2 rounded-full">
                      {(tPlayers.length + ctPlayers.length) || 0}
                    </span>
                  </button>

                  <button
                    onClick={() => setSidebarTab("settings")}
                    className={`py-1.5 px-3 rounded-xl text-xs font-mono font-black transition-all duration-200 flex items-center justify-center gap-1.5 ${
                      sidebarTab === "settings"
                        ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/25 scale-[1.02]"
                        : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.05]"
                    }`}
                  >
                    <span>⚙️ SETTINGS</span>
                  </button>
                </div>
              </div>

              {/* Tab Content */}
              {sidebarTab === "players" ? (
                <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-3">
                  {/* Terrorists Section */}
                  <div className="space-y-2">
                    <div className="bg-gradient-to-r from-amber-500/25 via-amber-950/40 to-slate-950 border border-amber-500/50 rounded-2xl p-2.5 flex items-center justify-between text-xs font-mono shadow-md shadow-amber-500/10">
                      <div className="flex items-center gap-2 font-black text-amber-400 tracking-wider">
                        <span className="text-sm">💣</span>
                        <span>TERRORISTS</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px]">
                        <span className="text-slate-950 font-black bg-amber-400 px-2.5 py-0.5 rounded-full shadow-sm">
                          {tAlive}/{tPlayers.length} ALIVE
                        </span>
                        <span className="text-amber-300 font-bold bg-amber-950/60 px-2 py-0.5 rounded-lg border border-amber-500/40">
                          {tTotalHp} HP
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      {tPlayers.length > 0 ? (
                        tPlayers.map((p) => (
                          <PlayerCard
                            key={p.id}
                            player={p}
                            isFocused={selectedPlayerId === p.id}
                            onSelect={() => setSelectedPlayerId(selectedPlayerId === p.id ? null : p.id)}
                          />
                        ))
                      ) : (
                        <div className="p-3 text-center text-slate-500 font-mono text-xs">
                          No Terrorists registered.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Tactical Divider Between Teams */}
                  <div className="relative py-2.5 my-1 flex items-center justify-center">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-700/60" />
                    </div>
                    <div className="relative bg-slate-950 px-3 py-0.5 rounded-full border border-slate-700/60 flex items-center gap-2 shadow-lg shadow-black/60">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                      <span className="text-[10px] font-mono font-black text-slate-400 tracking-widest uppercase">
                        VS
                      </span>
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    </div>
                  </div>

                  {/* Counter-Terrorists Section */}
                  <div className="space-y-2 pt-0.5">
                    <div className="bg-gradient-to-r from-cyan-500/25 via-cyan-950/40 to-slate-950 border border-cyan-500/50 rounded-2xl p-2.5 flex items-center justify-between text-xs font-mono shadow-md shadow-cyan-500/10">
                      <div className="flex items-center gap-2 font-black text-cyan-400 tracking-wider">
                        <span className="text-sm">🛡️</span>
                        <span>COUNTER-TERRORISTS</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px]">
                        <span className="text-slate-950 font-black bg-cyan-400 px-2.5 py-0.5 rounded-full shadow-sm">
                          {ctAlive}/{ctPlayers.length} ALIVE
                        </span>
                        <span className="text-cyan-300 font-bold bg-cyan-950/60 px-2 py-0.5 rounded-lg border border-cyan-500/40">
                          {ctTotalHp} HP
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      {ctPlayers.length > 0 ? (
                        ctPlayers.map((p) => (
                          <PlayerCard
                            key={p.id}
                            player={p}
                            isFocused={selectedPlayerId === p.id}
                            onSelect={() => setSelectedPlayerId(selectedPlayerId === p.id ? null : p.id)}
                          />
                        ))
                      ) : (
                        <div className="p-3 text-center text-slate-500 font-mono text-xs">
                          No Counter-Terrorists registered.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* SETTINGS TAB */
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {/* Competitive Pool (Comfortable 2-Column Grid) */}
                  <div className="bg-slate-900/50 border border-slate-700/40 rounded-3xl p-3 shadow-md backdrop-blur-2xl space-y-2">
                    <div className="text-xs font-mono font-black text-slate-300 uppercase tracking-wider flex items-center justify-between">
                      <span>COMPETITIVE POOL</span>
                      <span className="text-[10px] text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/30 font-black">
                        {MAPS.length} MAPS
                      </span>
                    </div>
                    {/* 2-Column Map Matrix */}
                    <div className="grid grid-cols-2 gap-1.5">
                      {MAPS.map((m) => {
                        const isSelected = selectedMap === m.id;
                        return (
                          <button
                            key={m.id}
                            onClick={() => handleMapChange(m.id)}
                            className={`text-left px-2.5 py-1.5 rounded-2xl text-xs font-mono transition-all duration-150 flex items-center justify-between border truncate ${
                              isSelected
                                ? "bg-gradient-to-r from-cyan-500/25 to-blue-600/20 border-cyan-500/60 text-cyan-300 font-bold shadow-sm shadow-cyan-500/20 scale-[1.01]"
                                : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 hover:border-slate-700/40"
                            }`}
                            title={m.displayName}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: m.accent }}
                              />
                              <span className="truncate font-medium">{m.displayName}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* HUD Preferences with Modern Toggle Switches */}
                  <div className="bg-slate-900/50 border border-slate-700/40 rounded-3xl p-3 shadow-md backdrop-blur-2xl space-y-1.5">
                    <div className="text-xs font-mono font-black text-slate-300 uppercase tracking-wider">
                      HUD PREFERENCES
                    </div>
                    <div className="space-y-1.5">
                      <ToggleSwitch
                        label="Player Names"
                        shortcut="N"
                        checked={showNames}
                        onChange={setShowNames}
                      />
                      <ToggleSwitch
                        label="FOV Cones"
                        shortcut="V"
                        checked={showVisionCones}
                        onChange={setShowVisionCones}
                      />
                      <ToggleSwitch
                        label="Active Smokes"
                        shortcut="S"
                        checked={showSmokes}
                        onChange={setShowSmokes}
                      />
                      <ToggleSwitch
                        label="Active Molotovs"
                        shortcut="K"
                        checked={showMolotovs}
                        onChange={setShowMolotovs}
                      />
                      <ToggleSwitch
                        label="Dropped Weapons"
                        shortcut="U"
                        checked={showGuns}
                        onChange={setShowGuns}
                      />
                      <ToggleSwitch
                        label="Tactical Reticle"
                        shortcut="G"
                        checked={showGrid}
                        onChange={setShowGrid}
                      />
                      <ToggleSwitch
                        label="Auto-Follow Map"
                        shortcut="Auto"
                        checked={autoFollowMap}
                        onChange={setAutoFollowMap}
                      />

                      {/* Radar Zoom Slider */}
                      <div className="p-2 rounded-2xl bg-slate-950/60 border border-slate-700/40 flex items-center justify-between gap-2.5 shadow-inner mt-1">
                        <span className="text-xs font-mono text-slate-300 shrink-0">
                          Zoom: <strong className="text-cyan-400">{radarZoom.toFixed(1)}x</strong>
                        </span>
                        <input
                          type="range"
                          min="0.8"
                          max="1.5"
                          step="0.1"
                          value={radarZoom}
                          onChange={(e) => setRadarZoom(parseFloat(e.target.value))}
                          className="w-28 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Actions (Clear Radar) */}
                  <div className="pt-1">
                    <button
                      onClick={handleClearRadar}
                      className="w-full py-2 px-3 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-mono font-bold rounded-2xl transition-all"
                    >
                      🗑️ CLEAR RADAR STATE
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </aside>

        {/* ── Main Radar Canvas & Inspector Deck ── */}
        <main
          className={`flex-1 flex flex-col min-w-0 min-h-0 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isFullscreen ? "p-0 gap-0" : "p-3 gap-3"
          }`}
        >
          {/* Radar Viewport */}
          <div
            ref={radarContainerRef}
            className={`flex-1 min-h-0 bg-[#04060c] overflow-hidden relative shadow-2xl flex items-center justify-center transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isFullscreen
                ? "h-screen w-screen !border-0 !rounded-none"
                : "rounded-3xl border border-slate-700/40"
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
            />

            {/* Top-Left Tactical Badge */}
            <div className="absolute top-4 left-4 flex items-center gap-2.5 pointer-events-none z-10">
              <div className="bg-slate-900/70 backdrop-blur-2xl border border-slate-700/50 rounded-2xl px-3.5 py-1.5 flex items-center gap-2.5 shadow-2xl">
                <span
                  className="w-2.5 h-2.5 rounded-full shadow-sm animate-pulse"
                  style={{ backgroundColor: currentMap.accent }}
                />
                <span className="text-xs font-mono font-black uppercase text-white tracking-wider">
                  {currentMap.displayName}
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  ({currentMap.id})
                </span>
              </div>

              {/* Utility Entity Count Badges */}
              <div className="hidden sm:flex items-center gap-2.5 bg-slate-900/70 backdrop-blur-2xl border border-slate-700/50 rounded-2xl px-3.5 py-1.5 text-xs font-mono shadow-2xl">
                <span className="text-slate-300 flex items-center gap-1">
                  <span>💨</span> {payload?.smokes?.length ?? 0}
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-amber-400 flex items-center gap-1">
                  <span>🔥</span> {payload?.molotovs?.length ?? 0}
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-cyan-400 flex items-center gap-1">
                  <span>🔫</span> {payload?.guns?.length ?? 0}
                </span>
              </div>

              {isFullscreen && (
                <div className="bg-slate-900/70 backdrop-blur-2xl border border-slate-700/50 rounded-2xl px-3.5 py-1.5 flex items-center gap-3 text-xs font-mono shadow-2xl">
                  <span className="text-amber-400 font-bold">{tAlive} T</span>
                  <span className="text-slate-600">vs</span>
                  <span className="text-cyan-400 font-bold">{ctAlive} CT</span>
                  <span className="text-emerald-400 font-bold">{fps} FPS</span>
                </div>
              )}
            </div>

            {/* In Fullscreen: Floating Draggable Player Overlay */}
            {isFullscreen && (
              <div
                onPointerDown={handleRosterPointerDown}
                onPointerMove={handleRosterPointerMove}
                onPointerUp={handleRosterPointerUp}
                style={
                  rosterPos
                    ? { left: rosterPos.x, top: rosterPos.y, position: "fixed" }
                    : { left: 16, top: 64, position: "absolute" }
                }
                className={`z-30 flex flex-col pointer-events-auto max-h-[calc(100vh-5.5rem)] ${
                  fullscreenPlayersVisible ? "w-80" : "w-auto"
                } ${isDraggingRoster ? "cursor-grabbing" : ""}`}
              >
                {fullscreenPlayersVisible ? (
                  <div className="flex flex-col bg-slate-900/90 backdrop-blur-3xl border border-slate-700/60 rounded-3xl p-3 shadow-2xl space-y-2 overflow-hidden animate-fade-in max-h-full">
                    {/* Draggable Header */}
                    <div className={`flex items-center justify-between border-b border-slate-700/40 pb-2 shrink-0 ${isDraggingRoster ? "cursor-grabbing" : "cursor-grab"}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 text-xs select-none" title="Drag to reposition">⠿</span>
                        <span className="text-xs font-mono font-black text-white uppercase tracking-wider select-none">
                          👥 SQUAD ROSTER
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold">
                          {tAlive + ctAlive} ALIVE
                        </span>
                      </div>
                      <button
                        onClick={() => setFullscreenPlayersVisible(false)}
                        className="p-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700/40 text-xs transition-colors"
                        title="Collapse player roster"
                      >
                        ◀
                      </button>
                    </div>

                    {/* Player Cards: Auto-fit Height with max-h Scroll */}
                    <div className="overflow-y-auto space-y-3 pr-0.5 max-h-[calc(100vh-10rem)]">
                      {/* Terrorists Section */}
                      <div className="space-y-2">
                        <div className="bg-gradient-to-r from-amber-500/25 via-amber-950/40 to-slate-950 border border-amber-500/50 rounded-2xl p-2 flex items-center justify-between text-xs font-mono shadow-md shadow-amber-500/10">
                          <div className="flex items-center gap-1.5 font-black text-amber-400">
                            <span className="text-sm">💣</span>
                            <span>TERRORISTS</span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px]">
                            <span className="text-slate-950 font-black bg-amber-400 px-2 py-0.5 rounded-full shadow-sm">
                              {tAlive}/{tPlayers.length} ALIVE
                            </span>
                            <span className="text-amber-300 font-bold bg-amber-950/60 px-2 py-0.5 rounded-lg border border-amber-500/40">
                              {tTotalHp} HP
                            </span>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          {tPlayers.length > 0 ? (
                            tPlayers.map((p) => (
                              <PlayerCard
                                key={p.id}
                                player={p}
                                isFocused={selectedPlayerId === p.id}
                                onSelect={() => setSelectedPlayerId(selectedPlayerId === p.id ? null : p.id)}
                              />
                            ))
                          ) : (
                            <div className="p-2 text-center text-slate-500 font-mono text-xs">
                              No Terrorists.
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Tactical Divider Between Teams */}
                      <div className="relative py-2.5 my-1 flex items-center justify-center">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-slate-700/60" />
                        </div>
                        <div className="relative bg-slate-950 px-3 py-0.5 rounded-full border border-slate-700/60 flex items-center gap-2 shadow-lg shadow-black/60">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                          <span className="text-[10px] font-mono font-black text-slate-400 tracking-widest uppercase">
                            VS
                          </span>
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                        </div>
                      </div>

                      {/* Counter-Terrorists Section */}
                      <div className="space-y-2 pt-0.5">
                        <div className="bg-gradient-to-r from-cyan-500/25 via-cyan-950/40 to-slate-950 border border-cyan-500/50 rounded-2xl p-2 flex items-center justify-between text-xs font-mono shadow-md shadow-cyan-500/10">
                          <div className="flex items-center gap-1.5 font-black text-cyan-400">
                            <span className="text-sm">🛡️</span>
                            <span>COUNTER-TERRORISTS</span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px]">
                            <span className="text-slate-950 font-black bg-cyan-400 px-2 py-0.5 rounded-full shadow-sm">
                              {ctAlive}/{ctPlayers.length} ALIVE
                            </span>
                            <span className="text-cyan-300 font-bold bg-cyan-950/60 px-2 py-0.5 rounded-lg border border-cyan-500/40">
                              {ctTotalHp} HP
                            </span>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          {ctPlayers.length > 0 ? (
                            ctPlayers.map((p) => (
                              <PlayerCard
                                key={p.id}
                                player={p}
                                isFocused={selectedPlayerId === p.id}
                                onSelect={() => setSelectedPlayerId(selectedPlayerId === p.id ? null : p.id)}
                              />
                            ))
                          ) : (
                            <div className="p-2 text-center text-slate-500 font-mono text-xs">
                              No Counter-Terrorists.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Collapsed Floating Button */
                  <button
                    onClick={() => setFullscreenPlayersVisible(true)}
                    className="bg-slate-900/90 hover:bg-slate-800 backdrop-blur-2xl border border-slate-700/60 rounded-2xl px-3.5 py-2 text-xs font-mono font-black text-white shadow-2xl flex items-center gap-2 transition-transform hover:scale-105"
                    title="Expand player roster"
                  >
                    <span>👥 SQUAD ROSTER ({tAlive + ctAlive}) ▶</span>
                  </button>
                )}
              </div>
            )}

            {/* In Fullscreen: Discreet Exit Button in Top-Right */}
            {isFullscreen && (
              <div className="absolute top-4 right-4 z-20 animate-fade-in pointer-events-auto">
                <button
                  onClick={toggleFullscreen}
                  className="bg-slate-900/80 hover:bg-slate-800 backdrop-blur-2xl border border-slate-700/60 text-slate-200 hover:text-white px-3.5 py-1.5 rounded-2xl text-xs font-mono font-black flex items-center gap-2 shadow-2xl transition-transform hover:scale-105"
                  title="Exit Fullscreen (ESC / F)"
                >
                  <span>✕ EXIT FULLSCREEN</span>
                </button>
              </div>
            )}

            {/* Waiting for Data Overlay */}
            {!useMock && (!payload || payload.players.length === 0) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-2xl z-20 animate-fade-in">
                <div className="text-center space-y-3 max-w-md p-6 bg-slate-900/80 border border-slate-700/60 rounded-3xl shadow-2xl backdrop-blur-3xl">
                  <div className="w-14 h-14 rounded-3xl bg-cyan-500/10 border border-cyan-500/30 mx-auto flex items-center justify-center text-cyan-400 text-2xl font-bold animate-pulse shadow-lg shadow-cyan-500/10">
                    📡
                  </div>
                  <div>
                    <h3 className="text-white font-mono font-black text-sm tracking-wide">
                      {streamMode === "websocket"
                        ? "AWAITING WEBSOCKET STREAM"
                        : "AWAITING HTTP POST TELEMETRY"}
                    </h3>
                    <p className="text-slate-400 font-mono text-xs leading-relaxed mt-1.5">
                      {streamMode === "websocket" ? (
                        <>
                          Transmit live packets to{" "}
                          <code className="text-cyan-400 bg-slate-950 px-2 py-0.5 rounded-lg border border-white/[0.08]">
                            ws://localhost:3000/api/radar/ws
                          </code>
                        </>
                      ) : (
                        <>
                          Send JSON packets to{" "}
                          <code className="text-cyan-400 bg-slate-950 px-2 py-0.5 rounded-lg border border-white/[0.08]">
                            POST /api/radar
                          </code>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-2.5 pt-1">
                    <button
                      onClick={() =>
                        setStreamMode((m) =>
                          m === "websocket" ? "http" : "websocket"
                        )
                      }
                      className="px-3.5 py-2 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/50 text-slate-200 text-xs font-mono font-bold rounded-2xl transition-all duration-300 hover:scale-105 active:scale-95"
                    >
                      {streamMode === "websocket"
                        ? "Switch to HTTP POST"
                        : "Switch to WebSocket"}
                    </button>
                    <button
                      onClick={() => setUseMock(true)}
                      className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-mono font-black rounded-2xl transition-all duration-300 shadow-lg shadow-cyan-500/30 hover:scale-105 active:scale-95"
                    >
                      LAUNCH SIMULATOR
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Bottom Telemetry Inspector Panel (Glassmorphic) ── */}
          <div
            className={`${getInspectorHeightClass()} shrink-0 bg-slate-900/60 border border-slate-700/40 rounded-3xl flex flex-col overflow-hidden backdrop-blur-3xl shadow-2xl transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isFullscreen
                ? "translate-y-24 opacity-0 pointer-events-none h-0 p-0 border-0"
                : inspectorSize === "modal"
                ? "hidden"
                : "translate-y-0 opacity-100"
            }`}
          >
            {/* Inspector Header & Controls */}
            <div className="h-10 border-b border-slate-700/40 px-3.5 flex items-center justify-between bg-slate-950/50 gap-3">
              {/* Left Title & Status Badges */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-mono font-black text-slate-200 uppercase tracking-wider">
                  TELEMETRY INSPECTOR
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold">
                  {payload?.players.length ?? 0} PLAYERS
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 font-bold hidden sm:inline">
                  {(payload?.smokes?.length ?? 0) + (payload?.molotovs?.length ?? 0)} UTILS
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 font-bold hidden md:inline">
                  {payload?.guns?.length ?? 0} GUNS
                </span>
                <span className="text-[10px] font-mono text-slate-500 hidden lg:inline">
                  Sync: {timeAgo}
                </span>
              </div>

              {/* Center Search (Players / JSON) */}
              {activeTab === "players" && (
                <div className="flex-1 max-w-xs hidden sm:block">
                  <input
                    type="text"
                    placeholder="Search player or SteamID..."
                    value={playerSearch}
                    onChange={(e) => setPlayerSearch(e.target.value)}
                    className="w-full bg-slate-950/70 border border-slate-700/40 rounded-xl px-3 py-0.5 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 transition-colors"
                  />
                </div>
              )}
              {activeTab === "raw" && (
                <div className="flex-1 max-w-xs hidden sm:block">
                  <input
                    type="text"
                    placeholder="Filter in JSON payload..."
                    value={jsonSearchQuery}
                    onChange={(e) => setJsonSearchQuery(e.target.value)}
                    className="w-full bg-slate-950/70 border border-slate-700/40 rounded-xl px-3 py-0.5 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 transition-colors"
                  />
                </div>
              )}

              {/* Right Tab Switcher & Size Control Tools */}
              <div className="flex items-center gap-1.5 shrink-0">
                {/* Reset Radar */}
                <button
                  onClick={handleClearRadar}
                  className="px-2 py-0.5 rounded-xl text-xs font-mono font-bold text-rose-400 hover:text-rose-300 hover:bg-rose-500/15 border border-rose-500/30 transition-all mr-1"
                  title="Clear Radar State"
                >
                  RESET
                </button>

                {/* Tabs */}
                <div className="flex items-center bg-slate-950/70 border border-slate-700/40 p-0.5 rounded-2xl">
                  <button
                    onClick={() => setActiveTab("players")}
                    className={`px-2.5 py-0.5 rounded-xl text-xs font-mono transition-all font-bold ${
                      activeTab === "players"
                        ? "bg-slate-800 text-white shadow-sm border border-slate-600/50"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    ROSTER
                  </button>
                  <button
                    onClick={() => setActiveTab("utils")}
                    className={`px-2.5 py-0.5 rounded-xl text-xs font-mono transition-all font-bold ${
                      activeTab === "utils"
                        ? "bg-slate-800 text-white shadow-sm border border-slate-600/50"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    UTILS
                  </button>
                  <button
                    onClick={() => setActiveTab("raw")}
                    className={`px-2.5 py-0.5 rounded-xl text-xs font-mono transition-all font-bold ${
                      activeTab === "raw"
                        ? "bg-slate-800 text-white shadow-sm border border-slate-600/50"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    RAW JSON
                  </button>
                  <button
                    onClick={() => setActiveTab("api")}
                    className={`px-2.5 py-0.5 rounded-xl text-xs font-mono transition-all font-bold hidden md:inline-block ${
                      activeTab === "api"
                        ? "bg-slate-800 text-white shadow-sm border border-slate-600/50"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    API
                  </button>
                  <button
                    onClick={() => setActiveTab("shortcuts")}
                    className={`px-2.5 py-0.5 rounded-xl text-xs font-mono transition-all font-bold hidden lg:inline-block ${
                      activeTab === "shortcuts"
                        ? "bg-slate-800 text-white shadow-sm border border-slate-600/50"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    SHORTCUTS
                  </button>
                </div>

                {/* Size Controllers: Expand / Minimize / Modal */}
                <div className="flex items-center gap-1 pl-1">
                  <button
                    onClick={() =>
                      setInspectorSize((s) =>
                        s === "compact" ? "expanded" : "compact"
                      )
                    }
                    className="p-1 rounded-xl bg-slate-950/70 hover:bg-slate-800 border border-slate-700/40 text-slate-300 hover:text-white transition-all text-xs font-bold"
                    title={
                      inspectorSize === "compact"
                        ? "Expand Height (50%)"
                        : "Collapse Height"
                    }
                  >
                    {inspectorSize === "compact" ? "↕ EXPAND" : "🗕 COMPACT"}
                  </button>
                  <button
                    onClick={() => setInspectorSize("modal")}
                    className="px-2.5 py-1 rounded-xl bg-gradient-to-r from-cyan-500/20 to-blue-600/20 hover:from-cyan-500/30 hover:to-blue-600/30 border border-cyan-500/40 text-cyan-300 text-xs font-mono font-black transition-all flex items-center gap-1 shadow-sm"
                    title="Pop-out Fullscreen Inspector Dialog"
                  >
                    <span>⤢ MAXIMIZE</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Inspector Body Content */}
            <div className="flex-1 overflow-y-auto p-3 font-mono text-xs">
              {activeTab === "players" && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-700/40 text-slate-400 text-[11px]">
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
                                  : "hover:bg-white/[0.04]"
                              }`}
                            >
                              <td className="py-2 px-3 text-slate-500 text-[10px]">
                                {p.id}
                              </td>
                              <td className="py-2 px-3 font-bold text-white flex items-center gap-2">
                                {p.hasBomb && (
                                  <span
                                    className="text-[10px] px-1.5 py-0.5 bg-red-500/20 text-red-300 rounded-md border border-red-500/40 font-black animate-pulse"
                                    title="Carrying C4"
                                  >
                                    💣 C4
                                  </span>
                                )}
                                <span>{p.name}</span>
                                {isFocused && (
                                  <span className="text-[9px] px-2 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold">
                                    FOCUSED
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3">
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                                    p.team === "T"
                                      ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                      : "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                                  }`}
                                >
                                  {p.team}
                                </span>
                              </td>
                              <td className="py-2 px-3">
                                {p.currentWeapon ? (
                                  <span className="px-2 py-0.5 bg-slate-800/90 text-amber-300 border border-amber-500/25 rounded-lg text-[10px] font-mono font-bold">
                                    {p.currentWeapon}
                                  </span>
                                ) : (
                                  <span className="text-slate-600 text-[10px]">--</span>
                                )}
                              </td>
                              <td className="py-2 px-3 font-bold">
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
                              <td className="py-2 px-3 text-cyan-400 font-bold">
                                {p.armor}
                              </td>
                              <td className="py-2 px-3 text-slate-300 text-[11px]">
                                ({p.x.toFixed(1)}, {p.y.toFixed(1)},{" "}
                                {p.z.toFixed(1)})
                              </td>
                              <td className="py-2 px-3 text-slate-300">
                                {p.yaw.toFixed(1)}°
                              </td>
                              <td className="py-2 px-3">
                                {p.isAlive ? (
                                  <span className="text-emerald-400 font-black text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30">
                                    ALIVE
                                  </span>
                                ) : (
                                  <span className="text-rose-400 font-black text-[10px] px-2.5 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30">
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
                            No players registered in current telemetry frame.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === "utils" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-1">
                  {/* Active Smokes Card */}
                  <div className="bg-slate-950/60 border border-slate-700/40 rounded-2xl p-3 space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-700/40 pb-1.5">
                      <span className="text-slate-200 font-bold flex items-center gap-1.5">
                        <span>💨 ACTIVE SMOKES</span>
                      </span>
                      <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-bold">
                        {payload?.smokes?.length ?? 0}
                      </span>
                    </div>
                    <div className="space-y-1 max-h-28 overflow-y-auto">
                      {payload?.smokes && payload.smokes.length > 0 ? (
                        payload.smokes.map((s, idx) => (
                          <div
                            key={s.id || idx}
                            className="flex items-center justify-between text-[11px] bg-slate-900/80 p-1.5 rounded-xl border border-white/[0.04]"
                          >
                            <span className="text-slate-300 font-bold">Smoke #{idx + 1}</span>
                            <span className="text-slate-400">
                              ({s.x.toFixed(1)}, {s.y.toFixed(1)})
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="text-slate-500 text-center py-3 text-[11px]">
                          No active smokes
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Active Molotovs Card */}
                  <div className="bg-slate-950/60 border border-slate-700/40 rounded-2xl p-3 space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-700/40 pb-1.5">
                      <span className="text-amber-300 font-bold flex items-center gap-1.5">
                        <span>🔥 ACTIVE MOLOTOVS</span>
                      </span>
                      <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-bold">
                        {payload?.molotovs?.length ?? 0}
                      </span>
                    </div>
                    <div className="space-y-1 max-h-28 overflow-y-auto">
                      {payload?.molotovs && payload.molotovs.length > 0 ? (
                        payload.molotovs.map((m, idx) => (
                          <div
                            key={m.id || idx}
                            className="flex items-center justify-between text-[11px] bg-slate-900/80 p-1.5 rounded-xl border border-amber-500/20"
                          >
                            <span className="text-amber-400 font-bold">Molotov #{idx + 1}</span>
                            <span className="text-slate-400">
                              ({m.x.toFixed(1)}, {m.y.toFixed(1)})
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="text-slate-500 text-center py-3 text-[11px]">
                          No active molotovs
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Dropped Weapons Card */}
                  <div className="bg-slate-950/60 border border-slate-700/40 rounded-2xl p-3 space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-700/40 pb-1.5">
                      <span className="text-cyan-300 font-bold flex items-center gap-1.5">
                        <span>🔫 DROPPED GUNS</span>
                      </span>
                      <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full font-bold">
                        {payload?.guns?.length ?? 0}
                      </span>
                    </div>
                    <div className="space-y-1 max-h-28 overflow-y-auto">
                      {payload?.guns && payload.guns.length > 0 ? (
                        payload.guns.map((g, idx) => (
                          <div
                            key={g.id || idx}
                            className="flex items-center justify-between text-[11px] bg-slate-900/80 p-1.5 rounded-xl border border-cyan-500/20"
                          >
                            <span className="text-cyan-300 font-bold">{g.name}</span>
                            <span className="text-slate-400">
                              ({g.x.toFixed(1)}, {g.y.toFixed(1)})
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="text-slate-500 text-center py-3 text-[11px]">
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
                        className="px-3 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700/60 rounded-xl text-slate-300 text-xs font-bold transition-all"
                      >
                        ⬇ DOWNLOAD .JSON
                      </button>
                      <button
                        onClick={() =>
                          copyToClipboard(
                            JSON.stringify(rawPayload ?? payload, null, 2),
                            "JSON Payload Copied!"
                          )
                        }
                        className="px-3 py-1 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-cyan-500/20"
                      >
                        COPY JSON
                      </button>
                    </div>
                  </div>
                  <div className="bg-slate-950/80 p-3 rounded-2xl border border-slate-700/40 max-h-64 overflow-y-auto">
                    <HighlightedJson
                      data={rawPayload}
                      searchTerm={jsonSearchQuery}
                    />
                  </div>
                </div>
              )}

              {activeTab === "api" && (
                <div className="space-y-3 text-xs">
                  {/* WebSocket Spec */}
                  <div className="p-3.5 bg-slate-950/60 rounded-2xl border border-slate-700/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-cyan-300 font-bold flex items-center gap-1.5">
                        <span>⚡ WebSocket Stream Endpoint:</span>
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
                        className="px-3 py-1 bg-slate-800 border border-slate-700/60 rounded-xl text-[11px] text-slate-200 font-bold hover:bg-slate-700 transition-colors"
                      >
                        COPY WS URL
                      </button>
                    </div>
                    <div className="bg-slate-900/80 p-2.5 rounded-xl text-cyan-300 font-mono select-all border border-white/[0.05]">
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
                  <div className="p-3.5 bg-slate-950/60 rounded-2xl border border-slate-700/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-cyan-300 font-bold flex items-center gap-1.5">
                        <span>🌐 HTTP POST Protocol Format:</span>
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
                        className="px-3 py-1 bg-slate-800 border border-slate-700/60 rounded-xl text-[11px] text-slate-200 font-bold hover:bg-slate-700 transition-colors"
                      >
                        COPY CURL
                      </button>
                    </div>
                    <pre className="text-emerald-300 bg-slate-900/80 p-3 rounded-xl border border-white/[0.06] overflow-x-auto whitespace-pre-wrap select-all font-mono">
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
  },
  "optional": {
    "utils": {
      "smokes": [
        { "pos": { "x": -1200.5, "y": 450.2, "z": -118.0 } }
      ]
    },
    "gun": [
      {
        "id": "AK-47",
        "pos": { "x": 240.2, "y": -1100.8, "z": -64.0 }
      }
    ]
  }
}'`}
                    </pre>
                  </div>
                </div>
              )}

              {activeTab === "shortcuts" && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-1">
                  {[
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
                      className="bg-slate-950/60 border border-slate-700/40 rounded-xl p-2 flex items-center justify-between shadow-sm"
                    >
                      <span className="text-slate-300 text-[11px]">{sc.label}</span>
                      <kbd className="px-2 py-0.5 bg-slate-800 rounded-lg border border-slate-700 text-cyan-400 font-bold text-xs shadow-inner">
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

      {/* ── Maximized Telemetry Inspector Modal Dialog (Glassmorphic) ── */}
      {inspectorSize === "modal" && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-3xl flex items-center justify-center p-4 md:p-8 animate-fade-in">
          <div className="bg-slate-900/85 border border-slate-700/60 rounded-3xl w-full max-w-6xl h-[88vh] flex flex-col shadow-2xl overflow-hidden animate-modal-in backdrop-blur-3xl">
            {/* Modal Header */}
            <div className="h-14 border-b border-slate-700/40 px-5 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 text-base font-bold shadow-md shadow-cyan-500/20">
                  ⤢
                </div>
                <div>
                  <h2 className="text-sm font-mono font-black text-white uppercase tracking-wider">
                    MAXIMIZED TELEMETRY INSPECTOR
                  </h2>
                  <div className="text-[10px] font-mono text-slate-400 flex items-center gap-2">
                    <span>Map: {currentMap.displayName}</span>
                    <span>•</span>
                    <span>{payload?.players.length ?? 0} active entities</span>
                    <span>•</span>
                    <span>Last sync: {lastPacketTime}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-slate-950/70 border border-slate-700/40 p-1 rounded-2xl">
                  <button
                    onClick={() => setActiveTab("raw")}
                    className={`px-3.5 py-1 rounded-xl text-xs font-mono font-bold transition-all ${
                      activeTab === "raw"
                        ? "bg-slate-800 text-white shadow-sm border border-slate-600/50"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    RAW JSON
                  </button>
                  <button
                    onClick={() => setActiveTab("players")}
                    className={`px-3.5 py-1 rounded-xl text-xs font-mono font-bold transition-all ${
                      activeTab === "players"
                        ? "bg-slate-800 text-white shadow-sm border border-slate-600/50"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    PLAYERS TABLE
                  </button>
                  <button
                    onClick={() => setActiveTab("utils")}
                    className={`px-3.5 py-1 rounded-xl text-xs font-mono font-bold transition-all ${
                      activeTab === "utils"
                        ? "bg-slate-800 text-white shadow-sm border border-slate-600/50"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    UTILITIES
                  </button>
                  <button
                    onClick={() => setActiveTab("api")}
                    className={`px-3.5 py-1 rounded-xl text-xs font-mono font-bold transition-all ${
                      activeTab === "api"
                        ? "bg-slate-800 text-white shadow-sm border border-slate-600/50"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    API INTEGRATION
                  </button>
                </div>

                <button
                  onClick={downloadJson}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700/60 rounded-xl text-slate-200 text-xs font-bold font-mono transition-all"
                >
                  ⬇ DOWNLOAD JSON
                </button>
                <button
                  onClick={() =>
                    copyToClipboard(
                      JSON.stringify(payload, null, 2),
                      "JSON Payload Copied!"
                    )
                  }
                  className="px-4 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold font-mono rounded-xl text-xs transition-all shadow-md shadow-cyan-500/25"
                >
                  COPY JSON
                </button>
                <button
                  onClick={() => setInspectorSize("expanded")}
                  className="p-1.5 rounded-xl bg-slate-950/70 hover:bg-slate-800 border border-slate-700/40 text-slate-400 hover:text-white transition-all ml-1"
                  title="Minimize back to bottom deck (ESC)"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Sub-Header Filter Bar */}
            <div className="px-5 py-2.5 bg-slate-950/60 border-b border-slate-700/40 flex items-center justify-between gap-4">
              <div className="flex-1 max-w-md">
                <input
                  type="text"
                  placeholder="Filter keys, values, player names, or coordinates..."
                  value={jsonSearchQuery}
                  onChange={(e) => setJsonSearchQuery(e.target.value)}
                  className="w-full bg-slate-900/80 border border-slate-700/40 rounded-xl px-3.5 py-1.5 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/60"
                />
              </div>
              <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
                <span>
                  Payload size:{" "}
                  <strong className="text-emerald-400">
                    {(JSON.stringify(payload ?? {}).length / 1024).toFixed(2)} KB
                  </strong>
                </span>
                <span>•</span>
                <span>
                  Transport:{" "}
                  <strong className="text-cyan-400 uppercase font-bold">
                    {streamMode}
                  </strong>
                </span>
              </div>
            </div>

            {/* Modal Body Container */}
            <div className="flex-1 overflow-y-auto p-5 font-mono text-xs bg-slate-950/40">
              {activeTab === "raw" && (
                <div className="rounded-2xl p-4 bg-slate-950/80 border border-slate-700/40">
                  <HighlightedJson
                    data={rawPayload}
                    searchTerm={jsonSearchQuery}
                  />
                </div>
              )}

              {activeTab === "players" && (
                <div className="overflow-x-auto rounded-2xl bg-slate-950/80 border border-slate-700/40 p-3">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-700/40 text-slate-400 text-xs">
                        <th className="pb-3 px-3">STEAMID</th>
                        <th className="pb-3 px-3">NAME</th>
                        <th className="pb-3 px-3">TEAM</th>
                        <th className="pb-3 px-3">WEAPON</th>
                        <th className="pb-3 px-3">HP</th>
                        <th className="pb-3 px-3">ARMOR</th>
                        <th className="pb-3 px-3">POSITION (X, Y, Z)</th>
                        <th className="pb-3 px-3">YAW</th>
                        <th className="pb-3 px-3">STATUS</th>
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
                              className={`border-b border-white/[0.04] cursor-pointer transition-colors ${
                                isFocused
                                  ? "bg-cyan-500/[0.14] border-cyan-500/40"
                                  : "hover:bg-white/[0.04]"
                              }`}
                            >
                              <td className="py-2.5 px-3 text-slate-500 text-xs">
                                {p.id}
                              </td>
                              <td className="py-2.5 px-3 font-bold text-white flex items-center gap-2">
                                {p.hasBomb && (
                                  <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-300 rounded-md border border-red-500/40 font-black animate-pulse">
                                    💣 C4
                                  </span>
                                )}
                                <span>{p.name}</span>
                              </td>
                              <td className="py-2.5 px-3">
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-xs font-black ${
                                    p.team === "T"
                                      ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                      : "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                                  }`}
                                >
                                  {p.team}
                                </span>
                              </td>
                              <td className="py-2.5 px-3">
                                {p.currentWeapon ? (
                                  <span className="px-2.5 py-1 bg-slate-800/90 text-amber-300 border border-amber-500/25 rounded-lg text-xs font-mono font-bold">
                                    {p.currentWeapon}
                                  </span>
                                ) : (
                                  <span className="text-slate-600 text-xs">--</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 font-bold">
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
                              <td className="py-2.5 px-3 text-cyan-400 font-bold">
                                {p.armor}
                              </td>
                              <td className="py-2.5 px-3 text-slate-300">
                                ({p.x.toFixed(1)}, {p.y.toFixed(1)},{" "}
                                {p.z.toFixed(1)})
                              </td>
                              <td className="py-2.5 px-3 text-slate-300">
                                {p.yaw.toFixed(1)}°
                              </td>
                              <td className="py-2.5 px-3">
                                {p.isAlive ? (
                                  <span className="text-emerald-400 font-black text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30">
                                    ALIVE
                                  </span>
                                ) : (
                                  <span className="text-rose-400 font-black text-xs px-2.5 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30">
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
                            colSpan={8}
                            className="py-12 text-center text-slate-500 font-mono"
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Active Smokes */}
                  <div className="bg-slate-950/80 border border-slate-700/40 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-700/40 pb-2">
                      <span className="text-slate-200 font-bold text-sm">💨 ACTIVE SMOKES</span>
                      <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full">
                        {payload?.smokes?.length ?? 0}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {payload?.smokes && payload.smokes.length > 0 ? (
                        payload.smokes.map((s, idx) => (
                          <div
                            key={s.id || idx}
                            className="flex items-center justify-between text-xs bg-slate-900/80 p-2.5 rounded-xl border border-white/[0.04]"
                          >
                            <span className="text-slate-300 font-bold">Smoke #{idx + 1}</span>
                            <span className="text-slate-400">
                              XYZ: ({s.x.toFixed(1)}, {s.y.toFixed(1)}, {s.z.toFixed(1)})
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="text-slate-500 text-center py-6">No active smokes</div>
                      )}
                    </div>
                  </div>

                  {/* Active Molotovs */}
                  <div className="bg-slate-950/80 border border-slate-700/40 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-700/40 pb-2">
                      <span className="text-amber-300 font-bold text-sm">🔥 ACTIVE MOLOTOVS</span>
                      <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-bold">
                        {payload?.molotovs?.length ?? 0}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {payload?.molotovs && payload.molotovs.length > 0 ? (
                        payload.molotovs.map((m, idx) => (
                          <div
                            key={m.id || idx}
                            className="flex items-center justify-between text-xs bg-slate-900/80 p-2.5 rounded-xl border border-amber-500/20"
                          >
                            <span className="text-amber-400 font-bold">Molotov #{idx + 1}</span>
                            <span className="text-slate-400">
                              XYZ: ({m.x.toFixed(1)}, {m.y.toFixed(1)}, {m.z.toFixed(1)})
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="text-slate-500 text-center py-6">No active molotovs</div>
                      )}
                    </div>
                  </div>

                  {/* Dropped Guns */}
                  <div className="bg-slate-950/80 border border-slate-700/40 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-700/40 pb-2">
                      <span className="text-cyan-300 font-bold text-sm">🔫 DROPPED GUNS</span>
                      <span className="text-xs bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full font-bold">
                        {payload?.guns?.length ?? 0}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {payload?.guns && payload.guns.length > 0 ? (
                        payload.guns.map((g, idx) => (
                          <div
                            key={g.id || idx}
                            className="flex items-center justify-between text-xs bg-slate-900/80 p-2.5 rounded-xl border border-cyan-500/20"
                          >
                            <span className="text-cyan-300 font-bold">{g.name}</span>
                            <span className="text-slate-400">
                              XYZ: ({g.x.toFixed(1)}, {g.y.toFixed(1)}, {g.z.toFixed(1)})
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="text-slate-500 text-center py-6">No dropped weapons</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "api" && (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-700/40 space-y-2">
                    <span className="text-cyan-300 font-bold text-sm">⚡ WebSocket Integration</span>
                    <pre className="p-3 bg-slate-900/80 rounded-xl text-emerald-300 select-all overflow-x-auto">
{`const ws = new WebSocket("${typeof window !== "undefined" && window.location.protocol === "https:" ? "wss:" : "ws:"}//${typeof window !== "undefined" ? window.location.host : "localhost:3000"}/api/radar/ws");

ws.onopen = () => {
  console.log("Connected to CS2 Live Radar WebSocket");
};

// Send telemetry frame:
ws.send(JSON.stringify({
  map: "de_dust2",
  players: [
    {
      steamid: "76561198000000001",
      name: "ZywOo",
      team: "T",
      health: 100,
      armor: 100,
      alive: true,
      pos: { x: -1200.5, y: 450.2, z: -118.0 },
      yaw: 145.0
    }
  ]
}));`}
                    </pre>
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
