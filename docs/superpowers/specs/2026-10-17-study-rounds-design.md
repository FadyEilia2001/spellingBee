# Study rounds and page lessons

A child picks either a length difficulty or one original page, then spells until every word in that session has been correct on a first try. A word that is not first-try correct comes back after three other words.

## Language

The terms in `CONTEXT.md` are the ones this spec uses: difficulty, page, round, page lesson, and clean spelling.

## How a study starts

The app opens on a choice screen. It does not start a round by itself.

**Practice a round**

1. She picks a difficulty: Short (3–5 letters), Medium (6–8 letters), or Long (9 or more letters).
2. She picks how many different words: 5, 10, or 15.
3. Those words are shuffled from that difficulty and no others.

**Study a page**

She picks one of the six pages and studies every word on it, in page order:

| Page | Words | First word | Last word |
| --- | ---: | --- | --- |
| One Bee | 76 | ran | money |
| Two Bee, page 1 | 74 | cabin | soared |
| Two Bee, page 2 | 76 | buttons | piñata |
| Three Bee, page 1 | 67 | newt | credenza |
| Three Bee, page 2 | 74 | territory | Aeolus |
| Three Bee, page 3 | 83 | comprehensible | Cappadocia |

The spelling card stays: Hear Word, three tries, colored letters, and In a Sentence. She moves only forward, and only after the current turn is finished. Previous Word is not part of a round or a page lesson.

## Letter length

A word's difficulty comes from how many letters it has. Spaces and hyphens are ignored. `cul-de-sac` has 8 letters and is Medium. `a cappella` has 9 letters and is Long. The spelling boxes still show spaces and hyphens, as they do now.

Each word belongs to one difficulty. Short words are 3–5 letters (92 words), Medium words are 6–8 letters (184 words), and Long words are 9 or more letters (174 words). `cul-de-sac` is the word that moves into Medium once spaces and hyphens are ignored.

## When a word comes back

A turn still allows three tries.

- A correct first try is a clean spelling. That word is finished for this session.
- A correct second try, a correct third try, or a miss is not clean. The word returns after three other words, as a fresh turn with three new tries.
- If fewer than three words are still waiting, it waits behind those words and then returns.
- If it is the only word left, the next turn is that same word.
- A word that has returned 4 times, and is still not clean on that fourth return, is shown and set aside. It does not return a fifth time. Counting the first appearance, a word is seen at most five times.

The screen shows how many words are clean out of the words she started with, such as "4 of 10". That number does not grow when a word returns.

The session ends when every starting word is either clean or set aside. A round can take more turns than the number she picked, because returns are extra turns.

## What is remembered

Stars and the streak still save on the device.

- A first try earns 3 stars and adds 1 to the streak.
- A second try earns 2 stars, a third try earns 1 star, and a miss earns 0 stars.
- Any turn that is not a clean spelling resets the current streak to 0. The best streak is kept.
- A word can earn stars again on a later turn in the same session.

The next round is a fresh pick from the difficulty she chooses. The app does not skip mastered words and does not fill a round from a review queue. A page lesson always starts at the first word of that page.

An already saved star total, current streak, best streak, and session history are kept. A saved review queue or mastered list is ignored.

The summary shows the stars earned in this session and three counts that add up to the words she started with: clean on the first appearance, clean after coming back, and set aside. A button returns to the choice screen. There is no Review missed words button. A miss still reveals the spelling the way it does now. Setting a word aside does not add another reveal.

## Pieces

- Word entries keep the spelling, definition, sentence, and bee level, and record which of the six pages the word is on. Page membership follows the current list order and the counts in the table above.
- Difficulty is calculated from letter length. It is not stored as the bee level.
- The queue is a pure function of the starting words and the result of each turn. The screen asks the queue what comes next. The screen does not decide spacing, the cap, or when the session is over.
- Progress records stars, streaks, and finished sessions. It does not choose the words in a round.

## Edge cases

- If a chosen count is larger than the difficulty, the round uses every word in that difficulty. The 5, 10, and 15 choices all fit the current bands.
- Unreadable saved progress loads as empty progress.
- Older saved progress that has a review queue or mastered list still loads its stars, streaks, and history.
- The four-return cap is what lets a session finish when one word is never a first try.

## Tests

- A first try removes the word. A later success or a miss puts it behind three words.
- With fewer than three words waiting, it goes behind those words. With none waiting, it is the next turn.
- The fourth return that is still not clean sets the word aside, and the session can end.
- A round starts with the chosen number of different words, using an injected random function so the shuffle can be tested. A page lesson starts with that page's words in page order.
- Letter bands match the counts above, including `cul-de-sac` and `a cappella`.
- The six pages match the counts and the first and last words in the table.
- Stars, streak reset, and loading old saved progress behave as written above.
- The choice screen can start a round and a page lesson. A scripted miss brings that word back. The summary can return to the choice screen.

## Out of scope

- Scheduling a word for a future day.
- Changing pronunciation, the sentence clue, or the three-try coloring.
- Changing the words, definitions, or sentences.
