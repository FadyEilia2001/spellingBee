import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ALL_SPELLING_WORDS, entryForWord } from "./data/words.ts";
import { containsTarget, maskSentence } from "./study/sentenceClue.ts";
import { buildRound, emptyProgress, loadProgress, type Progress } from "./study/progress.ts";
import App from "./App.tsx";

const originalRandom = Math.random;

function seededRound(progress: Progress = emptyProgress()) {
  return buildRound(ALL_SPELLING_WORDS, progress, { random: () => 0 });
}

beforeEach(() => {
  Math.random = () => 0;
});

afterEach(() => {
  Math.random = originalRandom;
});

const speakWord = vi.fn();
const stopSpeaking = vi.fn();

vi.mock("./study/speech.ts", () => ({
  speakWord: (...args: unknown[]) => speakWord(...args),
  stopSpeaking: (...args: unknown[]) => stopSpeaking(...args),
}));

vi.mock("canvas-confetti", () => ({
  default: vi.fn(),
}));

describe("study loop", () => {
  beforeEach(() => {
    localStorage.clear();
    speakWord.mockClear();
    stopSpeaking.mockClear();
  });

  it("shows empty slots for the first word and does not speak until asked", () => {
    render(<App />);

    expect(screen.getAllByTestId("letter-slot")).toHaveLength(Array.from(seededRound()[0] ?? "").length);
    expect(speakWord).not.toHaveBeenCalled();
  });

  it("speaks the current word only when Hear Word is tapped", async () => {
    const user = userEvent.setup();
    render(<App />);

    const input = screen.getByRole("textbox", { name: /spelling guess/i });
    await user.click(screen.getByRole("button", { name: /hear word/i }));

    expect(speakWord).toHaveBeenCalledTimes(1);
    expect(speakWord).toHaveBeenCalledWith(seededRound()[0]);
    expect(document.activeElement).toBe(input);
  });

  it("shows a written sentence clue and does not speak it", async () => {
    const user = userEvent.setup();
    render(<App />);

    const word = seededRound()[0] ?? "";
    const entry = entryForWord(word);
    await user.click(screen.getByRole("button", { name: /in a sentence/i }));

    expect(speakWord).not.toHaveBeenCalled();
    const clue = screen.getByTestId("sentence-clue");
    expect(containsTarget(clue.textContent ?? "", word)).toBe(false);
    expect(screen.getByTestId("clue-definition").textContent).toBe(entry?.definition);
    expect(screen.getByTestId("clue-sentence").textContent).toBe(
      maskSentence(entry?.sentence ?? "", word),
    );
    expect(screen.getByTestId("clue-sentence").textContent).toContain("________");
    expect((screen.getByRole("button", { name: /in a sentence/i }) as HTMLButtonElement).className).toContain(
      "min-h-[52px]",
    );

    await user.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(screen.queryByTestId("sentence-clue")).toBeNull();
  });

  it("plays a 10-word round and keeps every button at least 52px tall", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByText(/word 1 of 10/i).textContent).toMatch(/word 1 of 10/i);
    for (const button of screen.getAllByRole("button")) {
      expect(button.className).toContain("min-h-[52px]");
    }
    expect((screen.getByRole("button", { name: /previous word/i }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect((screen.getByRole("button", { name: /next word/i }) as HTMLButtonElement).disabled).toBe(true);

    const round = seededRound();
    await user.type(screen.getByRole("textbox", { name: /spelling guess/i }), round[0] ?? "");
    await user.click(screen.getByRole("button", { name: /^submit$/i }));
    await user.click(screen.getByRole("button", { name: /next word/i }));

    expect(screen.getByText(/word 2 of 10/i).textContent).toMatch(/word 2 of 10/i);
    expect(screen.getAllByTestId("letter-slot")).toHaveLength(Array.from(round[1] ?? "").length);
    expect(speakWord).not.toHaveBeenCalled();
  });
});

describe("spelling attempts", () => {
  beforeEach(() => {
    localStorage.clear();
    speakWord.mockClear();
    stopSpeaking.mockClear();
  });

  it("fills the letter boxes from the current list word as you type", async () => {
    const user = userEvent.setup();
    render(<App />);

    const word = seededRound()[0] ?? "";
    const typed = Array.from(word).slice(0, 2).join("");
    await user.type(screen.getByRole("textbox", { name: /spelling guess/i }), typed);

    expect(screen.getAllByTestId("letter-slot").map((slot) => slot.textContent)).toEqual([
      ...Array.from(typed),
      ...Array.from({ length: Array.from(word).length - Array.from(typed).length }, () => ""),
    ]);
  });

  it("turns a correct guess entirely green", async () => {
    const user = userEvent.setup();
    render(<App />);

    const word = seededRound()[0] ?? "";
    await user.type(screen.getByRole("textbox", { name: /spelling guess/i }), word);
    await user.click(screen.getByRole("button", { name: /^submit$/i }));

    const tiles = screen.getAllByTestId("attempt-tile");
    expect(tiles.map((tile) => tile.textContent)).toEqual(Array.from(word));
    expect(tiles.every((tile) => tile.dataset.status === "correct")).toBe(true);
  });

  it("uses an 18px input and stops after three misses", async () => {
    const user = userEvent.setup();
    render(<App />);
    const input = screen.getByRole("textbox", { name: /spelling guess/i });

    expect(input.style.fontSize).toBe("18px");

    for (const guess of ["xyz", "dog", "hat"]) {
      await user.type(input, guess);
      await user.click(screen.getByRole("button", { name: /^submit$/i }));
    }

    expect(screen.getAllByTestId("attempt-row")).toHaveLength(3);
    const revealed = screen.getByTestId("revealed-word");
    expect(revealed.textContent).toBe(seededRound()[0]);
    expect(revealed.className).toMatch(/font-bold/);
    expect(revealed.className).toMatch(/green/);
    expect(speakWord).toHaveBeenCalledTimes(1);
    expect(speakWord).toHaveBeenCalledWith(seededRound()[0]);
    expect((input as HTMLInputElement).disabled).toBe(true);
    expect(screen.getAllByTestId("attempt-row")).toHaveLength(3);
  });

  it("resets the attempt counter when moving to the next word", async () => {
    const user = userEvent.setup();
    render(<App />);
    const input = screen.getByRole("textbox", { name: /spelling guess/i });

    await user.type(input, "xyz");
    await user.click(screen.getByRole("button", { name: /^submit$/i }));
    expect(screen.getByText(/1 of 3/).textContent).toMatch(/1 of 3/);
    expect((screen.getByRole("button", { name: /next word/i }) as HTMLButtonElement).disabled).toBe(
      true,
    );

    await user.type(input, seededRound()[0] ?? "");
    await user.click(screen.getByRole("button", { name: /^submit$/i }));
    await user.click(screen.getByRole("button", { name: /next word/i }));

    expect(screen.getByText(/0 of 3/).textContent).toMatch(/0 of 3/);
    expect(screen.queryByTestId("attempt-tile")).toBeNull();
    expect(screen.queryByTestId("revealed-word")).toBeNull();
    expect((input as HTMLInputElement).value).toBe("");
    expect((input as HTMLInputElement).disabled).toBe(false);
  });
});

describe("saved study rounds", () => {
  beforeEach(() => {
    localStorage.clear();
    speakWord.mockClear();
    stopSpeaking.mockClear();
  });

  it("keeps total stars and the streak after a reload", async () => {
    const user = userEvent.setup();
    const first = render(<App />);

    await user.type(screen.getByRole("textbox", { name: /spelling guess/i }), seededRound()[0] ?? "");
    await user.click(screen.getByRole("button", { name: /^submit$/i }));
    expect(screen.getByTestId("total-stars").textContent).toBe("3");
    expect(screen.getByTestId("current-streak").textContent).toBe("1");
    expect((screen.getByTestId("streak-fill") as HTMLElement).style.width).toBe("10%");

    first.unmount();
    render(<App />);

    expect(screen.getByTestId("total-stars").textContent).toBe("3");
    expect(screen.getByTestId("current-streak").textContent).toBe("1");
  });

  it("reviews a missed word before new words", async () => {
    const user = userEvent.setup();
    const first = render(<App />);
    const input = screen.getByRole("textbox", { name: /spelling guess/i });

    for (const guess of ["xyz", "dog", "hat"]) {
      await user.type(input, guess);
      await user.click(screen.getByRole("button", { name: /^submit$/i }));
    }

    const missed = screen.getByTestId("revealed-word").textContent;
    first.unmount();
    render(<App />);

    const round = buildRound(ALL_SPELLING_WORDS, loadProgress(), { random: () => 0 });
    await user.click(screen.getByRole("button", { name: /hear word/i }));
    expect(round).toContain(missed);
    expect(round).toContain(speakWord.mock.calls.at(-1)?.[0]);
    expect(screen.getByTestId("total-stars").textContent).toBe("0");
    expect(screen.getByTestId("current-streak").textContent).toBe("0");
  });

  it("shows a celebratory summary after a 10-word round", async () => {
    const user = userEvent.setup();
    render(<App />);

    const round = seededRound();
    for (const word of round) {
      await user.type(screen.getByRole("textbox", { name: /spelling guess/i }), word);
      await user.click(screen.getByRole("button", { name: /^submit$/i }));
      const next = screen.queryByRole("button", { name: /next word/i });
      if (next) await user.click(next);
    }

    expect(screen.getByTestId("round-summary")).toBeTruthy();
    expect(screen.getByTestId("round-stars").textContent).toMatch(/30/);
    expect(screen.getByTestId("round-accuracy").textContent).toMatch(/100%/);
    expect(screen.getByRole("button", { name: /new round/i })).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: /review missed words/i }) as HTMLButtonElement).disabled,
    ).toBe(true);

    await user.click(screen.getByRole("button", { name: /new round/i }));
    expect(screen.queryByTestId("round-summary")).toBeNull();
    expect(screen.getByText(/word 1 of 10/i).textContent).toMatch(/word 1 of 10/i);
    const nextRound = buildRound(ALL_SPELLING_WORDS, loadProgress(), { random: () => 0 });
    expect(screen.getAllByTestId("letter-slot")).toHaveLength(Array.from(nextRound[0] ?? "").length);
  });
});
