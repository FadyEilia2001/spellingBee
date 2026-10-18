import { beforeEach, describe, expect, it, vi } from "vitest";
import { DUCKED_VOLUME, TUNE_VOLUME } from "./lines.ts";
import { resetSoundtrack, startTune, tuneVolume } from "./soundtrack.ts";
import { peakAmplitude, speakWord, stopSpeaking, SPEECH_RATE, type CheckAudio } from "./speech.ts";

class SpeechSynthesisUtteranceStub {
  text: string;
  rate = 1;
  lang = "";
  voice: SpeechSynthesisVoice | null = null;
  onend: (() => void) | null = null;

  constructor(text: string) {
    this.text = text;
  }
}

class FakeAudio {
  static instances: FakeAudio[] = [];

  src: string;
  paused = false;
  private listeners = new Map<string, Set<() => void>>();

  constructor(src: string) {
    this.src = src;
    FakeAudio.instances.push(this);
  }

  addEventListener(type: string, listener: () => void) {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  dispatch(type: string) {
    for (const listener of this.listeners.get(type) ?? []) listener();
  }

  play() {
    return playImpl();
  }

  pause() {
    this.paused = true;
  }
}

let playImpl: () => Promise<void> = () => Promise.resolve();
const audible: CheckAudio = async () => "ok";

beforeEach(() => {
  resetSoundtrack();
  FakeAudio.instances = [];
  playImpl = () => Promise.resolve();
  vi.stubGlobal("SpeechSynthesisUtterance", SpeechSynthesisUtteranceStub);
  vi.stubGlobal("Audio", FakeAudio);
});

function mockSynth(overrides: Partial<SpeechSynthesis> = {}): SpeechSynthesis {
  return {
    speaking: false,
    pending: false,
    paused: false,
    speak: () => {},
    cancel: () => {},
    resume: () => {},
    pause: () => {},
    getVoices: () => [],
    ...overrides,
  } as SpeechSynthesis;
}

function flush(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

describe("pronunciation", () => {
  it("does not speak until speakWord is called", async () => {
    const spoken: SpeechSynthesisUtterance[] = [];
    const synth = mockSynth({
      speak: (utterance) => {
        spoken.push(utterance);
      },
    });

    expect(FakeAudio.instances).toHaveLength(0);
    expect(spoken).toHaveLength(0);

    speakWord("mist", synth, audible);
    await flush();

    expect(FakeAudio.instances.map((audio) => audio.src)).toEqual(["/audio/mist.mp3"]);
    expect(spoken).toHaveLength(0);
  });

  it("plays the generated mp3 and leaves browser speech unused", async () => {
    const spoken: SpeechSynthesisUtterance[] = [];
    const synth = mockSynth({
      speak: (utterance) => {
        spoken.push(utterance);
      },
    });

    speakWord("bioluminescence", synth, audible);
    await flush();

    expect(FakeAudio.instances.map((audio) => audio.src)).toEqual([
      "/audio/bioluminescence.mp3",
    ]);
    expect(spoken).toHaveLength(0);
  });

  it("falls back to slower browser speech when the mp3 cannot be played", async () => {
    playImpl = () => Promise.reject(new Error("missing"));
    const spoken: SpeechSynthesisUtterance[] = [];
    const synth = mockSynth({
      speak: (utterance) => {
        spoken.push(utterance);
      },
    });

    speakWord("bioluminescence", synth, audible);
    await flush();

    expect(spoken).toHaveLength(1);
    expect(spoken[0]?.text).toBe("bioluminescence");
    expect(spoken[0]?.rate).toBe(SPEECH_RATE);
    expect(SPEECH_RATE).toBeCloseTo(0.82);
  });

  it("falls back to browser speech when the mp3 is effectively silent", async () => {
    const spoken: SpeechSynthesisUtterance[] = [];
    const synth = mockSynth({
      speak: (utterance) => {
        spoken.push(utterance);
      },
    });

    speakWord("peach", synth, async () => "unusable");
    await flush();

    expect(FakeAudio.instances).toHaveLength(0);
    expect(spoken).toHaveLength(1);
    expect(spoken[0]?.text).toBe("peach");
    expect(spoken[0]?.rate).toBe(SPEECH_RATE);
  });

  it("falls back when the file errors after play() already resolved", async () => {
    const spoken: SpeechSynthesisUtterance[] = [];
    const synth = mockSynth({
      speak: (utterance) => {
        spoken.push(utterance);
      },
    });

    speakWord("peach", synth, audible);
    await flush();
    expect(spoken).toHaveLength(0);

    FakeAudio.instances[0]?.dispatch("error");
    await flush();

    expect(spoken.map((utterance) => utterance.text)).toEqual(["peach"]);
  });

  it("falls back only once when loading fails twice", async () => {
    playImpl = () => Promise.reject(new Error("missing"));
    const spoken: SpeechSynthesisUtterance[] = [];
    const synth = mockSynth({
      speak: (utterance) => {
        spoken.push(utterance);
      },
    });

    speakWord("mist", synth, audible);
    await flush();
    FakeAudio.instances[0]?.dispatch("error");
    await flush();

    expect(spoken.map((utterance) => utterance.text)).toEqual(["mist"]);
  });

  it("clears speech already in progress before falling back to the full word", async () => {
    playImpl = () => Promise.reject(new Error("missing"));
    const events: string[] = [];
    let speaking = true;
    const synth = {
      get speaking() {
        return speaking;
      },
      pending: false,
      paused: false,
      cancel: () => {
        speaking = false;
        events.push("cancel");
      },
      speak: (utterance: SpeechSynthesisUtterance) => {
        events.push(`speak:${utterance.text}`);
      },
      resume: () => {},
      pause: () => {},
      getVoices: () => [],
    } as SpeechSynthesis;

    speakWord("rabbit", synth, audible);
    await flush();

    expect(events).toEqual(["cancel", "speak:rabbit"]);
  });

  it("stops generated audio before pronouncing another word", async () => {
    const synth = mockSynth();

    speakWord("mist", synth, audible);
    await flush();
    speakWord("rabbit", synth, audible);
    await flush();

    expect(FakeAudio.instances[0]?.paused).toBe(true);
    expect(FakeAudio.instances[0]?.src).toBe("");
    expect(FakeAudio.instances[1]?.src).toBe("/audio/rabbit.mp3");
  });

  it("does not fall back to browser speech after pronunciation is stopped", async () => {
    let rejectPlay: (reason?: unknown) => void = () => {};
    playImpl = () =>
      new Promise((_resolve, reject) => {
        rejectPlay = reject;
      });
    const spoken: SpeechSynthesisUtterance[] = [];
    const synth = mockSynth({
      speak: (utterance) => {
        spoken.push(utterance);
      },
    });

    speakWord("mist", synth, audible);
    await flush();
    stopSpeaking(synth);
    rejectPlay(new Error("aborted"));
    await flush();

    expect(spoken).toHaveLength(0);
    expect(FakeAudio.instances[0]?.paused).toBe(true);
  });

  it("ducks the tune while the spelling word plays", async () => {
    startTune();
    await flush();
    speakWord("mist", mockSynth(), audible);
    await flush();

    expect(tuneVolume()).toBe(DUCKED_VOLUME);
    FakeAudio.instances[1]?.dispatch("ended");
    expect(tuneVolume()).toBe(TUNE_VOLUME);
  });

  it("restores the tune when pronunciation is stopped", async () => {
    startTune();
    await flush();
    speakWord("mist", mockSynth(), audible);
    await flush();
    stopSpeaking(mockSynth());

    expect(tuneVolume()).toBe(TUNE_VOLUME);
  });

  it("treats near-zero samples as silent audio", () => {
    const silent = {
      numberOfChannels: 1,
      getChannelData: () => new Float32Array([0, 0.001, -0.002, 0]),
    } as AudioBuffer;
    const loud = {
      numberOfChannels: 1,
      getChannelData: () => new Float32Array([0, 0.4, -0.5, 0.1]),
    } as AudioBuffer;

    expect(peakAmplitude(silent)).toBeLessThan(0.01);
    expect(peakAmplitude(loud)).toBeGreaterThan(0.01);
  });
});
