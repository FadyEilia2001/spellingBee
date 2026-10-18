import { describe, expect, it } from "vitest";
import { ALL_SPELLING_WORDS } from "../data/words.ts";
import { nextIndex, previousIndex, slotCount } from "./wordCycling.ts";

describe("word cycling", () => {
  it("moves forward and wraps to the start of the list", () => {
    const last = ALL_SPELLING_WORDS.length - 1;

    expect(nextIndex(0, ALL_SPELLING_WORDS.length)).toBe(1);
    expect(nextIndex(last, ALL_SPELLING_WORDS.length)).toBe(0);
  });

  it("moves backward and wraps to the end of the list", () => {
    const last = ALL_SPELLING_WORDS.length - 1;

    expect(previousIndex(0, ALL_SPELLING_WORDS.length)).toBe(last);
    expect(previousIndex(last, ALL_SPELLING_WORDS.length)).toBe(last - 1);
  });

  it("counts every character so the slot row matches the spoken word", () => {
    expect(slotCount("ran")).toBe(3);
    expect(slotCount("piñata")).toBe(6);
    expect(slotCount("self-sufficient")).toBe(15);
    expect(slotCount("a cappella")).toBe(10);
    expect(slotCount("salicylic acid")).toBe(14);
  });
});
