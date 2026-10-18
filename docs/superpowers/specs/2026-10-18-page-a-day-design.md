# Page a day

Six days, six pages. Solo practice centers on one page per day; the family match is unchanged.

## Page status
For each page, from what is saved on the iPad:
- **learned**: words on the page spelled cleanly at least once.
- **sets done**: sets of 10 where every word is learned.
- **page test**: the last score, if she has taken it.
- **done**: every word learned *and* the page test taken.

## Today's page
The first page that is not done. The home screen leads with one big button, "Today: Page N", which opens:
1. a **warm-up** first, once per day: up to 5 practice words from earlier pages, if there are any;
2. otherwise the **next unfinished set** of today's page;
3. once every set is done, the **page test**.

## Page buttons
Each page button shows a large progress bar with a percentage, "N of M sets", a **Today** badge on today's page, and **✓ Done · 71/76** once the page is done.

## Page test
The whole page, shuffled, one try each (study-style letter boxes, no clock). A miss is set aside and goes to her practice words. It can be paused and resumed like any lesson. Finishing it records the score and celebrates the page.

## After a set
The summary shows the page's progress bar and offers the next step: "Next set", "Take the page test", or, after a warm-up, "On to Page N".

## Storage
`spellingBee.pageTests` holds `{ [pageId]: { score, total } }`; `spellingBee.warmup` holds the local day of the last warm-up. Warm-ups and practice runs never replace the paused spot.
