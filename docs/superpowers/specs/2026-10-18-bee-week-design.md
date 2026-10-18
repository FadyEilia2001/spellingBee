# Bee week: the next iteration

The family plays for one week before the competition. Everything for solo play is saved on Ella's iPad in localStorage (same pattern as `progress.ts`). The home server stays the family match only. Scoring and rules of the family match do not change.

## 1. A turn that teaches
- The word is spoken when each turn starts (solo and family). The button reads "Hear it again".
- Past tries sit above the letter boxes; the empty boxes hide once the turn is over.
- After a missed turn, "You wrote / It's spelled" lines up her last try against the word (`compareSpelling.ts`), marking missing, extra and wrong letters.
- A miss that still has tries left plays the line "Close! Try again."
- When the turn is over, a big amber Next button appears and Enter moves on.
- Letter boxes shrink for words over 10 letters; hyphens are pre-filled like spaces.
- Summary: "set aside" becomes "still practicing" and those words are listed.
- `index.html`: title "Spelling Bee", pinch zoom allowed, manifest + home-screen icon. `navigator.storage.persist()` is requested.

## 2. Quit and resume
- "I'm done for now" (with a confirm) ends the session and shows the summary of what she finished.
- The session (queue, mode, label, stars so far) is saved after every word to `spellingBee.session`, and cleared when it ends. The home screen offers "Keep going: <label> · N left".
- A page offers sets of 10 in page order ("Words 1–10" …), each with a ✓ when every word in it is learned, plus "Whole page" and "Select words".

## 3. Bee mode
- Home choice "Bee mode": pick One, Two or Three Bee (the `tier` in the data), then 5, 10 or 15 words.
- Turn: word spoken automatically, no letter boxes, one try, letters can't be deleted, 60-second timer that submits what's typed when it runs out (empty = miss).
- Ask buttons: Say it again, Definition, Sentence (masked), Part of speech, Origin. `partOfSpeech` and `origin` are added to every entry.
- Correct = 3 stars. Missed words don't come back in the round; the summary has "Practice these", which starts a lesson of them.

## 4. Sturdier family match
- Server pings every 10s and terminates sockets that don't answer, so a sleeping phone leaves the match the way a closed one already does.
- The client reconnects with backoff (and right away when the page becomes visible), remembers its seat in sessionStorage and sits again. It shows "Reconnecting…" meanwhile.
- "Start over" asks for confirmation.
- The seat picker always offers "Practice on my own".

## 5. Reasons to come back
- Daily streak: a day counts once she finishes 10 words in solo play. The header shows the days in a row.
- Learned words: one clean spelling in a lesson or round, or a correct Bee mode spelling. Each page shows "learned / total".
- My practice words: missed and not learned yet. A home button practices up to 10 of them.
- Star rewards are left out for this week.

## Testing
Each new pure module (`compareSpelling`, `savedSession`, `daily`, `learned`) gets a small vitest file; App, ChoiceScreen and FamilyMatch tests are updated for the new flow; server heartbeat gets a test in `duel-room.test.ts`.
