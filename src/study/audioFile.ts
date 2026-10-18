export const SPELLING_AUDIO_DIRECTORY = "audio";

export function spellingAudioSlug(word: string): string {
  const slug = word
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!slug) {
    throw new Error(`Cannot build an audio filename for "${word}"`);
  }

  return slug;
}

export function spellingAudioFilename(word: string): string {
  return `${spellingAudioSlug(word)}.mp3`;
}

export function spellingAudioUrl(word: string): string {
  return `/${SPELLING_AUDIO_DIRECTORY}/${spellingAudioFilename(word)}`;
}
