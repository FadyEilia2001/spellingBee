import { describe, expect, it } from "vitest";
import { ALL_SPELLING_WORDS } from "../data/words.ts";
import { spellingAudioFilename, spellingAudioUrl } from "./audioFile.ts";

describe("spelling audio filenames", () => {
  it("builds a stable public URL from the spelling word", () => {
    expect(spellingAudioUrl("mist")).toBe("/audio/mist.mp3");
    expect(spellingAudioFilename("Halloween")).toBe("halloween.mp3");
    expect(spellingAudioFilename("cul-de-sac")).toBe("cul-de-sac.mp3");
    expect(spellingAudioFilename("a cappella")).toBe("a-cappella.mp3");
    expect(spellingAudioFilename("Addis Ababa")).toBe("addis-ababa.mp3");
    expect(spellingAudioFilename("salicylic acid")).toBe("salicylic-acid.mp3");
    expect(spellingAudioFilename("piñata")).toBe("pinata.mp3");
    expect(spellingAudioFilename("éclair")).toBe("eclair.mp3");
  });

  it("gives every spelling word its own file", () => {
    const filenames = ALL_SPELLING_WORDS.map((word) => spellingAudioFilename(word));
    expect(new Set(filenames).size).toBe(ALL_SPELLING_WORDS.length);
  });
});
