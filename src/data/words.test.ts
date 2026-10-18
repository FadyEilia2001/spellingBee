import { describe, expect, it } from "vitest";
import { ALL_SPELLING_WORDS, SPELLING_ENTRIES, type BeeTier } from "./words.ts";
import { containsTarget, maskSentence } from "../study/sentenceClue.ts";

const tiers: BeeTier[] = ["One Bee", "Two Bee", "Three Bee"];

describe("spelling word dataset", () => {
  it("keeps every original word, in order, with a written clue", () => {
    expect(SPELLING_ENTRIES).toHaveLength(450);
    expect(ALL_SPELLING_WORDS).toEqual(SPELLING_ENTRIES.map((entry) => entry.word));
    expect(new Set(ALL_SPELLING_WORDS).size).toBe(450);
    expect(ALL_SPELLING_WORDS[0]).toBe("ran");
    expect(ALL_SPELLING_WORDS[75]).toBe("money");
    expect(ALL_SPELLING_WORDS[76]).toBe("cabin");
    expect(ALL_SPELLING_WORDS[225]).toBe("piñata");
    expect(ALL_SPELLING_WORDS[226]).toBe("newt");
    expect(ALL_SPELLING_WORDS.at(-1)).toBe("Cappadocia");

    const tierCounts = { "One Bee": 0, "Two Bee": 0, "Three Bee": 0 };
    for (const entry of SPELLING_ENTRIES) {
      expect(tiers).toContain(entry.tier);
      tierCounts[entry.tier] += 1;
      expect(entry.definition.trim().length).toBeGreaterThan(8);
      expect(containsTarget(entry.sentence, entry.word)).toBe(true);
      expect(containsTarget(entry.definition, entry.word)).toBe(false);
      expect(entry.definition.toLocaleLowerCase("en-US").includes(entry.word.toLocaleLowerCase("en-US"))).toBe(
        false,
      );
      const masked = maskSentence(entry.sentence, entry.word);
      expect(masked).toContain("________");
      expect(containsTarget(masked, entry.word)).toBe(false);
    }

    expect(tierCounts).toEqual({ "One Bee": 76, "Two Bee": 150, "Three Bee": 224 });
    expect(SPELLING_ENTRIES.slice(0, 76).every((entry) => entry.tier === "One Bee")).toBe(true);
    expect(SPELLING_ENTRIES.slice(76, 226).every((entry) => entry.tier === "Two Bee")).toBe(true);
    expect(SPELLING_ENTRIES.slice(226).every((entry) => entry.tier === "Three Bee")).toBe(true);
  });
});
