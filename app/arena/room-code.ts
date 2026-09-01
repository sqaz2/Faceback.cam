export const ARENA_ROOM_CODE_LENGTH = 8;
export const ARENA_ROOM_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

const roomCodePattern = new RegExp(`^[${ARENA_ROOM_CODE_ALPHABET}]{${ARENA_ROOM_CODE_LENGTH}}$`);

export function normalizeArenaRoomCode(value: unknown) {
  if (typeof value !== "string") return "";
  const code = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, ARENA_ROOM_CODE_LENGTH);
  return roomCodePattern.test(code) ? code : "";
}
