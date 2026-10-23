import { resolve } from "node:path";

import bundled from "../themes/quotes.json";

export interface Quote {
  text: string;
  by?: string;
  // Where an imported quote came from, e.g. "pqf"; hand-written ones have none.
  source?: string;
}

export interface QuoteBook {
  intros: string[];
  quotes: Quote[];
  // Set when the user's file could not be used and the bundled set stands in.
  problem?: string;
}

// Quotes live in ~/.config/claimed-bloom/quotes.json so they can be edited
// without touching code. The file is created from the bundled set on first
// use and read again on every Complain visit, so edits show up right away.
export class QuoteStore {
  constructor(
    private readonly path = resolve(
      Bun.env.XDG_CONFIG_HOME ?? resolve(Bun.env.HOME ?? "", ".config"),
      "claimed-bloom",
      "quotes.json",
    ),
  ) { }

  get userPath(): string {
    return this.path;
  }

  async load(): Promise<QuoteBook> {
    const file = Bun.file(this.path);

    if (!(await file.exists())) {
      try {
        await Bun.write(this.path, `${JSON.stringify(bundled, null, 2)}\n`);
      } catch { /* read-only config: the bundled set still works */ }
      return { ...bundled };
    }

    let raw: { intros?: unknown; quotes?: unknown };
    try {
      raw = await file.json();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { ...bundled, problem: `${this.path} is not valid JSON (${message}); using the bundled quotes.` };
    }

    const quotes = Array.isArray(raw.quotes)
      ? raw.quotes.filter((quote): quote is Quote =>
        typeof quote?.text === "string" && quote.text.trim() !== "" &&
        (quote.by === undefined || typeof quote.by === "string")
      )
      : [];
    const intros = Array.isArray(raw.intros)
      ? raw.intros.filter((intro): intro is string => typeof intro === "string")
      : [];

    if (quotes.length === 0) {
      return { ...bundled, problem: `${this.path} has no usable quotes; using the bundled ones.` };
    }
    return { intros: intros.length > 0 ? intros : bundled.intros, quotes };
  }
}
