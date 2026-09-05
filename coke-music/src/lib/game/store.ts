import { create } from "zustand";
import { CATALOG_MAP, DEFAULT_APPEARANCE, ROOM_MAP } from "./data";
import type { Appearance, ChatLine, Mix, Overlay, PlacedItem, Screen } from "./types";
import { bindWorld, enterRoom, placeAt, setPlayerLook, studioFurniture } from "./world";
import { startLounge, unlockAudio } from "./audio";

const KEY = "coke-music-v1";
const VERSION = 1;

const APPEARANCE_FIELDS: (keyof Appearance)[] = [
  "skin",
  "hair",
  "hairColor",
  "top",
  "topColor",
  "bottom",
  "bottomColor",
  "shoeColor",
  "accessory",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAppearance(value: unknown): value is Appearance {
  return isRecord(value) && APPEARANCE_FIELDS.every((field) => Number.isInteger(value[field]));
}

function isPlacedItem(value: unknown): value is PlacedItem {
  return isRecord(value)
    && typeof value.id === "string"
    && typeof value.catalogId === "string"
    && Boolean(CATALOG_MAP[value.catalogId])
    && Number.isInteger(value.x)
    && Number.isInteger(value.y);
}

function isMix(value: unknown): value is Mix {
  return isRecord(value)
    && typeof value.id === "string"
    && typeof value.name === "string"
    && typeof value.genre === "string"
    && Number.isFinite(value.createdAt)
    && Array.isArray(value.clips)
    && value.clips.length === 4
    && value.clips.every((clip) => clip === null || typeof clip === "string");
}

interface Save {
  version: number;
  name: string;
  appearance: Appearance;
  db: number;
  inventory: Record<string, number>;
  discs: Mix[];
  studio: PlacedItem[];
  lastRoom: string;
  seenHelp: boolean;
}

function isSave(value: unknown): value is Save {
  if (!isRecord(value) || value.version !== VERSION) return false;
  if (typeof value.name !== "string" || value.name.length > 16) return false;
  if (!isAppearance(value.appearance)) return false;
  if (!Number.isFinite(value.db) || Number(value.db) < 0) return false;
  if (!isRecord(value.inventory)) return false;
  if (!Object.values(value.inventory).every((count) => Number.isInteger(count) && Number(count) >= 0)) return false;
  if (!Array.isArray(value.discs) || !value.discs.every(isMix)) return false;
  if (!Array.isArray(value.studio) || !value.studio.every(isPlacedItem)) return false;
  if (typeof value.lastRoom !== "string" || !ROOM_MAP[value.lastRoom]) return false;
  return typeof value.seenHelp === "boolean";
}

interface GameState {
  hydrated: boolean;
  hasSave: boolean;
  screen: Screen;
  overlay: Overlay;
  name: string;
  appearance: Appearance;
  db: number;
  inventory: Record<string, number>;
  discs: Mix[];
  studio: PlacedItem[];
  lastRoom: string;
  seenHelp: boolean;
  chat: ChatLine[];
  toast: string | null;
  placing: string | null;
  muted: boolean;
  hydrate: () => void;
  persist: () => void;
  setScreen: (s: Screen) => void;
  setOverlay: (o: Overlay) => void;
  setName: (n: string) => void;
  setAppearance: (a: Appearance | ((p: Appearance) => Appearance)) => void;
  addDb: (n: number) => void;
  buy: (id: string, price: number) => boolean;
  grantItem: (id: string) => void;
  spendItem: (id: string) => boolean;
  placeOwnedItem: (id: string, x: number, y: number) => boolean;
  addDisc: (m: Mix) => void;
  setPlacing: (id: string | null) => void;
  setStudio: (f: PlacedItem[]) => void;
  pushChat: (name: string, text: string, self?: boolean) => void;
  setToast: (t: string | null) => void;
  setMuted: (m: boolean) => void;
  enter: (roomId?: string) => void;
  reset: () => void;
}

const empty: Pick<
  GameState,
  | "name"
  | "appearance"
  | "db"
  | "inventory"
  | "discs"
  | "studio"
  | "lastRoom"
  | "seenHelp"
> = {
  name: "",
  appearance: { ...DEFAULT_APPEARANCE },
  db: 160,
  inventory: { chair: 1, plant: 1 },
  discs: [],
  studio: [
    { id: "start-plant", catalogId: "plant", x: 1, y: 1 },
    { id: "start-lamp", catalogId: "lamp", x: 8, y: 1 },
  ],
  lastRoom: "red-room",
  seenHelp: false,
};

function load(): Save | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s: unknown = JSON.parse(raw);
    if (!isSave(s)) return null;
    return s;
  } catch {
    return null;
  }
}

