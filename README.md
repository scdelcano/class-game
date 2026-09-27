# My Classroom

A 3D pretend-teacher game (Three.js + Vite, installable PWA) for an Android tablet.

## Commands

```bash
npm install        # once
npm run dev        # dev server on http://localhost:5173 (no service worker)
npm run build      # production build into dist/
npm run preview    # serve dist/ on http://localhost:4173 (with service worker)
npm run icons      # redraw the app icons in public/icons/
npm test           # check voice commands, names, spoken numbers and the learning engine
```

## Testing on the Android tablet

The microphone only works on `https://` pages or on `localhost`.

**Quick loop over USB (localhost counts as secure):**
1. On the tablet: Settings → About → tap *Build number* 7 times → Developer options → turn on *USB debugging*. Plug it in and accept the prompt.
2. On the computer: `npm run dev`, then `adb reverse tcp:5173 tcp:5173`.
3. On the tablet in Chrome, open `http://localhost:5173/mic-test.html`.

**Real test (HTTPS + home-screen icon):** deploy `dist/` (see below), open the URL in
Chrome on the tablet, then ⋮ menu → *Add to Home screen* → *Install*. Launch it from the icon
and open the microphone test again. The checklist should say "Opened from the home screen".

## Deploying

`base: './'` in `vite.config.js` means the same `dist/` works at a site root (Netlify) or
in a sub-folder (GitHub Pages).

Hosted on **Netlify**:

- **First time:** `npm run build`, then drag the `dist` folder onto https://app.netlify.com/drop
  (you need to be logged in so the site is kept).
- **Updates (same URL):** `npm run build`, then in Netlify open the site → *Deploys* and drag the
  `dist` folder onto the "drag and drop your site output folder" box.
- The installed app picks up the new version the next time it's opened with internet
  (sometimes it takes two launches). `public/_headers` tells Netlify never to cache `sw.js`.

Testing on a computer: in the dev server console, `voice.simulate('okay class sit down')` acts as if
it was spoken, and `advance(10)` fast-forwards the game 10 seconds.

URL options for testing: `?fps` shows a frame-rate counter, `?quality=low` or `?quality=high`
forces the graphics level (default is automatic).

## Layout

```
index.html, mic-test.html   page entry points
public/                     copied as-is: manifest, service worker, icons
scripts/make-icons.mjs      procedural icon generator
src/main.js                 entry: who's playing? (profile picker), then starts the game
src/game/app.js             one player's game: scene, camera, input, screens, main loop
src/pwa.js                  service worker registration, installed-app detection
src/core/                   renderer (auto quality), loop, camera-rig (pan/pinch/tap),
                            picker (what did I tap?), anim (wiggle/squash/hop), random, emitter
src/world/layout.js         where everything goes: room size, seats, obstacles, fun spots
src/world/nav.js            walking map + A* paths around furniture
src/world/classroom.js      assembles the room, tappable props, seats API
src/world/room.js           floor, walls, windows, door, sunlight
src/world/furniture/        desks, board, storage (bookshelf, cubbies), decor
src/world/shapes.js         shared geometries + bake() that merges still meshes
src/world/materials.js      palette + cartoon (toon) materials
src/world/textures.js       canvas-drawn pictures: board, posters, rug, clock…
src/characters/             kid, plush, truck, tank builders; character.js (animation:
                            idle, walk/drive, wave, hop, sit, talk); portraits.js; options.js
                            (every hairstyle/color/animal — add new choices there)
src/students/               student.js (saved record), roster.js (class list + saving),
                            seeds.js (6 examples), lines.js (everything students say),
                            actor.js (walking/driving, turning, making way),
                            class-actors.js (free play, going to seats, chatting, taps)
src/game/session.js         playtime <-> class time
src/game/attendance.js      school day, absent students, checkmarks (saved), calling students
src/game/lesson.js          Math time: teach turns (judge a student) and direct turns (answer)
src/game/reading-lesson.js  Reading time: students read/spell (the teacher judges and fixes), the teacher reads
                            (checked by the mic) and spells (keyboard)
src/learning/               math-facts.js (grade packs 1-4: add a grade there), mastery.js
                            (flashcard-box spaced practice + unlocking), numbers.js (spoken
                            numbers, "Correct!"/"Try again"), store.js (settings, progress, stars),
                            reading-words.js (word packs 1-4, word parts, believable misreadings
                            and misspellings: add words there), reading-check.js (did the teacher read it?)
src/world/board-writer.js   writing problems, answers and dot pictures on the chalkboard
src/ui/lesson-panel.js      math panel + number-pad.js; reading-panel.js; lesson-chooser.js;
                            grownups.js (settings, weekly words, progress)
src/ui/clipboard.js         the attendance clipboard
src/voice/commands.js       spoken commands (add phrases here), fuzzy.js (forgiving matching),
                            name-match.js (forgiving names: spelling + sound-alike),
                            voice-control.js (mic -> names/commands), speech-input.js, speech-output.js
src/core/storage.js         localStorage saves (one per player) with a version number for future upgrades
src/core/profiles.js        the players on this tablet (add, change, remove)
src/voice/student-voice.js  each student's own voice (type preset + tone + device voice)
src/ui/                     hud, class-screen (My class), student-editor (make a student),
                            keyboard, dialog, toast, bubbles (speech bubbles), dom helper,
                            profile-picker (Who's teaching today?), profile-form (add/change a player)
src/audio/sfx.js            Web Audio sound effects (bell, honk, clank, squeak…)
src/styles/                 shared look (big touch targets, bright colors)
src/mic-test/               step 1 test screen
```

