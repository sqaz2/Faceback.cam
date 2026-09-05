import type { Appearance, CatalogItem, RoomDef } from "./types";

export interface CatalogSection {
  id: string;
  label: string;
  blurb?: string;
}

export const SKINS = ["#F7D3B0", "#E8B889", "#C4844A", "#8D5524", "#5A3216", "#FBE4D4"];
export const HAIR_COLORS = ["#1A1210", "#3B2218", "#6B3A1F", "#C45A22", "#D4B483", "#E61A27", "#1F3A5F", "#F4E8DC"];
export const CLOTH_COLORS = [
  "#E61A27",
  "#F4E8DC",
  "#1A0A0C",
  "#2C5F8A",
  "#1F6B4A",
  "#C5B9B4",
  "#F2D27A",
  "#4A1D24",
  "#FFFFFF",
  "#6E0A12",
];
export const HAIR_STYLES = ["Crop", "Spikes", "Flow", "Halo", "Tail", "Bangs"];
export const TOP_STYLES = ["Tee", "Tank", "Hoodie", "Jacket"];
export const BOTTOM_STYLES = ["Pants", "Shorts", "Skirt"];
export const SHOE_STYLES = ["Sneakers", "Boots", "High-tops"];
export const ACCESSORIES = ["None", "Shades", "Headphones", "Cap"];
export const BODY_STYLES = ["Man", "Woman"];

export const DEFAULT_APPEARANCE: Appearance = {
  body: 0,
  skin: 0,
  hair: 1,
  hairColor: 0,
  top: 0,
  topColor: 0,
  bottom: 0,
  bottomColor: 2,
  shoe: 0,
  shoeColor: 2,
  accessory: 0,
};

export const CATALOG_SECTIONS: CatalogSection[] = [
  { id: "seating", label: "Seating", blurb: "Sofas, chairs, stools" },
  { id: "tables", label: "Tables & surfaces", blurb: "Cafe tables and tops" },
  { id: "lighting", label: "Lighting", blurb: "Lamps and glow" },
  { id: "decor", label: "Home decor & plants", blurb: "Greenery and accents" },
  { id: "floor", label: "Rugs & flooring", blurb: "Soft underfoot" },
  { id: "kitchen", label: "Kitchen & drinks", blurb: "Fridges, crates, cola" },
  { id: "audio", label: "Audio & entertainment", blurb: "Speakers, screens, jukebox" },
  { id: "stage", label: "Stage & performance", blurb: "Mic, stage, disco" },
];

export const CATALOG: CatalogItem[] = [
  { id: "sofa", name: "Velvet Sofa", price: 90, w: 2, d: 1, section: "seating", rotate: "90", sit: true, seats: 2, sitY: 0.1, sitLift: 20, sitSpread: 0.95, sprite: "sofa", desc: "Two-seat red velvet — sit next to someone." },
  { id: "chair", name: "Lounge Chair", price: 40, w: 1, d: 1, section: "seating", rotate: "90", sit: true, seats: 1, sitY: 0.08, sitLift: 16, sprite: "chair", desc: "A single plush seat." },
  { id: "booth", name: "Diner Booth", price: 100, w: 2, d: 1, section: "seating", rotate: "90", sit: true, seats: 2, sitY: 0.1, sitLift: 8, sitSpread: 0.9, sprite: "booth", desc: "Corner booth — room for two." },
  { id: "stool", name: "Bar Stool", price: 20, w: 1, d: 1, section: "seating", rotate: "360", sit: true, seats: 1, sitY: 0.1, sitLift: 14, sprite: "stool", desc: "Perch and people-watch." },
  { id: "bean", name: "Bean Bag", price: 30, w: 1, d: 1, section: "seating", rotate: "360", sit: true, seats: 1, sitY: 0.22, sitLift: -2, sprite: "bean", desc: "Low, slouchy, forever." },
  { id: "table", name: "Cafe Table", price: 35, w: 1, d: 1, section: "tables", rotate: "360", sprite: "table", desc: "Round cream tabletop." },
  { id: "lamp", name: "Floor Lamp", price: 28, w: 1, d: 1, section: "lighting", rotate: "360", sprite: "lamp", desc: "Warm pool of light." },
  { id: "plant", name: "Palm Plant", price: 22, w: 1, d: 1, section: "decor", rotate: "360", sprite: "plant", desc: "A little tropical energy." },
  { id: "rug", name: "Studio Rug", price: 24, w: 2, d: 2, section: "floor", rotate: "90", floor: true, desc: "Softens the diamond floor." },
  { id: "fridge", name: "Mini Fridge", price: 70, w: 1, d: 1, section: "kitchen", rotate: "90", drink: true, sprite: "fridge", desc: "Always stocked. Somehow." },
  { id: "vending", name: "Cola Machine", price: 120, w: 1, d: 1, section: "kitchen", rotate: "90", drink: true, sprite: "vending", desc: "Ice-cold. Earns decibels." },
  { id: "crate", name: "Bottle Crate", price: 18, w: 1, d: 1, section: "kitchen", rotate: "360", drink: true, sprite: "crate", desc: "Grab a classic." },
  { id: "speaker", name: "Club Speaker", price: 55, w: 1, d: 1, section: "audio", rotate: "90", sprite: "speaker", desc: "Moves air. And furniture." },
  { id: "tv", name: "Lounge TV", price: 65, w: 1, d: 1, section: "audio", rotate: "90", sprite: "tv", desc: "Music videos, probably." },
  { id: "jukebox", name: "Room Player", price: 150, w: 1, d: 1, section: "audio", rotate: "90", music: true, sprite: "jukebox", desc: "Send a published mix to the room." },
  { id: "disco", name: "Disco Ball", price: 80, w: 1, d: 1, section: "stage", rotate: "360", hang: true, block: false, sprite: "disco", desc: "Every room needs one." },
  { id: "stage", name: "Stage Block", price: 160, w: 2, d: 2, section: "stage", rotate: "90", stage: true, block: false, sprite: "stage", desc: "Perform your mix." },
  { id: "mic", name: "Mic Stand", price: 45, w: 1, d: 1, section: "stage", rotate: "90", stage: true, sprite: "mic", desc: "Tap to perform." },
];

