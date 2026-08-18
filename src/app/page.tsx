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
import type { RadarPayload, ExecutorPayload } from "@/lib/radarStore";
import { transformExecutorPayload } from "@/lib/radarStore";

const RadarCanvas = dynamic(() => import("@/components/RadarCanvas"), {
  ssr: false,
});

export type StreamMode = "websocket" | "http";
type ConnectionStatus = "live" | "awaiting" | "connecting" | "offline";

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

export default function Page() {
  const [mounted, setMounted] = useState(false);
  const [selectedMap, setSelectedMap] = useState("de_dust2");
  const [payload, setPayload] = useState<RadarPayload | null>(null);

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
  const [packetCount, setPacketCount] = useState(0);
  const [lastPacketTime, setLastPacketTime] = useState<string>("--");
  const [lastPacketDate, setLastPacketDate] = useState<number>(0);
  const [timeAgo, setTimeAgo] = useState<string>("Waiting for data...");
  const [playerSearch, setPlayerSearch] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [copiedToast, setCopiedToast] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [autoFollowMap, setAutoFollowMap] = useState(true);

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
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleFullscreen]);

  // Refs to avoid recreating handleIncomingPayload (and thus WebSocket) on map/setting changes
  const selectedMapRef = useRef(selectedMap);
  selectedMapRef.current = selectedMap;
  const autoFollowMapRef = useRef(autoFollowMap);
  autoFollowMapRef.current = autoFollowMap;

  // Process incoming telemetry packet
  const handleIncomingPayload = useCallback(
    (rawData: unknown) => {
      if (!rawData || typeof rawData !== "object") return;
      const rawObj = rawData as Record<string, unknown>;
      if (!rawObj.map || !Array.isArray(rawObj.players)) return;

      // Transform & normalize to guarantee unique IDs and coordinate structure for all players
      const data = transformExecutorPayload(rawObj as unknown as ExecutorPayload);

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
    [] // stable — no deps, uses refs for dynamic values
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
          setStatus("awaiting");
        } else if (parsed?.map && Array.isArray(parsed.players)) {
          handleIncomingPayload(parsed as RadarPayload);
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
      // Auto reconnect after 3s
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
          if (json?.state && json.state.map) {
            handleIncomingPayload(json.state as RadarPayload);
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

    // Cleanup previous connections
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
      }, 5);
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedToast(true);
    setTimeout(() => setCopiedToast(false), 2000);
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
    return payload.players.find((p) => p.id === payload.bomb?.carrierId) ?? null;
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

  // Badge Status config
  const isWs = streamMode === "websocket";
  const badgeConfig = {
    live: {
      label: isWs ? "WS LIVE STREAM" : "HTTP LIVE STREAM",
      color: "text-emerald-400",
      dot: "bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400",
      bg: "bg-emerald-500/10 border-emerald-500/30",
    },
    awaiting: {
      label: isWs ? "WS AWAITING EXECUTOR" : "HTTP AWAITING EXECUTOR",
      color: "text-amber-400",
      dot: "bg-amber-400 animate-pulse shadow-sm shadow-amber-400",
      bg: "bg-amber-500/10 border-amber-500/30",
    },
    connecting: {
      label: "WS CONNECTING...",
      color: "text-amber-400",
      dot: "bg-amber-400 animate-pulse",
      bg: "bg-amber-500/10 border-amber-500/30",
    },
    offline: {
      label: "WS OFFLINE (SWITCH TO HTTP)",
      color: "text-rose-400",
      dot: "bg-rose-500",
      bg: "bg-rose-500/10 border-rose-500/30",
    },
  }[status];

  if (!mounted) {
    return <div className="h-screen w-screen bg-[#07090e]" />;
  }

  return (
    <div
      className="h-screen w-screen bg-[#07090e] text-slate-100 flex flex-col font-sans overflow-hidden select-none"
      suppressHydrationWarning
    >
      {/* ── Top Pro Esports Command Bar ── */}
      <header className="h-14 border-b border-white/[0.08] bg-[#0b0f19]/95 backdrop-blur-xl px-4 flex items-center justify-between gap-4 shrink-0 z-30">
        {/* Left Branding */}
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-amber-500 via-orange-500 to-amber-300 flex items-center justify-center font-mono font-black text-xs text-black shadow-lg shadow-orange-500/20 border border-amber-300/30">
            CS2
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black tracking-widest uppercase font-mono text-white">
                TACTICAL RADAR
              </span>
              <span className="text-[10px] text-amber-400 font-mono font-black px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                PRO HUD
              </span>
            </div>
            <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1.5">
              <span>ACTIVE MAP:</span>
              <span className="text-amber-400 font-bold">
                {currentMap.displayName}
              </span>
              <span className="text-slate-600">•</span>
              <span>{currentMap.tag}</span>
            </div>
          </div>
        </div>

        {/* Protocol Selector Pill (WebSocket vs HTTP POST) */}
        <div className="flex items-center bg-[#070a12] border border-white/[0.1] p-1 rounded-xl shadow-inner gap-1">
          <button
            onClick={() => setStreamMode("websocket")}
            className={`px-3 py-1 rounded-lg text-xs font-mono font-black transition-all flex items-center gap-1.5 ${
              streamMode === "websocket"
                ? "bg-gradient-to-r from-amber-500 to-orange-500 text-black shadow-md shadow-orange-500/25"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
            }`}
            title="Listen for live data via WebSocket socket"
          >
            <span>⚡ WEBSOCKET</span>
            <span className="text-[9px] opacity-75 font-normal">
              (Default)
            </span>
          </button>
          <button
            onClick={() => setStreamMode("http")}
            className={`px-3 py-1 rounded-lg text-xs font-mono font-black transition-all flex items-center gap-1.5 ${
              streamMode === "http"
                ? "bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md shadow-blue-500/25"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
            }`}
            title="Listen for live data via HTTP POST / Fast Polling (Ideal for Vercel)"
          >
            <span>🌐 HTTP POST</span>
          </button>
        </div>

        {/* Center Team Health & Alive Ratio */}
        <div className="hidden xl:flex items-center gap-6 bg-[#0e1424] border border-white/[0.06] px-4 py-1.5 rounded-xl shadow-inner">
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-amber-400 shadow-sm shadow-amber-400" />
            <div className="text-left">
              <div className="text-[10px] font-mono font-black text-amber-400 flex items-center justify-between gap-3">
                <span>TERRORISTS</span>
                <span className="text-white">
                  {tAlive}/{tPlayers.length || 0}
                </span>
              </div>
              <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-0.5">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-300"
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

          <div className="text-xs font-mono font-black text-slate-600">VS</div>

          <div className="flex items-center gap-2.5">
            <div className="text-right">
              <div className="text-[10px] font-mono font-black text-sky-400 flex items-center justify-between gap-3">
                <span className="text-white">
                  {ctAlive}/{ctPlayers.length || 0}
                </span>
                <span>COUNTER-T</span>
              </div>
              <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-0.5">
                <div
                  className="h-full bg-gradient-to-r from-sky-500 to-cyan-400 transition-all duration-300 ml-auto"
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
            <div className="w-2 h-2 rounded-full bg-sky-400 shadow-sm shadow-sky-400" />
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-2 border rounded-lg px-2.5 py-1 text-xs font-mono font-black ${badgeConfig.bg}`}
          >
            <div className={`w-2 h-2 rounded-full ${badgeConfig.dot}`} />
            <span className={badgeConfig.color}>{badgeConfig.label}</span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 bg-[#0e1424] border border-white/[0.06] rounded-lg px-2 py-1 text-xs font-mono">
            <span className="text-slate-500">FPS</span>
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

          <div className="hidden md:flex items-center gap-1.5 bg-[#0e1424] border border-white/[0.06] rounded-lg px-2 py-1 text-xs font-mono">
            <span className="text-slate-500">LAT</span>
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

          <button
            onClick={() => {
              setAudioEnabled((v) => {
                sfx.enabled = !v;
                return !v;
              });
            }}
            className={`p-1.5 rounded-lg border text-xs font-mono transition-all ${
              audioEnabled
                ? "bg-amber-500/20 border-amber-500/60 text-amber-300 shadow-sm"
                : "bg-[#0e1424] border-white/[0.08] text-slate-400 hover:text-slate-200"
            }`}
            title="Toggle Audio Feedback (Key: M)"
          >
            {audioEnabled ? "🔊" : "🔇"}
          </button>

          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-1.5 bg-[#0e1424] hover:bg-[#141b30] border border-white/[0.1] hover:border-white/[0.2] text-slate-200 text-xs font-mono font-black px-3 py-1.5 rounded-lg transition-all active:scale-95 shadow-md"
            title="Toggle Fullscreen (Key: F)"
          >
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              {isFullscreen ? (
                <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-14v3h3v2h-5V5h2z" />
              ) : (
                <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
              )}
            </svg>
            <span className="hidden sm:inline">
              {isFullscreen ? "EXIT" : "FULLSCREEN"}
            </span>
          </button>

          <button
            onClick={() => setUseMock((v) => !v)}
            className={`text-xs font-mono font-black px-3 py-1.5 rounded-lg border transition-all active:scale-95 shadow-lg ${
              useMock
                ? "bg-gradient-to-r from-amber-500/30 to-orange-500/30 border-amber-500 text-amber-300 shadow-amber-500/15"
                : "bg-[#0e1424] border-white/[0.08] text-slate-400 hover:text-slate-200 hover:border-white/[0.15]"
            }`}
            title="Toggle Demo Mode Simulator (Key: D)"
          >
            {useMock ? "● SIMULATOR ON" : "DEMO SIM"}
          </button>
        </div>
      </header>

      {/* ── Main Work Area ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* ── Left Sidebar: Maps & Tactical Scoreboard ── */}
        <aside className="w-64 shrink-0 bg-[#090d16] border-r border-white/[0.08] flex flex-col overflow-y-auto">
          {/* Map Selector */}
          <div className="p-3 border-b border-white/[0.08]">
            <div className="text-[11px] font-mono font-black text-slate-400 uppercase tracking-widest mb-2.5 flex items-center justify-between">
              <span>COMPETITIVE POOL</span>
              <span className="text-[10px] text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20 font-black">
                {MAPS.length} MAPS
              </span>
            </div>
            <div className="space-y-1">
              {MAPS.map((m) => {
                const isSelected = selectedMap === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => handleMapChange(m.id)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-mono transition-all flex items-center justify-between border ${
                      isSelected
                        ? "bg-amber-500/15 border-amber-500/60 text-amber-300 font-black shadow-md shadow-amber-500/10"
                        : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-[#111728]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: m.accent }}
                      />
                      <span className="truncate">{m.displayName}</span>
                    </div>
                    <span className="text-[9px] px-1.5 py-0.5 bg-[#0e1424] text-slate-400 rounded-md border border-white/[0.06] font-bold">
                      {m.tag}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Squad Status Cards */}
          <div className="p-3 border-b border-white/[0.08]">
            <div className="text-[11px] font-mono font-black text-slate-400 uppercase tracking-widest mb-2.5 flex items-center justify-between">
              <span>SQUAD TELEMETRY</span>
              <span className="text-[10px] text-slate-500">LIVE HUD</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-yellow-500/[0.07] border border-yellow-500/25 rounded-xl p-2.5 text-center shadow-sm">
                <div className="text-yellow-400 font-mono font-black text-2xl leading-none">
                  {tAlive}
                  <span className="text-xs text-yellow-600 font-normal">
                    /{tPlayers.length || 0}
                  </span>
                </div>
                <div className="text-[10px] font-mono font-black text-yellow-400 mt-1 uppercase tracking-wider">
                  TERRORISTS
                </div>
                <div className="text-[10px] font-mono text-slate-400 mt-1">
                  {tTotalHp} Total HP
                </div>
              </div>

              <div className="bg-sky-500/[0.07] border border-sky-500/25 rounded-xl p-2.5 text-center shadow-sm">
                <div className="text-sky-400 font-mono font-black text-2xl leading-none">
                  {ctAlive}
                  <span className="text-xs text-sky-600 font-normal">
                    /{ctPlayers.length || 0}
                  </span>
                </div>
                <div className="text-[10px] font-mono font-black text-sky-400 mt-1 uppercase tracking-wider">
                  COUNTER-T
                </div>
                <div className="text-[10px] font-mono text-slate-400 mt-1">
                  {ctTotalHp} Total HP
                </div>
              </div>
            </div>

            {/* Bomb Status Indicator */}
            <div className="mt-2.5 p-2 rounded-xl bg-[#0e1424] border border-white/[0.06] text-xs font-mono flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <span>💣 C4 BOMB:</span>
              </span>
              {bombCarrier ? (
                <span className="text-amber-400 font-bold flex items-center gap-1">
                  <span>Carried by</span>
                  <span className="text-white underline">{bombCarrier.name}</span>
                </span>
              ) : payload?.bomb ? (
                <span className="text-rose-400 font-bold animate-pulse">
                  ON GROUND / PLANTED
                </span>
              ) : (
                <span className="text-slate-500">None</span>
              )}
            </div>
          </div>

          {/* Viewport Preferences */}
          <div className="p-3 border-b border-white/[0.08]">
            <div className="text-[11px] font-mono font-black text-slate-400 uppercase tracking-widest mb-2.5">
              HUD PREFERENCES
            </div>
            <div className="space-y-1.5 text-xs font-mono">
              <label className="flex items-center justify-between p-2 rounded-lg bg-[#0e1424] hover:bg-[#12192e] border border-white/[0.06] cursor-pointer">
                <span className="text-slate-300">Player Names (N)</span>
                <input
                  type="checkbox"
                  checked={showNames}
                  onChange={(e) => setShowNames(e.target.checked)}
                  className="rounded border-slate-700 text-amber-500 focus:ring-0"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded-lg bg-[#0e1424] hover:bg-[#12192e] border border-white/[0.06] cursor-pointer">
                <span className="text-slate-300">FOV Cones (V)</span>
                <input
                  type="checkbox"
                  checked={showVisionCones}
                  onChange={(e) => setShowVisionCones(e.target.checked)}
                  className="rounded border-slate-700 text-amber-500 focus:ring-0"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded-lg bg-[#0e1424] hover:bg-[#12192e] border border-white/[0.06] cursor-pointer">
                <span className="text-slate-300">Active Smokes (S)</span>
                <input
                  type="checkbox"
                  checked={showSmokes}
                  onChange={(e) => setShowSmokes(e.target.checked)}
                  className="rounded border-slate-700 text-amber-500 focus:ring-0"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded-lg bg-[#0e1424] hover:bg-[#12192e] border border-white/[0.06] cursor-pointer">
                <span className="text-slate-300">Active Molotovs (K)</span>
                <input
                  type="checkbox"
                  checked={showMolotovs}
                  onChange={(e) => setShowMolotovs(e.target.checked)}
                  className="rounded border-slate-700 text-amber-500 focus:ring-0"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded-lg bg-[#0e1424] hover:bg-[#12192e] border border-white/[0.06] cursor-pointer">
                <span className="text-slate-300">Dropped Guns (U)</span>
                <input
                  type="checkbox"
                  checked={showGuns}
                  onChange={(e) => setShowGuns(e.target.checked)}
                  className="rounded border-slate-700 text-amber-500 focus:ring-0"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded-lg bg-[#0e1424] hover:bg-[#12192e] border border-white/[0.06] cursor-pointer">
                <span className="text-slate-300">Tactical Reticle (G)</span>
                <input
                  type="checkbox"
                  checked={showGrid}
                  onChange={(e) => setShowGrid(e.target.checked)}
                  className="rounded border-slate-700 text-amber-500 focus:ring-0"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded-lg bg-[#0e1424] hover:bg-[#12192e] border border-white/[0.06] cursor-pointer">
                <span className="text-slate-300">Auto-Follow Map</span>
                <input
                  type="checkbox"
                  checked={autoFollowMap}
                  onChange={(e) => setAutoFollowMap(e.target.checked)}
                  className="rounded border-slate-700 text-amber-500 focus:ring-0"
                />
              </label>

              <div className="p-2 rounded-lg bg-[#0e1424] border border-white/[0.06] space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Radar Zoom</span>
                  <span className="text-amber-400 font-bold">
                    {radarZoom.toFixed(1)}x
                  </span>
                </div>
                <input
                  type="range"
                  min="0.8"
                  max="1.5"
                  step="0.1"
                  value={radarZoom}
                  onChange={(e) => setRadarZoom(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Focused Player HUD Card */}
          {selectedPlayer && (
            <div className="p-3 bg-amber-500/[0.06] border-b border-amber-500/20">
              <div className="text-[11px] font-mono font-black text-amber-400 uppercase tracking-widest mb-1.5 flex items-center justify-between">
                <span>FOCUSED PLAYER</span>
                <button
                  onClick={() => setSelectedPlayerId(null)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
              <div className="bg-[#0e1424] border border-white/[0.08] rounded-xl p-2.5 space-y-1.5 text-xs font-mono">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-sm flex items-center gap-1.5">
                    {selectedPlayer.hasBomb && <span>💣</span>}
                    <span>{selectedPlayer.name}</span>
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      selectedPlayer.team === "T"
                        ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                        : "bg-sky-500/20 text-sky-400 border border-sky-500/30"
                    }`}
                  >
                    {selectedPlayer.team}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-500">HP:</span>{" "}
                    <span className="text-emerald-400 font-bold">
                      {selectedPlayer.health}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Armor:</span>{" "}
                    <span className="text-cyan-400 font-bold">
                      {selectedPlayer.armor}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Yaw:</span>{" "}
                    <span className="text-slate-200">
                      {selectedPlayer.yaw.toFixed(0)}°
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Z-Elev:</span>{" "}
                    <span className="text-slate-200">
                      {selectedPlayer.z.toFixed(0)}
                    </span>
                  </div>
                </div>
                <div className="text-[10px] text-slate-500 truncate">
                  POS: ({selectedPlayer.x.toFixed(1)},{" "}
                  {selectedPlayer.y.toFixed(1)}, {selectedPlayer.z.toFixed(1)})
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* ── Main Radar Canvas & Bottom Inspector ── */}
        <main className="flex-1 flex flex-col min-w-0 min-h-0 bg-[#07090e] p-3 gap-3">
          <div
            ref={radarContainerRef}
            className={`flex-1 min-h-0 bg-[#04060c] rounded-2xl overflow-hidden relative border border-white/[0.08] shadow-2xl flex items-center justify-center ${
              isFullscreen ? "h-screen w-screen !border-0 !rounded-0" : ""
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

            {/* Top Badge */}
            <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none z-10">
              <div className="bg-[#0b0f19]/90 backdrop-blur-md border border-white/[0.08] rounded-xl px-3 py-1.5 flex items-center gap-2.5 shadow-2xl">
                <span
                  className="w-2.5 h-2.5 rounded-full shadow-sm"
                  style={{ backgroundColor: currentMap.accent }}
                />
                <span className="text-xs font-mono font-black uppercase text-white tracking-wider">
                  {currentMap.displayName}
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  ({currentMap.id})
                </span>
              </div>

              {/* Counts Badge */}
              <div className="hidden sm:flex items-center gap-2 bg-[#0b0f19]/90 backdrop-blur-md border border-white/[0.08] rounded-xl px-3 py-1.5 text-xs font-mono shadow-2xl">
                <span className="text-slate-300">
                  💨 {payload?.smokes?.length ?? 0}
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-amber-400">
                  🔥 {payload?.molotovs?.length ?? 0}
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-sky-400">
                  🔫 {payload?.guns?.length ?? 0}
                </span>
              </div>

              {isFullscreen && (
                <div className="bg-[#0b0f19]/90 backdrop-blur-md border border-white/[0.08] rounded-xl px-3 py-1.5 flex items-center gap-3 text-xs font-mono shadow-2xl">
                  <span className="text-yellow-400 font-bold">{tAlive} T</span>
                  <span className="text-slate-600">vs</span>
                  <span className="text-sky-400 font-bold">{ctAlive} CT</span>
                  <span className="text-emerald-400 font-bold">{fps} FPS</span>
                </div>
              )}
            </div>

            {/* Top Right Controls */}
            <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
              <button
                onClick={toggleFullscreen}
                className="bg-[#0b0f19]/90 hover:bg-[#12192e] backdrop-blur-md border border-white/[0.1] hover:border-white/[0.2] text-slate-200 hover:text-white px-3 py-1.5 rounded-xl text-xs font-mono font-black flex items-center gap-1.5 transition-all shadow-2xl active:scale-95"
              >
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                  {isFullscreen ? (
                    <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-14v3h3v2h-5V5h2z" />
                  ) : (
                    <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
                  )}
                </svg>
                <span>{isFullscreen ? "EXIT FULLSCREEN" : "FULLSCREEN"}</span>
              </button>
            </div>

            {/* Waiting for Data Overlay */}
            {!useMock && (!payload || payload.players.length === 0) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#07090e]/85 backdrop-blur-md z-20">
                <div className="text-center space-y-3.5 max-w-md p-6 bg-[#0b0f19] border border-white/[0.08] rounded-2xl shadow-2xl">
                  <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 mx-auto flex items-center justify-center text-amber-400 text-xl font-bold animate-pulse">
                    📡
                  </div>
                  <h3 className="text-white font-mono font-black text-base tracking-wide">
                    {streamMode === "websocket"
                      ? "AWAITING WEBSOCKET STREAM"
                      : "AWAITING HTTP POST TELEMETRY"}
                  </h3>
                  <p className="text-slate-400 font-mono text-xs leading-relaxed">
                    {streamMode === "websocket" ? (
                      <>
                        Transmite date direct pe WebSocket la{" "}
                        <code className="text-emerald-400 bg-slate-950 px-1.5 py-0.5 rounded border border-white/[0.08]">
                          ws://localhost:3000/api/radar/ws
                        </code>
                      </>
                    ) : (
                      <>
                        Transmite pachete JSON prin HTTP{" "}
                        <code className="text-emerald-400 bg-slate-950 px-1.5 py-0.5 rounded border border-white/[0.08]">
                          POST /api/radar
                        </code>
                      </>
                    )}
                  </p>
                  <div className="flex items-center justify-center gap-2 pt-1">
                    <button
                      onClick={() =>
                        setStreamMode((m) =>
                          m === "websocket" ? "http" : "websocket"
                        )
                      }
                      className="px-3.5 py-2 bg-[#12192e] hover:bg-[#192340] border border-white/[0.1] text-slate-200 text-xs font-mono font-bold rounded-xl transition-all"
                    >
                      {streamMode === "websocket"
                        ? "Comută pe HTTP POST"
                        : "Comută pe WebSocket"}
                    </button>
                    <button
                      onClick={() => setUseMock(true)}
                      className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black text-xs font-mono font-black rounded-xl transition-all shadow-lg shadow-orange-500/20 active:scale-95"
                    >
                      PORNEȘTE SIMULATOR
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Bottom Telemetry Inspector Panel ── */}
          {!isFullscreen && (
            <div className="h-48 shrink-0 bg-[#0b0f19]/95 border border-white/[0.08] rounded-2xl flex flex-col overflow-hidden backdrop-blur-xl shadow-xl">
              <div className="h-10 border-b border-white/[0.08] px-3 flex items-center justify-between bg-[#080b13]/80 gap-3">
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-mono font-black text-slate-300 uppercase tracking-wider">
                    TELEMETRY INSPECTOR
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold">
                    {payload?.players.length ?? 0} PLAYERS
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-400 border border-sky-500/30 font-bold">
                    {(payload?.smokes?.length ?? 0) + (payload?.molotovs?.length ?? 0)} UTILS
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/30 font-bold">
                    {payload?.guns?.length ?? 0} GUNS
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    Sync: {timeAgo}
                  </span>
                </div>

                {activeTab === "players" && (
                  <div className="flex-1 max-w-xs">
                    <input
                      type="text"
                      placeholder="Search player or SteamID..."
                      value={playerSearch}
                      onChange={(e) => setPlayerSearch(e.target.value)}
                      className="w-full bg-[#0e1424] border border-white/[0.08] rounded-lg px-2.5 py-1 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                )}

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={handleClearRadar}
                    className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/20 transition-all mr-1"
                    title="Clear radar state and reset players"
                  >
                    RESET
                  </button>
                  <button
                    onClick={() => setActiveTab("players")}
                    className={`px-3 py-1 rounded-lg text-xs font-mono transition-all font-bold ${
                      activeTab === "players"
                        ? "bg-[#141b30] text-white border border-white/[0.15] shadow-sm"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    ROSTER ({payload?.players.length ?? 0})
                  </button>
                  <button
                    onClick={() => setActiveTab("utils")}
                    className={`px-3 py-1 rounded-lg text-xs font-mono transition-all font-bold ${
                      activeTab === "utils"
                        ? "bg-[#141b30] text-white border border-white/[0.15] shadow-sm"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    UTILS & WEAPONS ({(payload?.guns?.length ?? 0) + (payload?.smokes?.length ?? 0) + (payload?.molotovs?.length ?? 0)})
                  </button>
                  <button
                    onClick={() => setActiveTab("raw")}
                    className={`px-3 py-1 rounded-lg text-xs font-mono transition-all font-bold ${
                      activeTab === "raw"
                        ? "bg-[#141b30] text-white border border-white/[0.15] shadow-sm"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    RAW JSON
                  </button>
                  <button
                    onClick={() => setActiveTab("api")}
                    className={`px-3 py-1 rounded-lg text-xs font-mono transition-all font-bold ${
                      activeTab === "api"
                        ? "bg-[#141b30] text-white border border-white/[0.15] shadow-sm"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    API / SPEC
                  </button>
                  <button
                    onClick={() => setActiveTab("shortcuts")}
                    className={`px-3 py-1 rounded-lg text-xs font-mono transition-all font-bold ${
                      activeTab === "shortcuts"
                        ? "bg-[#141b30] text-white border border-white/[0.15] shadow-sm"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    SHORTCUTS
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2 font-mono text-xs">
                {activeTab === "players" && (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/[0.08] text-slate-400 text-[11px]">
                        <th className="pb-1.5 px-2">STEAMID</th>
                        <th className="pb-1.5 px-2">NAME</th>
                        <th className="pb-1.5 px-2">TEAM</th>
                        <th className="pb-1.5 px-2">HP</th>
                        <th className="pb-1.5 px-2">ARMOR</th>
                        <th className="pb-1.5 px-2">POSITION (X, Y, Z)</th>
                        <th className="pb-1.5 px-2">YAW</th>
                        <th className="pb-1.5 px-2">STATE</th>
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
                                  ? "bg-amber-500/[0.12] border-amber-500/30"
                                  : "hover:bg-white/[0.04]"
                              }`}
                            >
                              <td className="py-1.5 px-2 text-slate-500 text-[10px]">
                                {p.id}
                              </td>
                              <td className="py-1.5 px-2 font-bold text-white flex items-center gap-1.5">
                                {p.hasBomb && (
                                  <span className="text-[10px] px-1 bg-red-500/20 text-red-300 rounded border border-red-500/40 font-black" title="Carrying C4 Bomb">
                                    💣 C4
                                  </span>
                                )}
                                <span>{p.name}</span>
                                {isFocused && (
                                  <span className="text-[9px] px-1 bg-amber-500/20 text-amber-300 rounded border border-amber-500/30 font-bold">
                                    FOCUSED
                                  </span>
                                )}
                              </td>
                              <td className="py-1.5 px-2">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                                    p.team === "T"
                                      ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                                      : "bg-sky-500/20 text-sky-400 border border-sky-500/30"
                                  }`}
                                >
                                  {p.team}
                                </span>
                              </td>
                              <td className="py-1.5 px-2 font-bold">
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
                              <td className="py-1.5 px-2 text-cyan-400 font-bold">
                                {p.armor}
                              </td>
                              <td className="py-1.5 px-2 text-slate-300 text-[11px]">
                                ({p.x.toFixed(1)}, {p.y.toFixed(1)},{" "}
                                {p.z.toFixed(1)})
                              </td>
                              <td className="py-1.5 px-2 text-slate-300">
                                {p.yaw.toFixed(1)}°
                              </td>
                              <td className="py-1.5 px-2">
                                {p.isAlive ? (
                                  <span className="text-emerald-400 font-black text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                                    ALIVE
                                  </span>
                                ) : (
                                  <span className="text-rose-500 font-black text-[10px] px-1.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/20">
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
                            className="py-8 text-center text-slate-500 font-mono"
                          >
                            Niciun jucător înregistrat în acest moment.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}

                {activeTab === "utils" && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-1">
                    {/* Active Smokes Card */}
                    <div className="bg-[#0e1424] border border-white/[0.06] rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between border-b border-white/[0.06] pb-1.5">
                        <span className="text-slate-300 font-bold flex items-center gap-1.5">
                          <span>💨 ACTIVE SMOKES</span>
                        </span>
                        <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">
                          {payload?.smokes?.length ?? 0}
                        </span>
                      </div>
                      <div className="space-y-1.5 max-h-28 overflow-y-auto">
                        {payload?.smokes && payload.smokes.length > 0 ? (
                          payload.smokes.map((s, idx) => (
                            <div
                              key={s.id || idx}
                              className="flex items-center justify-between text-[11px] bg-[#07090e] p-1.5 rounded border border-white/[0.04]"
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
                    <div className="bg-[#0e1424] border border-white/[0.06] rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between border-b border-white/[0.06] pb-1.5">
                        <span className="text-amber-300 font-bold flex items-center gap-1.5">
                          <span>🔥 ACTIVE MOLOTOVS</span>
                        </span>
                        <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">
                          {payload?.molotovs?.length ?? 0}
                        </span>
                      </div>
                      <div className="space-y-1.5 max-h-28 overflow-y-auto">
                        {payload?.molotovs && payload.molotovs.length > 0 ? (
                          payload.molotovs.map((m, idx) => (
                            <div
                              key={m.id || idx}
                              className="flex items-center justify-between text-[11px] bg-[#07090e] p-1.5 rounded border border-amber-500/20"
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
                    <div className="bg-[#0e1424] border border-white/[0.06] rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between border-b border-white/[0.06] pb-1.5">
                        <span className="text-sky-300 font-bold flex items-center gap-1.5">
                          <span>🔫 DROPPED GUNS</span>
                        </span>
                        <span className="text-[10px] bg-sky-500/20 text-sky-300 px-1.5 py-0.5 rounded">
                          {payload?.guns?.length ?? 0}
                        </span>
                      </div>
                      <div className="space-y-1.5 max-h-28 overflow-y-auto">
                        {payload?.guns && payload.guns.length > 0 ? (
                          payload.guns.map((g, idx) => (
                            <div
                              key={g.id || idx}
                              className="flex items-center justify-between text-[11px] bg-[#07090e] p-1.5 rounded border border-sky-500/20"
                            >
                              <span className="text-sky-300 font-bold">{g.name}</span>
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
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-[11px]">
                        Last Payload: {lastPacketTime}
                      </span>
                      <button
                        onClick={() =>
                          copyToClipboard(JSON.stringify(payload, null, 2))
                        }
                        className="px-2.5 py-1 bg-[#141b30] hover:bg-[#1a233d] border border-white/[0.1] rounded-lg text-slate-200 text-xs font-bold transition-all"
                      >
                        {copiedToast ? "COPIED!" : "COPY JSON"}
                      </button>
                    </div>
                    <pre className="text-emerald-400 bg-[#07090e] p-3 rounded-xl border border-white/[0.06] overflow-x-auto whitespace-pre-wrap">
                      {payload
                        ? JSON.stringify(payload, null, 2)
                        : "// Așteptare date de la executor..."}
                    </pre>
                  </div>
                )}

                {activeTab === "api" && (
                  <div className="space-y-3 text-xs">
                    {/* WebSocket Spec */}
                    <div className="p-3 bg-[#0e1424] rounded-xl border border-white/[0.08] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-amber-300 font-bold flex items-center gap-1.5">
                          <span>⚡ Mod WebSocket (Default):</span>
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
                              }/api/radar/ws`
                            )
                          }
                          className="px-2 py-0.5 bg-[#1a233d] border border-white/[0.1] rounded text-[11px] text-slate-200 font-bold"
                        >
                          COPY WS URL
                        </button>
                      </div>
                      <div className="bg-[#07090e] p-2 rounded-lg text-sky-300 font-mono select-all">
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
                    <div className="p-3 bg-[#0e1424] rounded-xl border border-white/[0.08] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sky-300 font-bold flex items-center gap-1.5">
                          <span>🌐 Mod HTTP POST (Format Nou cu Guns & Utils):</span>
                        </span>
                        <button
                          onClick={() =>
                            copyToClipboard(
                              `curl -X POST ${
                                typeof window !== "undefined"
                                  ? window.location.origin
                                  : "http://localhost:3000"
                              }/api/radar -H "Content-Type: application/json" -d '{"map":"${selectedMap}","players":[{"steamid":"76561198000000000","name":"Player1","team":"CT","health":100,"armor":100,"alive":true,"pos":{"x":-1420.5,"y":623.1,"z":-120.0},"yaw":88.5}],"bomb":{"pos":{"x":240.2,"y":-1100.8,"z":-64.0}},"optional":{"utils":{"smokes":[{"pos":{"x":-1200.5,"y":450.2,"z":-118.0}}],"molotovs":[{"pos":{"x":-1350.0,"y":510.0,"z":-120.0}}]},"gun":[{"id":"AK-47","pos":{"x":240.2,"y":-1100.8,"z":-64.0}}]}}'`
                            )
                          }
                          className="px-2 py-0.5 bg-[#1a233d] border border-white/[0.1] rounded text-[11px] text-slate-200 font-bold"
                        >
                          COPY CURL
                        </button>
                      </div>
                      <pre className="text-emerald-300 bg-[#07090e] p-2.5 rounded-lg border border-white/[0.06] overflow-x-auto whitespace-pre-wrap select-all font-mono">
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
    },
    {
      "steamid": "76561198000000001",
      "name": "Player2",
      "team": "T",
      "health": 65,
      "armor": 0,
      "alive": true,
      "pos": { "x": 240.2, "y": -1100.8, "z": -64.0 },
      "yaw": 270.0
    }
  ],
  "bomb": {
    "pos": { "x": 240.2, "y": -1100.8, "z": -64.0 }
  },
  "optional": {
    "utils": {
      "smokes": [
        { "pos": { "x": -1200.5, "y": 450.2, "z": -118.0 } }
      ],
      "molotovs": [
        { "pos": { "x": -1350.0, "y": 510.0, "z": -120.0 } }
      ]
    },
    "gun": [
      {
        "id": "AK-47",
        "pos": { "x": 240.2, "y": -1100.8, "z": -64.0 }
      },
      {
        "id": "AWP",
        "pos": { "x": 242.2, "y": -1105.8, "z": -63.0 }
      }
    ]
  }
}'`}
                      </pre>
                    </div>
                  </div>
                )}

                {activeTab === "shortcuts" && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-1">
                    <div className="bg-[#0e1424] border border-white/[0.06] rounded-xl p-2.5 flex items-center justify-between">
                      <span className="text-slate-300">Fullscreen Toggle</span>
                      <kbd className="px-2 py-1 bg-slate-800 rounded border border-slate-700 text-amber-400 font-bold">
                        F
                      </kbd>
                    </div>
                    <div className="bg-[#0e1424] border border-white/[0.06] rounded-xl p-2.5 flex items-center justify-between">
                      <span className="text-slate-300">Demo Simulator</span>
                      <kbd className="px-2 py-1 bg-slate-800 rounded border border-slate-700 text-amber-400 font-bold">
                        D
                      </kbd>
                    </div>
                    <div className="bg-[#0e1424] border border-white/[0.06] rounded-xl p-2.5 flex items-center justify-between">
                      <span className="text-slate-300">Player Names</span>
                      <kbd className="px-2 py-1 bg-slate-800 rounded border border-slate-700 text-amber-400 font-bold">
                        N
                      </kbd>
                    </div>
                    <div className="bg-[#0e1424] border border-white/[0.06] rounded-xl p-2.5 flex items-center justify-between">
                      <span className="text-slate-300">Vision FOV Cones</span>
                      <kbd className="px-2 py-1 bg-slate-800 rounded border border-slate-700 text-amber-400 font-bold">
                        V
                      </kbd>
                    </div>
                    <div className="bg-[#0e1424] border border-white/[0.06] rounded-xl p-2.5 flex items-center justify-between">
                      <span className="text-slate-300">Toggle Smokes</span>
                      <kbd className="px-2 py-1 bg-slate-800 rounded border border-slate-700 text-amber-400 font-bold">
                        S
                      </kbd>
                    </div>
                    <div className="bg-[#0e1424] border border-white/[0.06] rounded-xl p-2.5 flex items-center justify-between">
                      <span className="text-slate-300">Toggle Molotovs</span>
                      <kbd className="px-2 py-1 bg-slate-800 rounded border border-slate-700 text-amber-400 font-bold">
                        K
                      </kbd>
                    </div>
                    <div className="bg-[#0e1424] border border-white/[0.06] rounded-xl p-2.5 flex items-center justify-between">
                      <span className="text-slate-300">Toggle Dropped Guns</span>
                      <kbd className="px-2 py-1 bg-slate-800 rounded border border-slate-700 text-amber-400 font-bold">
                        U
                      </kbd>
                    </div>
                    <div className="bg-[#0e1424] border border-white/[0.06] rounded-xl p-2.5 flex items-center justify-between">
                      <span className="text-slate-300">Tactical Reticle</span>
                      <kbd className="px-2 py-1 bg-slate-800 rounded border border-slate-700 text-amber-400 font-bold">
                        G
                      </kbd>
                    </div>
                    <div className="bg-[#0e1424] border border-white/[0.06] rounded-xl p-2.5 flex items-center justify-between">
                      <span className="text-slate-300">Toggle Audio</span>
                      <kbd className="px-2 py-1 bg-slate-800 rounded border border-slate-700 text-amber-400 font-bold">
                        M
                      </kbd>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
