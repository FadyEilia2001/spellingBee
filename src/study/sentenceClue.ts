export const SENTENCE_BLANK = "________";

function fold(value: string): string {
  return value.toLocaleLowerCase("en-US");
}

function isLetter(character: string): boolean {
  return /\p{L}/u.test(character);
}

export function replaceTarget(text: string, word: string, replacement: string): string {
  const foldedWord = fold(word);
  if (foldedWord.length === 0 || foldedWord.length !== word.length) return text;

  const foldedText = fold(text);
  let result = "";
  let cursor = 0;

  while (cursor < text.length) {
    const found = foldedText.indexOf(foldedWord, cursor);
    if (found === -1) {
      result += text.slice(cursor);
      break;
    }

    const end = found + foldedWord.length;
    const before = found > 0 ? (text[found - 1] ?? "") : "";
    const after = end < text.length ? (text[end] ?? "") : "";
    const insideWord = (before !== "" && isLetter(before)) || (after !== "" && isLetter(after));

    if (insideWord) {
      result += text.slice(cursor, found + 1);
      cursor = found + 1;
      continue;
    }

    result += text.slice(cursor, found);
    result += replacement;
    cursor = end;
  }

  return result;
}

export function containsTarget(text: string, word: string): boolean {
  return replaceTarget(text, word, "\u0000") !== text;
}

export function maskSentence(sentence: string, word: string): string {
  return replaceTarget(sentence, word, SENTENCE_BLANK);
}
