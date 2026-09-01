import type { GameModeId } from "./game-modes";

export type CpuPersona = {
  key: string;
  name: string;
  taste: string;
};

export const CPU_PERSONAS: CpuPersona[] = [
  { key: "spark", name: "Spark.exe", taste: "short, sticky moves" },
  { key: "roast", name: "RoastBot 3000", taste: "sharp punchlines" },
  { key: "oddity", name: "Oddity Engine", taste: "unexpected turns" },
  { key: "polish", name: "Polish Unit", taste: "clean construction" },
  { key: "chaos", name: "Chaos Intern", taste: "reckless novelty" },
  { key: "echo", name: "Echo Machine", taste: "rhythm and repetition" },
  { key: "curve", name: "Curveball CPU", taste: "surprising reversals" },
];

const ANSWERS: Record<GameModeId, string[]> = {
  RAP: [
    "You brought a rulebook to a beat fight / I brought the tool and made the idea take flight.",
    "Gate on the door, but the roof stays open / I made three new worlds while the comments kept loading.",
    "Call it a shortcut—I still chose the road / You guarded the shovel while I built the whole show.",
    "Permission denied, so the bass said proceed / The machine brought the spark, but the taste came from me.",
    "They held a funeral for creativity again / We sampled the eulogy and made it hit ten.",
    "Old rules in a new tab, fear dressed as critique / I turned one strange thought into proof in a week.",
    "You count every tool like the soul has a fee / I count what got made and what it made people feel.",
    "The gatekeeper blinked, so the future walked in / Human on the vision, machine on the spin.",
  ],
  PUNCHLINE: [
    "The machine tried to replace me, but it forgot to develop taste.",
    "The shortcut still required somewhere worth going.",
    "The gatekeeper was busy guarding an empty room.",
    "Apparently creativity expires whenever software updates.",
    "Tradition called—it wants credit for the undo button.",
    "The soul detector needed a subscription renewal.",
    "Everyone could do it, but somehow nobody did.",
    "The rulebook had more updates than the art.",
  ],
  HOOK: [
    "Make it loud. Let the proof talk.",
    "New tools, same human fire.",
    "Proof over permission—make it anyway.",
    "Idea out. Volume up. Doubt gone.",
    "Use the tool. Keep your voice.",
    "We made tomorrow before lunch.",
    "Human taste, machine speed, one sound.",
    "Build first. Let the comments catch up.",
  ],
  PITCH: [
    "A creative gym that turns unfinished ideas into sixty-second challenges, pairs strangers by complementary skills, and saves every winning technique as a reusable lesson.",
    "A museum where every complaint about new technology becomes the prompt for a new artwork, then visitors vote on which rebuttal deserves the gift shop.",
    "A remix translator that lets people describe a feeling instead of a genre, then shows which human decisions changed the result most.",
    "A collaboration roulette wheel that combines one abandoned draft, one unfamiliar tool, and one creator you would never normally meet.",
    "An idea rescue service that finds forgotten voice notes, sketches, and half-written lyrics, then turns them into tiny public creative challenges.",
    "A reverse portfolio where audiences see the failed versions first and unlock the finished work only after guessing which decision fixed it.",
    "A bad-advice generator that transforms gatekeeping clichés into prompts, games, posters, hooks, and increasingly unnecessary merchandise.",
    "A live studio audience for unfinished work: creators test three versions anonymously and learn what landed before attaching their name.",
  ],
  CAPTION: [
    "Local artist discovers the future has an undo button.",
    "Breaking: creativity survives another software update.",
    "Forty-seven approved tools watch number forty-eight get arrested.",
    "He deleted the wheel and called the walk authentic.",
    "The last real artist, now accepting contactless payment.",
    "Couples therapy ended when the pencil admitted it uses an eraser.",
    "Nobody panic—the robot still has terrible taste.",
    "Tradition updates its terms of service.",
  ],
  FLIP: [
    "The tool took the task and handed me more room to create.",
    "If anyone can begin, more people can discover what only they would finish.",
    "This is real art because a real person made real choices.",
    "Press the red button when the old answer stops working.",
    "We still make it ourselves—we just invited better tools into the room.",
    "Technology keeps giving creativity new doors to kick open.",
    "The old method taught me; the new method lets me answer back.",
    "Nothing replaced the creator—the creator gained another instrument.",
  ],
};

export function cpuPersona(key: string) {
  return CPU_PERSONAS.find((persona) => persona.key === key) ?? CPU_PERSONAS[0];
}