export const CATALOG_MAP = Object.fromEntries(CATALOG.map((c) => [c.id, c]));

/** Group catalogue items by CATALOG_SECTIONS order (empty sections omitted). */
export function catalogBySection(): { section: CatalogSection; items: CatalogItem[] }[] {
  return CATALOG_SECTIONS.map((section) => ({
    section,
    items: CATALOG.filter((c) => c.section === section.id),
  })).filter((g) => g.items.length > 0);
}

export const ROOMS: RoomDef[] = [
  {
    id: "red-room",
    name: "Red Room",
    city: "HQ",
    blurb: "Flagship lounge. Double decibels on cola and stage votes.",
    w: 12,
    h: 12,
    floor: "carpet",
    wall: "red",
    doubleDb: true,
    hasStage: true,
    furniture: [
      { catalogId: "stage", x: 5, y: 1 },
      { catalogId: "mic", x: 6, y: 2 },
      { catalogId: "speaker", x: 4, y: 1 },
      { catalogId: "speaker", x: 7, y: 1 },
      { catalogId: "disco", x: 6, y: 4 },
      { catalogId: "vending", x: 1, y: 2 },
      { catalogId: "crate", x: 1, y: 3 },
      { catalogId: "jukebox", x: 10, y: 2 },
      { catalogId: "sofa", x: 8, y: 8 },
      { catalogId: "chair", x: 3, y: 8 },
      { catalogId: "chair", x: 5, y: 8 },
      { catalogId: "table", x: 4, y: 8 },
      { catalogId: "plant", x: 1, y: 10 },
      { catalogId: "plant", x: 11, y: 5 },
      { catalogId: "lamp", x: 10, y: 6 },
      { catalogId: "rug", x: 4, y: 6 },
      { catalogId: "stool", x: 9, y: 4 },
      { catalogId: "stool", x: 8, y: 4 },
    ],
    spawns: [
      { x: 2, y: 6 },
      { x: 9, y: 6 },
      { x: 6, y: 9 },
      { x: 3, y: 4 },
      { x: 8, y: 10 },
      { x: 4, y: 10 },
    ],
  },
  {
    id: "tokyo",
    name: "Tokyo Studio",
    city: "Tokyo",
    blurb: "Lacquer floors, lantern light, late-night mixes.",
    w: 11,
    h: 11,
    floor: "tatami",
    wall: "lacquer",
    doubleDb: false,
    hasStage: true,
    furniture: [
      { catalogId: "stage", x: 4, y: 1 },
      { catalogId: "speaker", x: 3, y: 1 },
      { catalogId: "speaker", x: 6, y: 1 },
      { catalogId: "plant", x: 1, y: 1 },
      { catalogId: "plant", x: 9, y: 1 },
      { catalogId: "lamp", x: 1, y: 4 },
      { catalogId: "lamp", x: 9, y: 4 },
      { catalogId: "table", x: 4, y: 6 },
      { catalogId: "table", x: 6, y: 6 },
      { catalogId: "chair", x: 3, y: 6 },
      { catalogId: "chair", x: 7, y: 6 },
      { catalogId: "bean", x: 2, y: 8 },
      { catalogId: "bean", x: 8, y: 8 },
      { catalogId: "crate", x: 9, y: 8 },
      { catalogId: "jukebox", x: 1, y: 8 },
      { catalogId: "rug", x: 4, y: 5 },
    ],
    spawns: [
      { x: 5, y: 8 },
      { x: 2, y: 5 },
      { x: 8, y: 5 },
      { x: 5, y: 3 },
      { x: 9, y: 9 },
    ],
  },
  {
    id: "london",
    name: "London Lounge",
    city: "London",
    blurb: "Brick, booths, and a jukebox that never sleeps.",
    w: 11,
    h: 10,
    floor: "wood",
    wall: "brick",
    doubleDb: false,
    hasStage: false,
    furniture: [
      { catalogId: "booth", x: 1, y: 2 },
      { catalogId: "booth", x: 1, y: 5 },
      { catalogId: "table", x: 3, y: 2 },
      { catalogId: "table", x: 3, y: 5 },
      { catalogId: "jukebox", x: 9, y: 2 },
      { catalogId: "vending", x: 9, y: 4 },
      { catalogId: "sofa", x: 6, y: 7 },
      { catalogId: "chair", x: 5, y: 7 },
      { catalogId: "plant", x: 9, y: 8 },
      { catalogId: "lamp", x: 5, y: 2 },
      { catalogId: "tv", x: 7, y: 1 },
      { catalogId: "stool", x: 8, y: 6 },
      { catalogId: "rug", x: 6, y: 4 },
    ],
    spawns: [
      { x: 5, y: 4 },
      { x: 8, y: 8 },
      { x: 4, y: 8 },
      { x: 2, y: 7 },
      { x: 6, y: 3 },
    ],
  },
  {
    id: "sf",
    name: "SF Loft",
    city: "San Francisco",
    blurb: "Warehouse windows, big speakers, bigger opinions.",
    w: 12,
    h: 10,
    floor: "loft",
    wall: "cream",
    doubleDb: false,
    hasStage: true,
    furniture: [
      { catalogId: "stage", x: 8, y: 1 },
      { catalogId: "speaker", x: 7, y: 1 },
      { catalogId: "speaker", x: 10, y: 1 },
      { catalogId: "sofa", x: 1, y: 6 },
      { catalogId: "chair", x: 4, y: 6 },
      { catalogId: "table", x: 3, y: 6 },
      { catalogId: "disco", x: 9, y: 4 },
      { catalogId: "plant", x: 1, y: 1 },
      { catalogId: "plant", x: 10, y: 8 },
      { catalogId: "fridge", x: 1, y: 8 },
      { catalogId: "lamp", x: 5, y: 1 },
      { catalogId: "bean", x: 6, y: 8 },
      { catalogId: "rug", x: 2, y: 3 },
      { catalogId: "mic", x: 9, y: 2 },
    ],
    spawns: [
      { x: 5, y: 4 },
      { x: 8, y: 7 },
      { x: 3, y: 8 },
      { x: 6, y: 5 },
      { x: 10, y: 6 },
    ],
  },
  {
    id: "goa",
    name: "Goa Beach Club",
    city: "Goa",
    blurb: "Warm sand under the diamonds. Sunset sets only.",
    w: 12,
    h: 11,
    floor: "sand",
    wall: "stucco",
    doubleDb: false,
    hasStage: true,
    furniture: [
      { catalogId: "stage", x: 5, y: 1 },
      { catalogId: "speaker", x: 4, y: 1 },
      { catalogId: "speaker", x: 7, y: 1 },
      { catalogId: "bean", x: 1, y: 4 },
      { catalogId: "bean", x: 2, y: 6 },
      { catalogId: "bean", x: 9, y: 4 },
      { catalogId: "bean", x: 10, y: 6 },
      { catalogId: "plant", x: 1, y: 1 },
      { catalogId: "plant", x: 10, y: 1 },
      { catalogId: "plant", x: 1, y: 9 },
      { catalogId: "crate", x: 10, y: 9 },
      { catalogId: "disco", x: 6, y: 5 },
      { catalogId: "lamp", x: 3, y: 8 },
      { catalogId: "lamp", x: 8, y: 8 },
      { catalogId: "rug", x: 4, y: 6 },
    ],
    spawns: [
      { x: 6, y: 8 },
      { x: 3, y: 5 },
      { x: 9, y: 8 },
      { x: 4, y: 9 },
      { x: 8, y: 4 },
    ],
  },
  {
    id: "studio",
    name: "My Studio",
    city: "Private",
    blurb: "Your space. Place furniture. Publish mixes. Invite no one — or everyone.",
    w: 10,
    h: 10,
    floor: "tile",
    wall: "cream",
    doubleDb: false,
    hasStage: false,
    private: true,
    furniture: [
      { catalogId: "plant", x: 1, y: 1 },
      { catalogId: "lamp", x: 8, y: 1 },
    ],
    spawns: [{ x: 5, y: 5 }],
  },
];

