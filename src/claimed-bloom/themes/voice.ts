import type { StaticRoute } from "../app/routes.ts";
import type { QuoteBook } from "../services/QuoteStore.ts";

// The voice of claimed-bloom: subtitles, view titles, menu asides and
// complaints. Everything here is picked at random; add lines freely. Quotes
// live in quotes.json (see QuoteStore) so they can be edited without code.

const SUBTITLES = [
  "~The garden is yours to understand~",
  "~The garden is yours. The weeding is also yours~",
  "~Colours were harmed in the making of this theme~",
  "~Now with 18% more lavender, against your will~",
  "~Every pixel has a past~",
  "~It works on my wallpaper~",
  "~Grown, not built. Mostly grown. Some of it is built~",
  "~Sowing since this morning, apparently~",
  "~Please do not feed the matugen~",
  "~The background is still #25282d. It is always #25282d~",
  "~Hand-picked hex codes, lovingly misremembered~",
  "~A terminal is just a garden with fewer bees~",
  "~Proudly not a design system~",
  "~Inception, but for colours~",
];

const TITLES: Partial<Record<StaticRoute, string[]>> = {
  home: [
    "Welcome back. The garden missed you. The garden does not have feelings, but still.",
    "Pick something. Anything. Enter is right there.",
    "Home, where the hex codes are.",
  ],
  show: [
    "Show:=> look, but do not touch",
    "Show:=> the museum of things spore made",
    "Show:=> a guided tour, the guide is also a TUI",
  ],
  check: [
    "Check:=> is everything the current theme uses installed and applied?",
    "Check:=> the doctor will see you now",
    "Check:=> trust, but verify, but mostly verify",
  ],
  do: [
    "Do:=> sync dev into config and re-apply the theme",
    "Do:=> buttons that actually do things, scary",
    "Do:=> with great power comes great spore sync --apply",
  ],
  complain: [
    "Complain:=> the most useful useless screen",
    "Complain:=> a safe space for grievances",
    "Complain:=> someone has to say it",
  ],
  theme: [
    "Theme:=> how claimed-bloom itself looks",
    "Theme:=> dress the gardener",
    "Theme:=> yes, the theming tool has themes",
  ],
  current: [
    "Status:=> I mean current status of the Spore and Bloom",
    "Status:=> what the hell is going on, politely",
  ],
  changes: [
    "Changes:=> what is in dev but not installed, sown, grown or planted",
    "Changes:=> things you did and then forgot to finish",
  ],
  profiles: [
    "Profiles:=> which palette, mood and recipes each profile uses",
    "Profiles:=> one composition to rule them all",
  ],
  palettes: [
    "Palettes:=> the base colours every bloom starts from",
    "Palettes:=> nineteen colours walk into a bar",
  ],
  moods: [
    "Moods:=> wallpaper influence per colour group",
    "Moods:=> from dormant to overgrown, like a weekend",
  ],
  targets: [
    "Targets:=> every app spore themes, and where its colours land",
    "Targets:=> everything that will be lavender by tonight",
  ],
};

// Dimmed one-liners under a menu entry's explanation; the facts stay above.
const ASIDES: Partial<Record<StaticRoute, string[]>> = {
  show: [
    "Look with your eyes, not with spore sync.",
    "Everything spore made, arranged for viewing.",
    "Bring snacks, there are 37 targets.",
  ],
  check: [
    "It's probably fine. It's never fine.",
    "Like a smoke detector, but for hex codes.",
    "Asks the awkward questions so you don't have to.",
  ],
  do: [
    "The only menu with consequences.",
    "Press Enter, become responsible.",
    "Most of these just call spore. Spore does the work. Spore never complains.",
  ],
  complain: [
    "Fixes nothing. Helps anyway.",
    "Zero features. Full support.",
    "Scientifically useless. Emotionally essential.",
  ],
  theme: [
    "Yes, the theming tool needs a theme. No, we will not discuss it.",
    "Pick Unclaimed Bloom and watch it repaint itself after every wallpaper.",
    "Dress the gardener before the garden.",
    "Szewc bez butów chodzi. Not this shoemaker. Not anymore.",
  ],
  current: [
    "Start here. Everyone starts here. Nobody knows why.",
    "The truth, with timestamps.",
  ],
  recipes: [
    "Where colour decisions go to become JSON.",
    "Every token has a story. Most of them are 'mix 0.1'.",
  ],
  profiles: [
    "Thirty profiles, one of you.",
    "Compositions are profiles made of profiles. Don't think about it too hard.",
  ],
  palettes: [
    "Nineteen colours, infinite opinions.",
    "Nord-ish, Tokyo-ish, Ash-ish. Mostly -ish.",
  ],
  moods: [
    "Four moods. None of them is 'tired'. Yet.",
    "Dormant to overgrown: how loud the wallpaper gets to be.",
  ],
  targets: [
    "Every app that will be lavender by tonight.",
    "Where the colours finally land, and what runs after.",
  ],
  changes: [
    "Things you started and then went to make tea.",
    "For when something is not working. Which is now.",
  ],
};

