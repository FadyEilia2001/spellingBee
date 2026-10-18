export function nextIndex(current: number, length: number): number {
  return (current + 1) % length;
}

export function previousIndex(current: number, length: number): number {
  return (current - 1 + length) % length;
}

export function slotCount(word: string): number {
  return Array.from(word).length;
}
