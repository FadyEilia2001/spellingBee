import { describe, expect, it } from "vitest";
import { containsTarget, maskSentence, SENTENCE_BLANK } from "./sentenceClue.ts";

describe("written sentence masking", () => {
  it("replaces the target word with a blank on screen", () => {
    const sentence = "Deep breathing causes your lungs to expand.";

    expect(maskSentence(sentence, "lungs")).toBe(
      `Deep breathing causes your ${SENTENCE_BLANK} to expand.`,
    );
    expect(maskSentence(sentence, "lungs")).not.toContain("lungs");
  });

  it("does not blank the target when it is only part of a longer word", () => {
    const sentence = "The orange crate sat in the range.";

    expect(containsTarget(sentence, "ran")).toBe(false);
    expect(maskSentence(sentence, "ran")).toBe(sentence);
  });

  it("blanks a whole word and leaves a longer word that merely contains those letters", () => {
    const sentence = "A cold wind rattled the windows.";
    const masked = maskSentence(sentence, "wind");

    expect(masked).toBe(`A cold ${SENTENCE_BLANK} rattled the windows.`);
    expect(masked).toContain("windows");
    expect(containsTarget(masked, "wind")).toBe(false);
  });

  it("blanks phrases, hyphens, and accented spellings", () => {
    expect(maskSentence("The choir sang a cappella on stage.", "a cappella")).toBe(
      `The choir sang ${SENTENCE_BLANK} on stage.`,
    );
    expect(maskSentence("The farm is self-sufficient today.", "self-sufficient")).toBe(
      `The farm is ${SENTENCE_BLANK} today.`,
    );
    expect(maskSentence("They live on a quiet cul-de-sac.", "cul-de-sac")).toBe(
      `They live on a quiet ${SENTENCE_BLANK}.`,
    );
    expect(maskSentence("Confetti fell when the piñata opened.", "piñata")).toBe(
      `Confetti fell when the ${SENTENCE_BLANK} opened.`,
    );
    expect(maskSentence("He ordered an éclair for dessert.", "éclair")).toBe(
      `He ordered an ${SENTENCE_BLANK} for dessert.`,
    );
    expect(maskSentence("The lotion contains salicylic acid for spots.", "salicylic acid")).toBe(
      `The lotion contains ${SENTENCE_BLANK} for spots.`,
    );
    expect(maskSentence("We wore costumes on Halloween.", "Halloween")).toBe(
      `We wore costumes on ${SENTENCE_BLANK}.`,
    );
  });
});
