export const MATCH_LENGTHS = [3, 5] as const;
export type MatchLength = (typeof MATCH_LENGTHS)[number];

export const MATCH_FORMATS = [
  {
    id: "SOLO",
    name: "Solo ladder",
    description: "Every creator scores for themselves. Highest round-win total takes the match.",
  },
  {
    id: "TEAMS",
    name: "Team battle",
    description: "Creators are auto-balanced into Signal vs Static. Individual wins also score for the side.",
  },
] as const;

export type MatchFormat = (typeof MATCH_FORMATS)[number]["id"];

export const ROTATION_MODES = [
  {
    id: "AUTO",
    name: "Auto rotation",
    description: "FACEBACK rotates through different games automatically with no repeat inside a 5-round match.",
  },
  {
    id: "HOST",
    name: "Host picks",
    description: "The host chooses the next game between rounds.",
  },
] as const;

export type RotationMode = (typeof ROTATION_MODES)[number]["id"];

export const TIMER_PRESETS = [
  {
    id: "QUICK",
    name: "Quick fire",
    description: "45 seconds to create · 20 seconds to vote",
    answerSeconds: 45,
    voteSeconds: 20,
  },
  {
    id: "STANDARD",
    name: "Standard",
    description: "75 seconds to create · 30 seconds to vote",
    answerSeconds: 75,
    voteSeconds: 30,
  },
  {
    id: "CHILL",
    name: "Give it room",
    description: "120 seconds to create · 45 seconds to vote",
    answerSeconds: 120,
    voteSeconds: 45,
  },
] as const;

export type TimerPreset = (typeof TIMER_PRESETS)[number]["id"];

export const TEAM_SIGNAL = "SIGNAL" as const;
export const TEAM_STATIC = "STATIC" as const;
export type TeamId = typeof TEAM_SIGNAL | typeof TEAM_STATIC;

export function isMatchLength(value: number): value is MatchLength {
  return MATCH_LENGTHS.includes(value as MatchLength);
}

export function isMatchFormat(value: string): value is MatchFormat {
  return MATCH_FORMATS.some((format) => format.id === value);
}

export function isRotationMode(value: string): value is RotationMode {
  return ROTATION_MODES.some((mode) => mode.id === value);
}

export function isTimerPreset(value: string): value is TimerPreset {
  return TIMER_PRESETS.some((preset) => preset.id === value);
}

export function getTimerPreset(value: string) {
  return TIMER_PRESETS.find((preset) => preset.id === value) ?? TIMER_PRESETS[1];
}

export function teamLabel(team: string) {
  if (team === TEAM_SIGNAL) return "Team Signal";
  if (team === TEAM_STATIC) return "Team Static";
  return "Solo";
}
