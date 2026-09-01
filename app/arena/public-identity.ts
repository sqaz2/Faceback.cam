export type ArenaProfileIdentity = {
  id: number;
  handle: string;
  displayName: string;
  published: number;
};

export type ArenaPublicIdentity = {
  profileId: number | null;
  profileHandle: string;
  displayName: string;
};

export function publicArenaIdentity(profile: ArenaProfileIdentity | null): ArenaPublicIdentity | null {
  if (!profile || profile.published !== 1) return null;

  const displayName = profile.displayName.trim().slice(0, 70);
  const profileHandle = profile.handle.trim().toLowerCase().replace(/^@/, "").slice(0, 30);
  if (!displayName || !profileHandle) return null;

  return {
    profileId: profile.id,
    profileHandle,
    displayName,
  };
}

export function arenaParticipantIdentity(
  profile: ArenaProfileIdentity | null,
  fallbackDisplayName: string,
): ArenaPublicIdentity {
  const profileIdentity = publicArenaIdentity(profile);
  if (profileIdentity) return profileIdentity;

  return {
    profileId: null,
    profileHandle: "",
    displayName: fallbackDisplayName.trim().slice(0, 70) || "FACEBACK Guest",
  };
}
