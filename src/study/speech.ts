import { spellingAudioUrl } from "./audioFile.ts";
import { duckTune, stopLine, unduckTune } from "./soundtrack.ts";

export const SPEECH_RATE = 0.82;
export const MIN_AUDIO_PEAK = 0.01;

export type AudioHealth = "ok" | "unusable";
export type CheckAudio = (url: string) => Promise<AudioHealth>;

let activeUtterance: SpeechSynthesisUtterance | null = null;
let currentAudio: HTMLAudioElement | null = null;
let pronunciationId = 0;
let wordDucked = false;

function holdWordDuck(): void {
  if (wordDucked) return;
  wordDucked = true;
  duckTune();
}

function releaseWordDuck(): void {
  if (!wordDucked) return;
  wordDucked = false;
  unduckTune();
}

function englishVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  return (
    voices.find((voice) => voice.lang === "en-US") ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith("en"))
  );
}

function silenceAudio(audio: HTMLAudioElement | null): void {
  if (!audio) return;
  audio.pause();
  if (audio.src.startsWith("blob:")) {
    URL.revokeObjectURL(audio.src);
  }
  audio.src = "";
}

function speakText(text: string, rate: number, synth: SpeechSynthesis): void {
  if (synth.speaking || synth.pending) {
    synth.cancel();
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = rate;
  utterance.lang = "en-US";

  const voice = englishVoice(synth.getVoices());
  if (voice) {
    utterance.voice = voice;
  }

  activeUtterance = utterance;
  holdWordDuck();
  utterance.onend = () => {
    if (activeUtterance === utterance) {
      activeUtterance = null;
      releaseWordDuck();
    }
  };

  synth.resume();
  synth.speak(utterance);
}

export function peakAmplitude(buffer: AudioBuffer): number {
  let peak = 0;
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let index = 0; index < data.length; index += 1) {
      const sample = Math.abs(data[index] ?? 0);
      if (sample > peak) peak = sample;
    }
  }
  return peak;
}

export async function checkSpellingAudio(url: string): Promise<AudioHealth> {
  try {
    const response = await fetch(url);
    if (!response.ok) return "unusable";
    const bytes = await response.arrayBuffer();
    const context = new AudioContext();
    try {
      const decoded = await context.decodeAudioData(bytes.slice(0));
      return peakAmplitude(decoded) >= MIN_AUDIO_PEAK ? "ok" : "unusable";
    } finally {
      void context.close();
    }
  } catch {
    return "unusable";
  }
}

function playGeneratedAudio(
  word: string,
  url: string,
  pronunciation: number,
  synth: SpeechSynthesis,
): void {
  let audio: HTMLAudioElement;
  try {
    audio = new Audio(url);
  } catch {
    speakText(word, SPEECH_RATE, synth);
    return;
  }

  currentAudio = audio;
  let usedFallback = false;

  const fallback = () => {
    if (usedFallback || pronunciation !== pronunciationId || currentAudio !== audio) return;
    usedFallback = true;
    silenceAudio(audio);
    currentAudio = null;
    speakText(word, SPEECH_RATE, synth);
  };

  audio.addEventListener("error", fallback);
  audio.addEventListener("ended", () => {
    if (currentAudio !== audio) return;
    currentAudio = null;
    releaseWordDuck();
  });
  void Promise.resolve(audio.play()).then(
    () => {
      if (pronunciation !== pronunciationId || currentAudio !== audio) {
        audio.pause();
        return;
      }
      holdWordDuck();
    },
    fallback,
  );
}

export function speakWord(
  word: string,
  synth: SpeechSynthesis = window.speechSynthesis,
  checkAudio: CheckAudio = checkSpellingAudio,
): void {
  const pronunciation = ++pronunciationId;
  const url = spellingAudioUrl(word);
  stopLine();
  releaseWordDuck();
  silenceAudio(currentAudio);
  currentAudio = null;

  if (synth.speaking || synth.pending) {
    synth.cancel();
  }

  void checkAudio(url).then((health) => {
    if (pronunciation !== pronunciationId) return;
    if (health === "unusable") {
      speakText(word, SPEECH_RATE, synth);
      return;
    }
    playGeneratedAudio(word, url, pronunciation, synth);
  });
}

export function stopSpeaking(synth: SpeechSynthesis = window.speechSynthesis): void {
  pronunciationId += 1;
  activeUtterance = null;
  silenceAudio(currentAudio);
  currentAudio = null;
  releaseWordDuck();
  if (synth.speaking || synth.pending) {
    synth.cancel();
  }
}
