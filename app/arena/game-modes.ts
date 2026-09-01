export const GAME_MODES = [
  {
    id: "RAP",
    name: "Rap Battle",
    shortName: "Rap",
    kicker: "ONE OR TWO BARS",
    description: "A compact bar battle. Punch hard, land clean, waste nothing.",
    criteria: ["Punch", "Rhythm", "Originality"],
    placeholder: "Drop the bar…",
    maxChars: 220,
  },
  {
    id: "PUNCHLINE",
    name: "Punchline",
    shortName: "Punchline",
    kicker: "SETUP → SNAP",
    description: "One fast joke or turn. The winner gets there cleanest and least predictably.",
    criteria: ["Surprise", "Economy", "Clarity"],
    placeholder: "Land the punchline…",
    maxChars: 200,
  },
  {
    id: "HOOK",
    name: "Hook Lab",
    shortName: "Hook",
    kicker: "MAKE IT STICK",
    description: "Write the smallest line the room will still remember ten minutes later.",
    criteria: ["Memorability", "Rhythm", "Simplicity"],
    placeholder: "Write the hook…",
    maxChars: 140,
  },
  {
    id: "PITCH",
    name: "Creative Pitch",
    shortName: "Pitch",
    kicker: "SELL THE IDEA",
    description: "Invent a project, product or concept and make the room want it immediately.",
    criteria: ["Novelty", "Clarity", "Desire"],
    placeholder: "Pitch it in one tight paragraph…",
    maxChars: 280,
  },
  {
    id: "CAPTION",
    name: "Caption Clash",
    shortName: "Caption",
    kicker: "ONE IMAGE · ONE LINE",
    description: "Turn an imaginary scene into a line that changes how everyone sees it.",
    criteria: ["Readability", "Twist", "Timing"],
    placeholder: "Caption the scene…",
    maxChars: 180,
  },
  {
    id: "FLIP",
    name: "Flip It",
    shortName: "Flip",
    kicker: "KEEP THE CORE · CHANGE THE MEANING",
    description: "Remix a dull, negative or familiar line into something with a completely different charge.",
    criteria: ["Transformation", "Recognition", "Freshness"],
    placeholder: "Flip the source line…",
    maxChars: 220,
  },
] as const;

export type GameModeId = (typeof GAME_MODES)[number]["id"];

export const RANDOM_MODE = "RANDOM" as const;
export type ModeChoice = GameModeId | typeof RANDOM_MODE;

export function isGameModeId(value: string): value is GameModeId {
  return GAME_MODES.some((mode) => mode.id === value);
}

export function getGameMode(value: string) {
  return GAME_MODES.find((mode) => mode.id === value) ?? null;
}
