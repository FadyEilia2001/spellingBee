# Welcome voice, music, and effects

Ella hears a recorded greeting on each welcome screen, a looping tune under the whole app, and a short cheer when she spells a word correctly or finishes a session. The spelling-word recordings stay in the announcer voice.

## Language

The terms in `CONTEXT.md` still name the study: difficulty, page, quiz, round, page lesson, and clean spelling. This spec adds three sound terms.

**Line**:
A short recorded sentence played when a welcome screen appears, or a short cheer played after a clean spelling or a finished session.
_Avoid_: prompt, narration

**Tune**:
The single instrumental loop that plays under the welcome screens and the spelling card.
_Avoid_: soundtrack, song

**Effect**:
A short non-speech sound for a correct spelling, a miss, or the end of a session.
_Avoid_: cheer, line

## What she hears

This spec replaces the welcome sentences in `docs/superpowers/specs/2026-10-17-study-rounds-design.md`. The study rules in that spec stay as they are.

The words on a welcome screen are the words in its recording. The adventure screen shows the two sentences in this order.

| Screen | On-screen text | Recording |
| --- | --- | --- |
| Adventure | Hi Ella, choose your adventure. You can study a page or embark on a quiz. | Both sentences in one file |
| Page | Select which page you would like to study. | That sentence |
| Difficulty | Please select the difficulty of your quiz. | That sentence |
| Word count | How many words would you like? | That sentence |

The buttons stay Study a page, Quiz, Page 1 through Page 6, Short, Medium, Long, 5 words, 10 words, and 15 words. Choosing a word count still starts the round. Choosing a page opens the screen in docs/superpowers/specs/2026-10-18-word-pick-design.md. Back still returns to the previous screen.

Each line plays once when its screen appears. Back, or any other move to a different welcome screen, stops the line that is playing and plays the line for the screen she landed on. A line that has already finished does not replay while she stays on that screen. A line that the browser blocked is not finished, so the first tap or key press may play it.

During a session:

- A correct spelling plays the correct effect and the line “Yes!”
- A miss starts the miss effect, then reveals and speaks the word once, as it does now, without waiting for the effect to finish. A miss has no spoken line.
- When a round or a page lesson ends, the summary plays the finished effect and the line “You finished!” The summary counts and the button back to the adventure stay as they are.

## Tune

One instrumental loop plays from the welcome screens through the spelling card and the summary. It has no singing. It keeps its place in the loop when she moves between screens. It does not start over when a session ends.

While a line or a spelling word is playing, the tune volume is 0.05. Otherwise it is 0.22. When that voice ends, the volume returns to 0.22. Line recordings play at volume 1. Effects play at volume 0.5 and do not change the tune volume.

The pause control sits in the star row, on the welcome screens, the spelling card, and the summary. Its accessible name is “Pause music” while the tune is playing and “Play music” while it is paused. Pausing affects only the tune. Lines, effects, and spelling words still play. The choice is saved under the localStorage key `spellingBee.music` as `"playing"` or `"paused"`. It is separate from stars and streaks. The default, including a missing or unreadable value, is `"playing"`.

## When the browser blocks sound

If the first attempt to play is blocked, the app waits for her next tap or key press. That gesture plays the line for the screen she is on and starts the tune, unless `spellingBee.music` is `"paused"`. A later screen does not wait again once sound has started. If she pauses the tune before sound has started, the later gesture plays the line and leaves the tune paused.

## Files

Spoken lines use `gpt-4o-mini-tts` and the `coral` voice. The instruction is: “You are a warm, enthusiastic spelling coach talking to a child. Speak clearly in American English, with a smile. Say only the words you are given.”

| Id | File | Spoken text |
| --- | --- | --- |
| adventure | `public/audio/lines/adventure.mp3` | Hi Ella, choose your adventure. You can study a page or embark on a quiz. |
| page | `public/audio/lines/page.mp3` | Select which page you would like to study. |
| difficulty | `public/audio/lines/difficulty.mp3` | Please select the difficulty of your quiz. |
| count | `public/audio/lines/count.mp3` | How many words would you like? |
| yes | `public/audio/lines/yes.mp3` | Yes! |
| finished | `public/audio/lines/finished.mp3` | You finished! |

Spelling words stay in `public/audio/<slug>.mp3`, generated with the `marin` voice and this instruction: “You are a spelling bee announcer. Pronounce the word clearly and naturally in American English. Speak slightly slower than normal. Say only the word. Do not spell it and do not add commentary.” This work does not regenerate a word file that is already present.

Effects and the tune are files shipped with the app. They are not generated by the speech model.

| Id | File | Role |
| --- | --- | --- |
| correct | `public/sfx/correct.mp3` | Correct spelling |
| miss | `public/sfx/miss.mp3` | Miss |
| complete | `public/sfx/complete.mp3` | Session summary |
| tune | `public/music/loop.mp3` | Looping instrumental |

The tune is CC0, has no vocals, and is at most 60 seconds. `public/music/CREDITS.txt` records its title, author, license, and source URL.

## Pieces

`scripts/generate-audio.ts` is the development-only generator. `npm run generate-audio` reads `OPENAI_API_KEY` from `.env`, writes any missing spelling-word MP3s, and writes any missing line MP3s. A file that is already present is skipped. Word calls use `marin`. Line calls use `coral` and the coach instruction above. The key stays out of git.

`src/study/soundtrack.ts` is the only player for lines, effects, and the tune. The welcome screen asks it to play the line for the current step. The spelling card asks it for the correct effect and “Yes!”, or for the miss effect. The summary asks it for the finished effect and “You finished!” Starting a line stops the previous line. Starting a spelling word stops a line, so a welcome sentence does not talk over a word. The miss effect does not stop the word that follows it. “Yes!” and the correct effect may play together. “You finished!” and the finished effect may play together.

The existing spelling-word player keeps its MP3-first behavior and its browser-speech fallback. While a word recording is playing, it tells the soundtrack to hold the tune at 0.05, and to restore 0.22 when the word ends or is stopped.

The pause control reads and writes `spellingBee.music` through the soundtrack. The star row renders that control.

## When a file cannot play

- A line that cannot play is spoken with the browser voice, in American English, at the same rate the spelling fallback already uses. The tune still ducks for that fallback.
- An effect that cannot play is skipped.
- A tune that cannot play stays silent. Pause and Play music still switch the saved choice.
- A failed sound does not block spelling, navigation, or scoring.

## Tests

- The adventure screen shows both sentences and plays `adventure`. Study a page plays `page`. Quiz plays `difficulty`. Short, Medium, or Long plays `count`. Back from the word-count screen plays `difficulty` and does not start a round.
- A correct spelling plays `correct` and `yes`, and does not speak the spelling word by itself.
- A miss plays `miss`, still reveals the word, and still speaks that word once.
- The summary plays `complete` and `finished`.
- Pause music saves `"paused"` and the tune does not continue. The next load shows Play music. Play music saves `"playing"`.
- A playing line or spelling word sets the tune volume to 0.05, and the volume returns to 0.22 when that voice ends.
- A missing line file falls back to browser speech of that sentence. A missing effect is skipped.
