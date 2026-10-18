# Welcome voice, music, and effects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ella hears recorded welcome lines and cheers in a kid voice, a looping tune she can pause, and short effects for a correct word, a miss, and the end of a session.

**Architecture:** `lines.ts` names the files and the saved music choice. `soundtrack.ts` plays lines, effects, and the tune, ducks the tune for a voice, and falls back to browser speech for a missing line. The welcome screen and the spelling card call that player. A dev script generates the six line MP3s with OpenAI. The tune and effects are CC0 files shipped in `public/`.

**Tech Stack:** Vite, React 19, TypeScript, Vitest, Testing Library, OpenAI `gpt-4o-mini-tts`, ffmpeg.

**Spec:** `docs/superpowers/specs/2026-10-18-welcome-audio-design.md`

---

### Task 1: Line catalog and music preference

**Files:**
- Create: `src/study/lines.ts`
- Test: `src/study/lines.test.ts`

- [ ] **Step 1: Write the failing test** in `src/study/lines.test.ts` for the six line URLs and texts, the three effect URLs, tune URL `/music/loop.mp3`, volumes 1 / 0.5 / 0.22 / 0.05, and `readMusicPreference` returning `playing` unless the stored value is exactly `paused`.

- [ ] **Step 2: Run** `npx vitest run src/study/lines.test.ts` and confirm the module is missing.

- [ ] **Step 3: Implement** `src/study/lines.ts` with `LINES`, `EFFECTS`, `TUNE_URL`, the four volume constants, `MUSIC_STORAGE_KEY = 'spellingBee.music'`, `readMusicPreference`, and `writeMusicPreference`.

- [ ] **Step 4: Run the test again.** Expected: PASS.

- [ ] **Step 5: Commit** the catalog.

### Task 2: Soundtrack player

**Files:**
- Create: `src/study/soundtrack.ts`
- Test: `src/study/soundtrack.test.ts`

- [ ] **Step 1: Write failing tests** using a fake `Audio` and fake `speechSynthesis`:
  - `playLine('adventure')` plays `/audio/lines/adventure.mp3` at volume 1 and ducks an already started tune to 0.05.
  - Ending that line returns the tune to 0.22.
  - `playEffect('correct')` plays `/sfx/correct.mp3` at volume 0.5 and does not change the tune volume.
  - A rejected line `play()` speaks the adventure sentence at rate 0.82.
  - `pauseTune()` saves `paused` and pauses the tune. `resumeTune()` saves `playing`.
  - `startTune()` does not call `play` when the saved choice is `paused`.

- [ ] **Step 2: Run** `npx vitest run src/study/soundtrack.test.ts` and confirm failure.

- [ ] **Step 3: Implement** `soundtrack.ts`. One tune element with `loop = true`. Starting a line stops the previous line. A `NotAllowedError` remembers the line and retries it, plus the tune if it is not paused, on the next `pointerdown` or `keydown`. Any other play failure speaks the line. Effects that fail are ignored. Ducking is a counter so a line and a spelling word can overlap safely.

- [ ] **Step 4: Run the soundtrack tests.** Expected: PASS.

- [ ] **Step 5: Commit** the player.

### Task 3: Duck the tune while a spelling word plays

**Files:**
- Modify: `src/study/speech.ts`
- Test: `src/study/speech.test.ts`

- [ ] **Step 1: Add a failing test** that starts the tune, calls `speakWord('mist')`, sees volume 0.05, dispatches `ended`, and sees volume 0.22. Add another test that `stopSpeaking()` restores the volume. Keep the existing MP3 and fallback tests passing.

- [ ] **Step 2: Run** `npx vitest run src/study/speech.test.ts`.

- [ ] **Step 3: Implement.** `speakWord` calls `stopLine()` before the word. A successful word recording or a browser-speech fallback calls `duckTune()` once and `unduckTune()` when that voice ends or `stopSpeaking()` runs.

- [ ] **Step 4: Run speech and soundtrack tests.** Expected: PASS.

- [ ] **Step 5: Commit** the ducking.

### Task 4: Welcome screens say and play the lines

**Files:**
- Modify: `src/study/ChoiceScreen.tsx`
- Modify: `src/study/ChoiceScreen.test.tsx`
- Modify: `src/App.test.tsx` where it looks for the old greeting

