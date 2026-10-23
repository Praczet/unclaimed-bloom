import { expect, test } from "bun:test";

import { parsePqf } from "./pqf.ts";

const SAMPLE = `As far as I'm aware I'm not specifically banned anywhere, and
am rather depressed about it.  Surely some of you guys can do
*something?*
        -- (Terry Pratchett, alt.books.pratchett)


"Real stupidity beats artificial intelligence every time."
        -- Bursar 1 - Hex 0
           (Terry Pratchett, Hogfather)


"But ye gotta know *where* ye're just gonna rush in.
"Aye, that's right."
        -- Feegle tactics (Terry Pratchett, The Wee Free Men)


It was a nice day. All the days had been nice.
        -- (Terry Pratchett & Neil Gaiman, Good Omens)


I am on holiday.
        -- Terry returns to a.f.p. after a temporary absence.


${"Very long. ".repeat(30)}
        -- (Terry Pratchett, Small Gods)
`;

test("parsePqf joins wrapped lines and strips emphasis", () => {
  const [first] = parsePqf(SAMPLE);
  expect(first).toEqual({
    text: "As far as I'm aware I'm not specifically banned anywhere, and am rather depressed about it.  Surely some of you guys can do something?",
    by: "Terry Pratchett, alt.books.pratchett",
    source: "pqf",
  });
});

test("parsePqf drops the editor's caption and keeps the book", () => {
  const quote = parsePqf(SAMPLE).find((q) => q.text.startsWith('"Real stupidity'));
  expect(quote?.by).toBe("Terry Pratchett, Hogfather");
});

test("parsePqf keeps each speaker on their own line", () => {
  const quote = parsePqf(SAMPLE).find((q) => q.by === "Terry Pratchett, The Wee Free Men");
  expect(quote?.text).toBe(`"But ye gotta know where ye're just gonna rush in.\n"Aye, that's right."`);
});

test("parsePqf credits co-authors and newsgroup posts", () => {
  const by = parsePqf(SAMPLE).map((q) => q.by);
  expect(by).toContain("Terry Pratchett & Neil Gaiman, Good Omens");
  expect(by).toContain("Terry Pratchett, on alt.fan.pratchett");
});

test("parsePqf skips quotes longer than the limit", () => {
  expect(parsePqf(SAMPLE).some((q) => q.by === "Terry Pratchett, Small Gods")).toBe(false);
  expect(parsePqf(SAMPLE, 1000).some((q) => q.by === "Terry Pratchett, Small Gods")).toBe(true);
});