export function createCpuAnswer(
  mode: GameModeId,
  prompt: string,
  botKey: string,
  roundNumber: number,
  maxChars: number,
) {
  const bank = mode === "PUNCHLINE" ? punchlineAnswers(prompt) : ANSWERS[mode];
  const index = stableHash(`${botKey}:${roundNumber}:${prompt}`) % bank.length;
  return bank[index].slice(0, maxChars);
}

function punchlineAnswers(prompt: string) {
  const lower = prompt.toLowerCase();
  if (lower.includes("machine tried to replace")) {
    return [
      "develop taste.",
      "ask what I actually wanted.",
      "bring a personality to the interview.",
      "notice I had already replaced the batteries.",
      "learn which mistakes were mine on purpose.",
      "check whether the job was being me.",
      "unsubscribe from my bad ideas.",
    ];
  }
  if (lower.includes("gatekeeper for permission")) {
    return [
      "the imagination department closes at five.",
      "come back when the future has references.",
      "only approved rebellions are accepted.",
      "the empty room is currently at capacity.",
      "creativity requires the original receipt.",
      "please hold while we invent a reason.",
      "absolutely—then hid the door.",
    ];
  }
  if (lower.includes("creativity officially died")) {
    return [
      "the camera, the sampler, Photoshop, and autocomplete.",
      "another completely survivable software update.",
      "several thousand years of suspicious new tools.",
      "being pronounced dead every decade.",
      "the invention of the undo button.",
      "a pencil admitting it uses an eraser.",
      "one more person making something differently.",
    ];
  }
  if (lower.includes("workflow has no soul")) {
    return [
      "it keeps asking mine to do the interesting part.",
      "the software still refuses to have my bad ideas.",
      "the final choice keeps landing on my desk.",
      "my taste has been working overtime.",
      "the invoice is addressed to my imagination.",
      "nobody told the audience—they felt something anyway.",
      "it cannot explain why I rejected version forty-two.",
    ];
  }
  if (lower.includes("traditional way")) {
    return [
      "complaining about the newest tool on an older tool.",
      "copying my influences and calling them ancestors.",
      "using twelve shortcuts everyone has stopped noticing.",
      "asking an eraser to delete its browser history.",
      "waiting until innovation became nostalgia.",
      "pretending the undo button was hand-carved.",
      "finishing late and romanticizing the delay.",
    ];
  }
  return ANSWERS.PUNCHLINE;
}

export function chooseCpuVote(
  mode: GameModeId,
  prompt: string,
  botKey: string,
  submissions: Array<{ id: number; playerId: number; content: string }>,
) {
  if (submissions.length === 0) return null;
  const personaIndex = Math.max(0, CPU_PERSONAS.findIndex((persona) => persona.key === botKey));
  const promptWords = words(prompt);

  return submissions
    .map((submission) => {
      const contentWords = words(submission.content);
      const overlap = contentWords.filter((word) => promptWords.includes(word)).length;
      const targetWords = [7, 13, 17, 22, 28, 10, 15][personaIndex] ?? 14;
      const lengthFit = Math.max(0, 120 - Math.abs(contentWords.length - targetWords) * 5);
      const novelty = new Set(contentWords).size * 4;
      const punctuation = /[!?—:]/.test(submission.content) ? 18 : 0;
      const modeFit = mode === "HOOK" && contentWords.length <= 8 ? 80 : 0;
      const personality = stableHash(`${botKey}:${prompt}:${submission.content}:${submission.id}`) % 240;
      return { id: submission.id, score: overlap * 25 + lengthFit + novelty + punctuation + modeFit + personality };
    })
    .sort((a, b) => b.score - a.score || a.id - b.id)[0]?.id ?? null;
}

export function cpuTeachback(mode: GameModeId, botKey: string) {
  const persona = cpuPersona(botKey);
  const moves: Record<GameModeId, string> = {
    RAP: "I used a setup-and-turn structure, then landed the strongest image on the rhyme.",
    PUNCHLINE: "I kept the setup recognizable and changed the expected ending at the last possible moment.",
    HOOK: "I cut every word that did not help the rhythm or the phrase people would repeat.",
    PITCH: "I named one clear problem, added a surprising mechanism, and made the benefit easy to picture.",
    CAPTION: "I treated the image like a straight setup and let the caption supply the contradiction.",
    FLIP: "I kept the original tension but changed who had power and what the situation made possible.",
  };
  return {
    intent: `Make the idea land through ${persona.taste}.`,
    move: moves[mode],
    lesson: "Keep the premise clear, make one deliberate turn, and remove anything that weakens the landing.",
  };
}

function words(value: string): string[] {
  return value.toLowerCase().match(/[a-z0-9']+/g) ?? [];
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
