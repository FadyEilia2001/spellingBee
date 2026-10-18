import type { PageStatus } from './pagePlan.ts'

// How far along a page is: a bar of learned words, sets done, and the page
// test score once she has taken it.
export function PageProgress({ status, tone = 'dark' }: { status: PageStatus; tone?: 'dark' | 'light' }) {
  const percent = Math.round((status.learned / status.total) * 100)
  const muted = tone === 'light' ? 'text-[#1c1406]/75' : 'text-stone-400'
  return (
    <span className="mt-2 block w-full" data-testid={`progress-${status.pageId}`}>
      <span className={`flex items-baseline justify-between text-sm font-medium ${muted}`}>
        <span>
          {status.done
            ? `✓ Done · test ${status.test?.score}/${status.test?.total}`
            : status.nextSet === null
              ? 'All sets done · page test next'
              : `${status.setsDone} of ${status.sets} sets`}
        </span>
        <span data-testid={`percent-${status.pageId}`} className="font-semibold">
          {percent}%
        </span>
      </span>
      <span
        className={`mt-1 block h-3 overflow-hidden rounded-full ${tone === 'light' ? 'bg-[#1c1406]/15' : 'bg-white/10'}`}
        aria-hidden="true"
      >
        <span
          className={`block h-full rounded-full ${status.done ? 'bg-green-400' : tone === 'light' ? 'bg-[#1c1406]/70' : 'bg-amber-300'}`}
          style={{ width: `${percent}%` }}
        />
      </span>
    </span>
  )
}