const COMPLAINTS = [
  "I changed the wallpaper and the background stayed #25282d. It is always #25282d. I am starting to think #25282d is the wallpaper.",
  "Hyprlock takes sixteen seconds to plant. Sixteen. I could grow an actual plant in that time. A small one.",
  "Somebody named a folder 'componenets' and now I live there.",
  "Nobody ever asks the icons how they feel about being regenerated 44,137 times.",
  "I was promised a garden. I got a JSON file with opinions.",
  "Every time you run sow, a hex code somewhere loses its identity.",
  "The mood is called 'blooming'. I have not bloomed. I have barely sprouted.",
  "Matugen looked at a turquoise elf and decided everything should be olive. Nobody asked matugen.",
  "There are four moods and none of them is 'tired'.",
  "I have a Check screen, a Changes screen and a Status screen, and I still do not know what is going on.",
  "Thirty-one targets and not one of them is a nap.",
  "Composition profiles: because one profile was not confusing enough.",
  "The accent colour changed and nobody threw a party.",
  "I am a TUI. I live in a terminal. My only window is made of box-drawing characters.",
  "The workbench gets a browser. I get ANSI escape codes. Fine. FINE.",
  "Someone wrote 'Do not edit this file directly unless you enjoy losing arguments with automation'. I edited it. I lost.",
  "My theme is generated by the thing I am supposed to inspect. I am inspecting myself. Send help.",
  "Why is there a Complain button but no Fix Everything button.",
  "Deno for spore, Bun for me. We do not talk at family dinners.",
  "I asked for more contrast and got a mood weight.",
  "It is not a bug, it is a slightly different shade of the same colour, which, as it turns out, is a bug.",
  "Some days the most you can do is pick a wallpaper. That counts. Today it counts.",
  "Tired is a valid colour scheme. Low contrast, mostly grey, occasional accent.",
  "You opened the Complain screen on purpose, which means you needed this. Here is a complaint: everything is a lot.",
];


// Picks a random item, avoiding the one picked last time for the same list.
// Lists rebuilt on every call pass a stable key instead of relying on identity.
const lastPicked = new Map<unknown, unknown>();
function pick<T>(items: readonly T[], key: unknown = items): T {
  if (items.length === 1) return items[0]!;
  let item: T;
  do {
    item = items[Math.floor(Math.random() * items.length)]!;
  } while (item === lastPicked.get(key));
  lastPicked.set(key, item);
  return item;
}

export function subtitle(): string {
  return pick(SUBTITLES);
}

export function viewTitle(route: StaticRoute): string | undefined {
  const titles = TITLES[route];
  return titles ? pick(titles) : undefined;
}

export function menuAside(route: StaticRoute): string | undefined {
  const asides = ASIDES[route];
  return asides ? pick(asides) : undefined;
}

export interface Complaint {
  intro?: string;
  text: string;
  by?: string;
}

// Mostly complaints; roughly one time in three a quote instead. Hand-written
// quotes get half the turns, so a few hundred imported ones cannot bury them.
export function complaint(book: QuoteBook): Complaint {
  if (book.quotes.length > 0 && Math.random() < 0.3) {
    const own = book.quotes.filter((quote) => !quote.source);
    const imported = book.quotes.filter((quote) => quote.source);
    const pool = own.length > 0 && imported.length > 0 ? (Math.random() < 0.5 ? own : imported) : book.quotes;
    const quote = pick(pool, pool === own ? "own-quotes" : pool === imported ? "imported-quotes" : "quotes");
    return { intro: book.intros.length > 0 ? pick(book.intros, "intros") : undefined, text: quote.text, by: quote.by };
  }
  return { text: pick(COMPLAINTS) };
}
