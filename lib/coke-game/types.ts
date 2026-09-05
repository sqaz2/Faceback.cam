export type Dir = 0 | 1 | 2 | 3;
export type ActorAction = "idle" | "walk" | "dance" | "sit" | "wave" | "drink";
export type Overlay =
  | null
  | "nav"
  | "mixer"
  | "catalog"
  | "wardrobe"
  | "vega"
  | "uncover"
  | "help";
export type Screen = "splash" | "create" | "world";

export interface Appearance {
  /** 0 = man, 1 = woman. Optional keeps older local saves compatible. */
  body?: number;
  skin: number;
  hair: number;
  hairColor: number;
  top: number;
  topColor: number;
  bottom: number;
  bottomColor: number;
  shoeColor: number;
  accessory: number;
}

export interface Actor {
  id: string;
  name: string;
  isPlayer: boolean;
  appearance: Appearance;
  x: number;
  y: number;
  dir: Dir;
  action: ActorAction;
  path: { x: number; y: number }[];
  sitId?: string;
  sitSlot?: number;
  pendingSit?: { id: string; slot: number };
  bubble?: { text: string; until: number };
  nextAi: number;
  walkPhase: number;
  actionT: number;
}

export interface PlacedItem {
  id: string;
  catalogId: string;
  x: number;
  y: number;
}

export interface Mix {
  id: string;
  name: string;
  genre: string;
  clips: [string | null, string | null, string | null, string | null];
  createdAt: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  text?: string;
  size: number;
}

export interface CatalogItem {
  id: string;
  name: string;
  price: number;
  w: number;
  d: number;
  sit?: boolean;
  seats?: number;
  drink?: boolean;
  music?: boolean;
  stage?: boolean;
  floor?: boolean;
  sprite?: string;
  desc: string;
  /** false = walkable (stage, hanging disco). default true unless floor. */
  block?: boolean;
  hang?: boolean;
  /** extra depth added to both x and y so sitters move down-screen without sliding sideways. */
  sitY?: number;
  /** pixels to raise a sitting actor so the butt lands on the cushion. */
  sitLift?: number;
  /** left/right spread in (tx-ty) tile units between the outer seats. */
  sitSpread?: number;
}

export interface RoomDef {
  id: string;
  name: string;
  city: string;
  blurb: string;
  w: number;
  h: number;
  floor: "carpet" | "wood" | "tatami" | "tile" | "sand" | "loft";
  wall: "red" | "cream" | "lacquer" | "brick" | "stucco";
  doubleDb: boolean;
  hasStage: boolean;
  private?: boolean;
  furniture: { catalogId: string; x: number; y: number }[];
  spawns: { x: number; y: number }[];
}

export interface ChatLine {
  id: string;
  name: string;
  text: string;
  self?: boolean;
}
