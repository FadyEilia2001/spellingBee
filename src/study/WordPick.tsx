import { useState } from 'react'

const touchTarget =
  'min-h-[52px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200'

const wordButton =
  'w-full rounded-2xl px-2 text-center text-sm font-semibold leading-tight sm:text-base'
const wordOff = `${touchTarget} ${wordButton} border border-white/10 bg-white/5 text-stone-100`
const wordOn = `${touchTarget} ${wordButton} border border-amber-300 bg-amber-400 text-[#1c1406]`

export function WordPick({
  words,
  onPlay,
  onBack,
  onToggle,
}: {
  words: readonly string[]
  onPlay: (words: string[]) => void
  onBack: () => void
  onToggle?: (on: boolean) => void
}) {
  const [highlighted, setHighlighted] = useState<ReadonlySet<number>>(() => new Set())

  function toggle(index: number) {
    const nextOn = !highlighted.has(index)
    setHighlighted((current) => {
      const next = new Set(current)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
    onToggle?.(nextOn)
  }

  const chosen = words.filter((_, index) => highlighted.has(index))

  return (
    <>
      <p className="text-center text-xl font-semibold leading-snug text-stone-50">
        Highlight the words you want to play with.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {words.map((word, index) => {
          const on = highlighted.has(index)
          return (
            <button
              key={`${word}-${index}`}
              type="button"
              aria-pressed={on}
              className={on ? wordOn : wordOff}
              onClick={() => toggle(index)}
            >
              {word}
            </button>
          )
        })}
      </div>
      <button
        type="button"
        disabled={chosen.length === 0}
        className={`${touchTarget} mt-6 w-full rounded-2xl bg-amber-400 px-4 text-lg font-semibold text-[#1c1406] disabled:opacity-40`}
        onClick={() => onPlay(chosen)}
      >
        Play
      </button>
      <button
        type="button"
        className={`${touchTarget} mt-6 w-full rounded-2xl border border-white/10 px-4 text-base font-semibold text-stone-300`}
        onClick={onBack}
      >
        Back
      </button>
    </>
  )
}
