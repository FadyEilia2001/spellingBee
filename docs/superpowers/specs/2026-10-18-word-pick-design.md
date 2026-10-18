# Word pick

After Ella chooses a page, she can study that whole page or highlight some of its words and play those. A highlighted set is a word pick. It stays in page order and follows the same clean-spelling rules as a page lesson.

## Language

The terms in `CONTEXT.md` name this study. This spec adds one.

**Word pick**:
A lesson of the words she highlighted on one page, kept in that page's order, which continues until every highlighted word has a clean spelling.
_Avoid_: custom quiz, partial page, trunk

## How a page starts

This spec replaces one sentence in `docs/superpowers/specs/2026-10-18-welcome-audio-design.md`: choosing a page no longer starts that page lesson. The quiz path, the spoken lines, the tune, and the effects stay as they are.

Study a page still leads to Page 1 through Page 6, and that screen still says "Select which page you would like to study." and plays `page`. Tapping a page opens a quiet screen:

> Select words or study the whole page.

Two buttons:

| Button | What it starts |
| --- | --- |
| Study the whole page | The page lesson for the page she just chose, in page order |
| Select words | The word list for that same page |

Back returns to the page list and plays `page` again. Neither new screen plays a line. Arriving on either one stops whatever line is still playing.

## The word list

The list shows every word on the chosen page, in page order, one word per button. Nothing starts highlighted.

The sentence on the screen is "Highlight the words you want to play with."

- Tap a plain word to highlight it. Tap a highlighted word to clear it.
- A highlighted word is pressed (`aria-pressed="true"`) and uses the amber selected style. A plain word is not pressed.
- Play is the amber button. It is disabled until at least one word is highlighted.
- Play starts a word pick of the highlighted words, in page order. Tap order does not matter.
- Back returns to "Select words or study the whole page." and clears every highlight. Opening Select words again starts from a plain list.

Highlighting every word on the page starts the same words as Study the whole page. The app does not special-case that.

## How a word pick plays

A word pick uses the page-lesson queue from `docs/superpowers/specs/2026-10-17-study-rounds-design.md`. The spelling card is the page-lesson card: Hear Word, three tries, colored letters, In a Sentence, memorized and to go, and Next Word only after the turn is finished. The counts are of the highlighted words.

A word that is not a clean spelling comes back. The pick ends when every highlighted word is clean or set aside. One highlighted word uses the existing single-word rule: it returns until it is clean or set aside.

The summary and Back to study choices stay as they are. Stars, the streak, and saved progress stay as they are.

## Pieces

The choice screen keeps the adventure, page, difficulty, and word-count steps. After a page tap it stores that page and shows the two-button screen. It does not start a lesson there.

A word-pick list receives that page's words in order. It reports the highlighted words in that same order. It does not know page ids, the queue, or audio.

Study the whole page still asks the app to start that page. Play asks the app to start the highlighted words. Both go through the existing page-lesson queue.

## Tests

- Tapping Page 2 shows "Select words or study the whole page." and does not start a lesson. The page line stops, and no new line plays.
- Study the whole page starts Page 2 in page order.
- Back from that screen returns to the page list and plays `page`.
- Select words lists Page 2's words in page order, with Play disabled.
- Highlighting a later word and then an earlier word, then Play, starts those two in page order.
- Clearing the last highlight disables Play again.
- Back from the list does not start a lesson, and the next visit starts with no highlights.
- The quiz path still starts only after a difficulty and a word count.
- A word pick shows memorized and to go for the highlighted words, and a missed word comes back.

## Out of scope

- A spoken line for either new screen.
- Remembering which words were highlighted.
- Highlighting words from more than one page.
- Changing the queue, the quiz, the spelling card, or the recordings.
