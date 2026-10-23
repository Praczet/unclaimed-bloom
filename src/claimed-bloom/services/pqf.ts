import type { Quote } from "./QuoteStore.ts";

// Parser for the Pratchett Quote File (https://www.lspace.org/ftp/words/pqf/pqf),
// a fortune-style text file: quote lines, then an indented attribution
//
//   "Real stupidity beats artificial intelligence every time."
//           -- Bursar 1 - Hex 0
//              (Terry Pratchett, Hogfather)
//
// where the first attribution line is an editor's caption and the last
// parenthesised group names the author(s) and the book or newsgroup.

export const PQF_URL = "https://www.lspace.org/ftp/words/pqf/pqf";

const ATTRIBUTION = /^\s+--\s?/;
const SOURCE = /\(([^()]*Pratchett[^()]*?),\s*([^()]+)\)\s*$/;

export function parsePqf(text: string, maxLength = 220): Quote[] {
  const quotes: Quote[] = [];
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let body: string[] = [];

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;

    if (!ATTRIBUTION.test(line)) {
      if (line.trim() === "") {
        // A blank line inside a quote separates paragraphs; keep it as a break.
        if (body.length > 0) body.push("");
      } else {
        body.push(line);
      }
      continue;
    }

    // The attribution runs on through indented lines until a blank one.
    const attribution = [line.replace(ATTRIBUTION, "")];
    while (index + 1 < lines.length && /^\s+\S/.test(lines[index + 1]!) && !ATTRIBUTION.test(lines[index + 1]!)) {
      attribution.push(lines[++index]!.trim());
    }

    const quote = joinBody(body);
    body = [];
    if (quote === "" || quote.length > maxLength) continue;
    quotes.push({ text: quote, by: describeSource(attribution.join(" ")), source: "pqf" });
  }

  return quotes;
}

// "(Terry Pratchett, Hogfather)" → "Terry Pratchett, Hogfather". Captions
// without a source are newsgroup posts by Terry.
function describeSource(attribution: string): string {
  const match = attribution.match(SOURCE);
  if (match) return `${match[1]!.trim()}, ${match[2]!.trim()}`;
  return "Terry Pratchett, on alt.fan.pratchett";
}

// Wrapped lines become one line; a new speaker (a line opening with a quote
// mark) or a paragraph break stays on its own line. *Emphasis* markers go.
function joinBody(lines: string[]): string {
  const out: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (line === "") {
      if (out.length > 0 && out[out.length - 1] !== "") out.push("");
    } else if (out.length === 0 || out[out.length - 1] === "" || /^["'`]/.test(line)) {
      out.push(line);
    } else {
      out[out.length - 1] += ` ${line}`;
    }
  }
  while (out[out.length - 1] === "") out.pop();
  return out.join("\n").replace(/\*([^*\n]+)\*/g, "$1").trim();
}