## Learning

Math time is "learning by teaching": students raise hands and answer out loud, sometimes wrong on
purpose, and the player judges and corrects them; in some turns a student asks the player directly. Every answer
feeds a per-fact flashcard box: missed facts return soon, known facts rest. Tables unlock in
teaching order (×2, ×5, ×10, ×1, ×3, ×4, ×9, ×6, ×7, ×8, ×0), and division for a fact appears once
the player knows the times fact. Grown-ups (press and hold ⚙️ for 2 s) can set the grade (1-4), pick
tables, turn ÷/− on or off, set how often students make mistakes, and see progress.

Reading time works the same way: students read a word (sometimes misreading it, like "happy" for
"unhappy") or write it on the board (sometimes misspelled, like "helpfull"); the player judges and fixes it.
In their own turns the player reads aloud (the microphone checks, or "I read it out loud" without a mic) or
spells a word they only hear. 💡 Help splits words into parts with a meaning tip (un- = not).
Spelling a word unlocks once the player reads it well; the grown-ups' weekly word list is practiced first
and can be spelled right away.

Standards: reading RF.1.3, RF.2.3, RF.3.3 (a-d), RF.3.4 (sentences), RF.4.3; spelling L.3.2e/f.
Math: grade 1 1.OA.C.6, grade 2 2.OA.B.2, grade 3 3.OA.C.7 (dot arrays: 3.OA.A.1),
grade 4 is a times-table review to 12×12.

## More than one player

Each player has their own classroom: students, grade, progress, stars, attendance and weekly words.
In ⚙️ Grown-ups, the "Viewing" chips at the top pick which player the page is about, without
changing who's playing, and "+ Add player" adds one (name, picture, grade). Tools has Change, Reset
and Remove for the player being viewed. With more than one player, the game starts on "Who's
teaching today?", and the player's button at the top left switches teachers. Saves: `my-classroom-profiles` lists the players and `my-classroom:<id>` holds
each player's game. An older single save (`my-classroom`) becomes the first player, and is kept
as a backup for now.

## Privacy

No accounts, ads, analytics, or servers. Everything is saved on the device. The only thing that
leaves the tablet is microphone audio, which Chrome's own speech recognition sends to Google to
turn into text.
