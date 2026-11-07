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

## Licence

MIT, see [LICENSE](LICENSE). `vendor/opencv/opencv.js` is compiled from [OpenCV](https://opencv.org) 4.13.0, which is
under the Apache License 2.0, see [vendor/opencv/LICENSE](vendor/opencv/LICENSE).
