export type WorkItem = {
  title: string;
  type: string;
  note: string;
  description: string;
  href: string;
  action: string;
};

export const featuredWork: WorkItem[] = [
  {
    title: "Level Up",
    type: "MUSIC",
    note: "The inspiring one",
    description:
      "An upward-looking answer to creative gatekeeping—built to feel bigger than the argument around it.",
    href: "https://suno.com/s/XHbBz8drN7HVD6IX",
    action: "Listen on Suno",
  },
  {
    title: "The Musician Police",
    type: "MUSIC · SATIRE",
    note: "The funniest one",
    description:
      "A WEE-OOO warning for anyone attempting to police which tools are allowed to count as music.",
    href: "https://callmedaddy.musicsubject.com",
    action: "Visit MusicSubject",
  },
  {
    title: "Back to Sticks",
    type: "MUSIC · VIDEO",
    note: "The mean one",
    description:
      "A caveman-sized response to the idea that rejecting new tools automatically makes a workflow more authentic.",
    href: "https://callmedaddy.musicsubject.com",
    action: "Visit MusicSubject",
  },
  {
    title: "2010 Wows",
    type: "MUSIC · TRANSFORMATION",
    note: "2010 wrote it. 2026 turned it around.",
    description:
      "Old negative lyrics revisited years later, using AI to transform the outlook without erasing the history behind them.",
    href: "https://callmedaddy.musicsubject.com",
    action: "Visit MusicSubject",
  },
  {
    title: "Wild Ways",
    type: "ARCHIVE · MUSIC",
    note: "Rehearsal to AI-assisted release",
    description:
      "A Nova Scotia keyboard rehearsal, a voice carried forward, and newer versions that show how one work keeps evolving.",
    href: "https://callmedaddy.musicsubject.com",
    action: "Visit MusicSubject",
  },
];

export const movementQuestions = [
  "At what exact point does using a tool make someone stop being an artist?",
  "If a creator writes, directs, rejects, revises and publishes the work, where did the human contribution disappear?",
  "Why is learning an older workflow treated as morally superior to developing a new one?",
  "Can AI practices be criticized without pretending everyone who uses AI is talentless?",
];
