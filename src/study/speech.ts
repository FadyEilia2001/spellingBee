import { spellingAudioUrl } from "./audioFile.ts";

export const SPEECH_RATE = 0.82;

let activeUtterance: SpeechSynthesisUtterance | null = null;
let currentAudio: HTMLAudioElement | null = null;
let pronunciationId = 0;

function englishVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  return (
    voices.find((voice) => voice.lang === "en-US") ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith("en"))
  );
}

function silenceAudio(audio: HTMLAudioElement | null): void {
  if (!audio) return;
  audio.pause();
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
  utterance.onend = () => {
    if (activeUtterance === utterance) {
      activeUtterance = null;
    }
  };

  synth.resume();
  synth.speak(utterance);
}

export function speakWord(
  word: string,
  synth: SpeechSynthesis = window.speechSynthesis,
): void {
  const pronunciation = ++pronunciationId;
  silenceAudio(currentAudio);

  if (synth.speaking || synth.pending) {
    synth.cancel();
  }

  let audio: HTMLAudioElement;
  try {
    audio = new Audio(spellingAudioUrl(word));
  } catch {
    speakText(word, SPEECH_RATE, synth);
    return;
  }

  currentAudio = audio;
  let settled = false;

  const fallback = () => {
    if (settled || pronunciation !== pronunciationId || currentAudio !== audio) return;
    settled = true;
    currentAudio = null;
    speakText(word, SPEECH_RATE, synth);
  };

  audio.addEventListener("error", fallback);
  void Promise.resolve(audio.play()).then(
    () => {
      if (pronunciation !== pronunciationId || currentAudio !== audio) {
        audio.pause();
        return;
      }
      settled = true;
    },
    fallback,
  );
}

export function stopSpeaking(synth: SpeechSynthesis = window.speechSynthesis): void {
  pronunciationId += 1;
  activeUtterance = null;
  silenceAudio(currentAudio);
  currentAudio = null;
  if (synth.speaking || synth.pending) {
    synth.cancel();
  }
}
