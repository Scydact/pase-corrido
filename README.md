# Pase Corrido

Try it at https://scydact.github.io/pase-corrido/

A phone-friendly helper for Dominican domino, built with Vue and TypeScript. It opens in Spanish and can switch to
English under Ajustes (Settings). Enter your tiles and what each player
does. It tracks the table, reads each player's hand from the plays and passes, ranks your plays and watches for a
tranque. Terms and rule sources are in [docs/glossary.md](docs/glossary.md).

## Run

To play, serve the production build:

```bash
npm install
npm run serve
```

It listens on your network, so a phone on the same Wi-Fi can open the `Network` URL it prints. Your firewall may need
to allow port 5173. To publish a change, run `npm run build` and reload the page; the server doesn't need a restart.

While working on the code, `npm run dev` gives live reloading instead, and `npm test` runs the tests.

## How it works

- `src/domain/game.ts` replays the moves into the table state. Undo just removes the last move.
- `src/domain/inference.ts` works out exact odds by counting every deal of the unseen tiles that fits the tiles left
  per seat and the numbers each seat passed on. All such deals count as equally likely, so it doesn't read into why
  someone chose a play.
- `src/domain/suggest.ts` ranks your plays. The odds it shows are exact, but the weights that combine them are a rule
  of thumb, not a solved game.
- `src/locales/` holds the text in each language. The game logic returns message keys, not text.
- `src/vision/detect.ts` reads tiles from a photo with OpenCV.js, on the phone. It only loads when the camera button is
  used. `vendor/opencv/opencv.js` is a small build with just the functions listed in `scripts/opencv_js.config.py`.
  After changing that list, run `npm run build:opencv`, which downloads Emscripten into `.opencv-build/` and takes a few
  minutes. `npm run build` just uses the file already in `vendor/`.
- `scripts/make_icons.py` draws the icons into `public/icons`, and needs Pillow. Only rerun it to change the icon.

## Offline and updates

`src/sw/sw.template.js` is the whole policy: online, opening the app gets the latest page; offline or after 3 seconds on a
slow network, it gets the last complete saved set. It never reloads by itself. Ajustes shows the version and has a repair
button that clears the saved files without touching games or settings.

If a bad release ever gets stuck on phones, replace the template's contents with this and publish. Every phone then drops
the offline layer the next time it opens the app online, and the site keeps working:

```js
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', async () => {
  const names = await caches.keys()
  // Other projects share this web origin, so only touch this app's caches.
  await Promise.all(names.filter((name) => name.startsWith('pase-corrido-')).map((name) => caches.delete(name)))
  await self.registration.unregister()
})
```

## Licence

MIT, see [LICENSE](LICENSE). `vendor/opencv/opencv.js` is compiled from [OpenCV](https://opencv.org) 4.13.0, which is
under the Apache License 2.0, see [vendor/opencv/LICENSE](vendor/opencv/LICENSE).