- [ ] **Step 1: Update tests** so the adventure screen shows both sentences, Study a page shows “Select which page you would like to study.”, Quiz shows “Please select the difficulty of your quiz.”, and a difficulty shows “How many words would you like?” Mock `playLine` and expect `adventure`, then `page`, then `difficulty`, then `count` when Back returns from the word count.

- [ ] **Step 2: Run** `npx vitest run src/study/ChoiceScreen.test.tsx src/App.test.tsx` and confirm the new sentences fail.

- [ ] **Step 3: Change the four prompts** and call `playLine` in an effect when the step changes. The buttons and the start behavior stay the same.

- [ ] **Step 4: Run those tests.** Expected: PASS.

- [ ] **Step 5: Commit** the welcome copy and playback.

### Task 5: Cheers, effects, and the pause button

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Extend App tests.** Mock the soundtrack. A correct spelling calls `playEffect('correct')` and `playLine('yes')` and does not call `speakWord`. A miss calls `playEffect('miss')` and still calls `speakWord` with that word. Finishing the five-word round calls `playEffect('complete')` and `playLine('finished')`. The star card has “Pause music”; clicking it calls `pauseTune` and the next render of a fresh app shows “Play music” after the preference is written. The test can call the real `writeMusicPreference` if the mock stores it, or assert the button label from component state.

- [ ] **Step 2: Run** `npx vitest run src/App.test.tsx` and confirm the new assertions fail.

- [ ] **Step 3: Implement.** On a locked correct guess, play the correct effect and “Yes!”. On a miss, play the miss effect and then `speakWord`. When `summary` becomes non-null, play the complete effect and “You finished!”. Call `startTune()` once on mount. Add the pause button in the star card.

- [ ] **Step 4: Run** `npm test`. Expected: all PASS.

- [ ] **Step 5: Commit** the game sounds and pause button.

### Task 6: Generate the six line recordings

**Files:**
- Create: `scripts/generate-audio.ts`
- Create: `public/audio/lines/*.mp3`

- [ ] **Step 1: Write the script** so `npm run generate-audio` reads `OPENAI_API_KEY` from `.env`, skips any MP3 that already exists, writes spelling words with voice `marin` and the announcer instruction from the spec, and writes `LINES` with voice `coral` and the coach instruction from the spec.

- [ ] **Step 2: Run** `npm run generate-audio` from the study-rounds worktree with the existing key. Expected: 450 word files skipped, 6 line files written, 0 failed.

- [ ] **Step 3: Commit** the script and the six MP3s. Do not commit `.env`.

### Task 7: Ship the tune and the three effects

**Files:**
- Create: `public/music/loop.mp3`
- Create: `public/music/CREDITS.txt`
- Create: `public/sfx/correct.mp3`
- Create: `public/sfx/miss.mp3`
- Create: `public/sfx/complete.mp3`
- Create: `public/sfx/CREDITS.txt`

- [ ] **Step 1: Download** Town Theme by cynicmusic, CC0, from `https://opengameart.org/sites/default/files/TownTheme.mp3` and `https://opengameart.org/content/town-theme-rpg`. Trim the first 60 seconds to `public/music/loop.mp3`.

- [ ] **Step 2: Download** Kenney Interface Sounds from `https://kenney.nl/media/pages/assets/interface-sounds/fa43c1dd4d-1677589452/kenney_interface-sounds.zip` and Music Jingles from `https://kenney.nl/media/pages/assets/music-jingles/f37e530b9e-1677590399/kenney_music-jingles.zip`. Convert `confirmation_001.ogg` to `correct.mp3`, a soft negative interface sound to `miss.mp3`, and one short positive jingle to `complete.mp3`.

- [ ] **Step 3: Write both credit files** with title, author, license, and source URL.

- [ ] **Step 4: Commit** the audio files and credits.

### Task 8: Check the app

- [ ] **Step 1: Run** `npm test` and `npx tsc -b --pretty false`.

- [ ] **Step 2: In the browser,** open the adventure screen and confirm both sentences, the pause button, the page prompt, the difficulty prompt, and the word-count prompt. Start a short quiz, spell the word correctly, and confirm the round can still advance.
