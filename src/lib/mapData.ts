export interface MapInfo {
  id: string;
  name: string;
  displayName: string;
  image?: string;
  pos_x: number;
  pos_y: number;
  scale: number;
  zMid: number;
  accent: string;
  tag: string;
}

export const MAPS: MapInfo[] = [
  {
    id: "de_dust2",
    name: "de_dust2",
    displayName: "Dust II",
    image: "/radare/Cs2_dust2_overview.webp",
    pos_x: -2476,
    pos_y: 3239,
    scale: 4.4,
    zMid: 96,
    accent: "#f59e0b",
    tag: "Active Duty",
  },
  {
    id: "de_mirage",
    name: "de_mirage",
    displayName: "Mirage",
    image: "/radare/Cs2_mirage_radar.webp",
    pos_x: -3230,
    pos_y: 1713,
    scale: 5.0,
    zMid: 128,
    accent: "#eab308",
    tag: "Active Duty",
  },
  {
    id: "de_inferno",
    name: "de_inferno",
    displayName: "Inferno",
    image: "/radare/CS2_inferno_radar.webp",
    pos_x: -2087,
    pos_y: 3870,
    scale: 4.9,
    zMid: 128,
    accent: "#f97316",
    tag: "Active Duty",
  },
  {
    id: "de_nuke",
    name: "de_nuke",
    displayName: "Nuke",
    image: "/radare/Cs2_nuke_radar.webp",
    pos_x: -3453,
    pos_y: 2887,
    scale: 7.0,
    zMid: 300,
    accent: "#06b6d4",
    tag: "Active Duty",
  },
  {
    id: "de_ancient",
    name: "de_ancient",
    displayName: "Ancient",
    image: "/radare/Ancient_Radar.webp",
    pos_x: -2953,
    pos_y: 2164,
    scale: 4.5,
    zMid: 128,
    accent: "#a855f7",
    tag: "Active Duty",
  },
  {
    id: "de_anubis",
    name: "de_anubis",
    displayName: "Anubis",
    image: "/radare/De_anubis_radar_cs2.webp",
    pos_x: -2796,
    pos_y: 2610,
    scale: 5.22,
    zMid: 96,
    accent: "#ef4444",
    tag: "Active Duty",
  },
  {
    id: "de_train",
    name: "de_train",
    displayName: "Train",
    image: "/radare/CS2_Train_radar.webp",
    pos_x: -2487,
    pos_y: 2392,
    scale: 4.7,
    zMid: 100,
    accent: "#64748b",
    tag: "Active Duty",
  },
  {
    id: "de_overpass",
    name: "de_overpass",
    displayName: "Overpass",
    image: "/radare/Cs2_overpass_radar.webp",
    pos_x: -4831,
    pos_y: 1781,
    scale: 5.2,
    zMid: 200,
    accent: "#10b981",
    tag: "Reserve",
  },
  {
    id: "de_vertigo",
    name: "de_vertigo",
    displayName: "Vertigo",
    image: "/radare/De_vertigo_radar.webp",
    pos_x: -3168,
    pos_y: 1762,
    scale: 4.0,
    zMid: 11700,
    accent: "#3b82f6",
    tag: "Reserve",
  },
  {
    id: "cs_office",
    name: "cs_office",
    displayName: "Office",
    image: "/radare/Cs2_office_radar.webp",
    pos_x: -1838,
    pos_y: 1858,
    scale: 4.1,
    zMid: -64,
    accent: "#60a5fa",
    tag: "Hostage",
  },
];

export const DEFAULT_MAP = MAPS[0];

export function getMapInfo(mapId: string): MapInfo {
  return MAPS.find((m) => m.id === mapId) ?? DEFAULT_MAP;
}

export function worldToFraction(
  x: number,
  y: number,
  map: MapInfo
): { fx: number; fy: number } {
  const span = map.scale * 1024;
  const fx = (x - map.pos_x) / span;
  const fy = (map.pos_y - y) / span;
  return {
    fx: Math.max(0, Math.min(1, fx)),
    fy: Math.max(0, Math.min(1, fy)),
  };
}