export const useGame = create<GameState>((set, get) => ({
  hydrated: false,
  hasSave: false,
  screen: "splash",
  overlay: null,
  ...empty,
  chat: [],
  toast: null,
  placing: null,
  muted: false,
  hydrate: () => {
    const s = load();
    bindWorld({
      onDb: (n) => get().addDb(n),
      onChat: (name, text, self) => get().pushChat(name, text, self),
      onToast: (t) => get().setToast(t),
    });
    if (s) {
      set({
        hydrated: true,
        hasSave: true,
        name: s.name,
        appearance: s.appearance,
        db: s.db,
        inventory: s.inventory,
        discs: s.discs,
        studio: s.studio,
        lastRoom: s.lastRoom,
        seenHelp: s.seenHelp,
      });
      setPlayerLook(s.appearance, s.name);
    } else {
      set({ hydrated: true, hasSave: false });
    }
  },
  persist: () => {
    const s = get();
    const payload: Save = {
      version: VERSION,
      name: s.name,
      appearance: s.appearance,
      db: s.db,
      inventory: s.inventory,
      discs: s.discs,
      studio: s.studio,
      lastRoom: s.lastRoom,
      seenHelp: s.seenHelp,
    };
    try {
      localStorage.setItem(KEY, JSON.stringify(payload));
    } catch {
      /* private mode */
    }
  },
  setScreen: (screen) => set({ screen }),
  setOverlay: (overlay) => set({ overlay, placing: overlay === "catalog" ? get().placing : null }),
  setName: (name) => set({ name }),
  setAppearance: (a) => {
    const appearance = typeof a === "function" ? a(get().appearance) : a;
    set({ appearance });
    setPlayerLook(appearance, get().name);
  },
  addDb: (n) => {
    set({ db: Math.max(0, get().db + n) });
    get().persist();
  },
  buy: (id, price) => {
    const s = get();
    if (s.db < price) return false;
    set({
      db: s.db - price,
      inventory: { ...s.inventory, [id]: (s.inventory[id] ?? 0) + 1 },
    });
    get().persist();
    return true;
  },
  grantItem: (id) => {
    const s = get();
    set({ inventory: { ...s.inventory, [id]: (s.inventory[id] ?? 0) + 1 } });
    get().persist();
  },
  spendItem: (id) => {
    const s = get();
    const n = s.inventory[id] ?? 0;
    if (n <= 0) return false;
    const next = { ...s.inventory, [id]: n - 1 };
    set({ inventory: next });
    get().persist();
    return true;
  },
  placeOwnedItem: (id, x, y) => {
    const s = get();
    const count = s.inventory[id] ?? 0;
    if (count <= 0 || !placeAt(id, x, y)) return false;
    set({
      inventory: { ...s.inventory, [id]: count - 1 },
      studio: [...studioFurniture()],
      placing: count === 1 ? null : s.placing,
    });
    get().persist();
    return true;
  },
  addDisc: (m) => {
    set({ discs: [m, ...get().discs].slice(0, 12) });
    get().persist();
  },
  setPlacing: (placing) => set({ placing, overlay: placing ? null : get().overlay }),
  setStudio: (studio) => {
    set({ studio });
    get().persist();
  },
  pushChat: (name, text, self) =>
    set({
      chat: [...get().chat, { id: `${Date.now()}-${Math.random()}`, name, text, self }].slice(-40),
    }),
  setToast: (toast) => {
    set({ toast });
    if (toast) window.setTimeout(() => {
      if (get().toast === toast) set({ toast: null });
    }, 2200);
  },
  setMuted: (muted) => set({ muted }),
  enter: (roomId) => {
    const s = get();
    const id = roomId ?? s.lastRoom ?? "red-room";
    setPlayerLook(s.appearance, s.name || "V-Ego");
    enterRoom(id, id === "studio" ? s.studio : undefined);
    unlockAudio();
    startLounge();
    set({
      screen: "world",
      overlay: s.seenHelp ? null : "help",
      lastRoom: id,
      seenHelp: true,
      placing: null,
    });
    get().persist();
  },
  reset: () => {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    set({
      ...empty,
      hasSave: false,
      screen: "create",
      overlay: null,
      chat: [],
      appearance: { ...DEFAULT_APPEARANCE },
    });
  },
}));

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      const s = useGame.getState();
      if (s.screen === "world") {
        s.setStudio(studioFurniture().length ? studioFurniture() : s.studio);
        s.persist();
      }
    }
  });
}