export const ROOM_MAP = Object.fromEntries(ROOMS.map((r) => [r.id, r]));

export const NPC_NAMES = [
  "Rio",
  "Nia",
  "Jules",
  "Kato",
  "Mira",
  "Dex",
  "Sol",
  "Vee",
  "Andi",
  "Pax",
  "Luna",
  "Cruz",
];

export const CHAT_LINES = [
  "this mix is actually good",
  "anyone heading to Tokyo?",
  "need more decibels",
  "new sofa in the catalog",
  "Red Room hits different",
  "who published that mix",
  "dance floor is open",
  "grab a cola first",
  "stage is free — go",
  "love this lounge",
  "remember the old mixer?",
  "one more track",
];

export const REPLIES = [
  "facts",
  "on my way",
  "publish one and queue it",
  "see you there",
  "already dancing",
  "same",
];

export const GENRES = [
  { id: "pop", name: "Pop", bpm: 118 },
  { id: "hiphop", name: "Hip-Hop", bpm: 92 },
  { id: "disco", name: "Disco", bpm: 122 },
  { id: "rock", name: "Rock", bpm: 128 },
  { id: "latin", name: "Latin", bpm: 110 },
  { id: "chill", name: "Chill", bpm: 88 },
] as const;

export const CLIPS = {
  drums: [
    { id: "boom", name: "Boom" },
    { id: "skip", name: "Skip" },
    { id: "four", name: "Four" },
    { id: "break", name: "Break" },
    { id: "clap", name: "Clap" },
  ],
  bass: [
    { id: "funk", name: "Funk" },
    { id: "deep", name: "Deep" },
    { id: "root", name: "Root" },
    { id: "walk", name: "Walk" },
    { id: "pulse", name: "Pulse" },
  ],
  melody: [
    { id: "keys", name: "Keys" },
    { id: "synth", name: "Synth" },
    { id: "bells", name: "Bells" },
    { id: "pluck", name: "Pluck" },
    { id: "lead", name: "Lead" },
  ],
  vox: [
    { id: "ahhs", name: "Ahhs" },
    { id: "hook", name: "Hook" },
    { id: "stabs", name: "Stabs" },
    { id: "shimmer", name: "Shimmer" },
    { id: "call", name: "Call" },
  ],
} as const;

