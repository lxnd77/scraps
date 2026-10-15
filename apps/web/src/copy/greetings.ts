/**
 * Board greetings (SPEC 4 voice), chosen by the device clock, not the theme: the 3am line belongs
 * to 3am. Each visit to a board picks one at random from the band's pool, so the board says
 * something a little different each time. `**phrase**` marks the highlighted pill.
 */
export type GreetingBand = "late" | "morning" | "afternoon" | "evening" | "night";

export const GREETINGS: Record<GreetingBand, { board: string[]; phone: string[] }> = {
  // 0:00 to 4:59
  late: {
    board: [
      "it's 3am. what's living **rent free** in your head?",
      "can't sleep? **dump it** here.",
      "the 3am thoughts are **loud** tonight, huh?",
      "brain still buffering? **spill** it.",
      "owl hours. what's **keeping you up**?",
    ],
    phone: [
      "still up? same. spill the **3am** thoughts.",
      "can't sleep? **dump it** here.",
      "3am brain is **loud**. type it out.",
      "owl hours. what's **up**?",
    ],
  },
  // 5:00 to 11:59
  morning: {
    board: [
      "gm bestie. what's living in **your head** today?",
      "rise and **scribble**. what's the plan?",
      "fresh day, fresh **chaos**. what's first?",
      "coffee first, then **brain dump**.",
      "morning! what's on the **to-do pile**?",
    ],
    phone: [
      "gm. what's the **mess** today?",
      "rise and **scribble**.",
      "coffee, then **brain dump**.",
      "fresh day. what's **first**?",
    ],
  },
  // 12:00 to 16:59
  afternoon: {
    board: [
      "hey bestie. what's on the **brain** this afternoon?",
      "afternoon slump? **unload** the brain.",
      "midday check-in. what **popped up**?",
      "lunch break thoughts go **right here**.",
      "halfway there. what's still **on the list**?",
    ],
    phone: [
      "hey. what's on the **brain**?",
      "afternoon slump? **unload**.",
      "midday thoughts go **here**.",
      "what **popped up**?",
    ],
  },
  // 17:00 to 20:59
  evening: {
    board: [
      "evening. what's still **rattling around** up there?",
      "golden hour. what **stuck** with you today?",
      "day's winding down. anything **worth keeping**?",
      "debrief time. what **happened** today?",
    ],
    phone: [
      "evening. what's **rattling** around?",
      "golden hour. what **stuck**?",
      "debrief time. **spill**.",
      "anything **worth keeping**?",
    ],
  },
  // 21:00 to 23:59
  night: {
    board: [
      "winding down? park the **thoughts** here.",
      "late night brain says **write it down**.",
      "before bed: close the **brain tabs**.",
      "night mode on. what's **on your mind**?",
    ],
    phone: [
      "winding down? park the **thoughts**.",
      "close the **brain tabs**.",
      "night thoughts go **here**.",
      "what's **on your mind**?",
    ],
  },
};

export function greetingBand(hour: number): GreetingBand {
  if (hour < 5) return "late";
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 21) return "evening";
  return "night";
}

/** One greeting for the hour; `roll` in [0, 1) picks from the pool (Math.random() per visit). */
export function pickGreeting(hour: number, surface: "board" | "phone", roll: number): string {
  const pool = GREETINGS[greetingBand(hour)][surface];
  const index = Math.min(pool.length - 1, Math.max(0, Math.floor(roll * pool.length)));
  return pool[index]!;
}