export const TRACKS = ["drums", "bass", "melody", "vox"] as const;

export function randomAppearance(seed = Math.random()): Appearance {
  const r = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  return {
    body: Math.floor(r() * BODY_STYLES.length),
    skin: Math.floor(r() * SKINS.length),
    hair: Math.floor(r() * HAIR_STYLES.length),
    hairColor: Math.floor(r() * HAIR_COLORS.length),
    top: Math.floor(r() * TOP_STYLES.length),
    topColor: Math.floor(r() * CLOTH_COLORS.length),
    bottom: Math.floor(r() * BOTTOM_STYLES.length),
    bottomColor: Math.floor(r() * CLOTH_COLORS.length),
    shoe: Math.floor(r() * SHOE_STYLES.length),
    shoeColor: Math.floor(r() * CLOTH_COLORS.length),
    accessory: Math.floor(r() * ACCESSORIES.length),
  };
}

export const SPRITE_URLS: Record<string, string> = {
  sofa: "/art/furniture/sofa.png?v=6",
  chair: "/art/furniture/chair.png?v=6",
  plant: "/art/furniture/plant.png?v=6",
  speaker: "/art/furniture/speaker.png?v=6",
  vending: "/art/furniture/vending.png?v=6",
  jukebox: "/art/furniture/jukebox.png?v=6",
  disco: "/art/furniture/disco.png?v=6",
  crate: "/art/furniture/crate.png?v=6",
  table: "/art/furniture/table.png?v=6",
  lamp: "/art/furniture/lamp.png?v=6",
  bean: "/art/furniture/bean.png?v=6",
  fridge: "/art/furniture/fridge.png?v=6",
  stool: "/art/furniture/stool.png?v=6",
  mic: "/art/furniture/mic.png?v=6",
  booth: "/art/furniture/booth.png?v=6",
  stage: "/art/furniture/stage.png?v=6",
  tv: "/art/furniture/tv.png?v=6",
};

export const AVATAR_URLS: Record<string, Record<string, string>> = {
  man: {
    idle: "/art/avatar/generated/base/man/idle.png?v=9",
    walk: "/art/avatar/generated/base/man/walk.png?v=9",
    sit: "/art/avatar/generated/base/man/sit.png?v=9",
    dance: "/art/avatar/generated/base/man/dance.png?v=9",
  },
  woman: {
    idle: "/art/avatar/generated/base/woman/idle.png?v=9",
    walk: "/art/avatar/generated/base/woman/walk.png?v=9",
    sit: "/art/avatar/generated/base/woman/sit.png?v=9",
    dance: "/art/avatar/generated/base/woman/dance.png?v=9",
  },
};
