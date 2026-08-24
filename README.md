# Catch the Lost Dog

A lightweight, static anniversary mini-game based on [`DESIGN.md`](./DESIGN.md).

## Run locally

Because the app uses an ES module, serve the folder over HTTP rather than opening `index.html` directly:

```sh
python3 -m http.server 4173
```

Then open <http://localhost:4173>.

## Personalize

Edit the `config` object near the top of [`src/main.js`](./src/main.js) to change the recipient, invitation copy, date, time zone, and event details. The app has no backend, analytics, or third-party runtime dependencies.

The first iteration includes:

- CSS-only park, dog, envelope, and celebration artwork
- mouse, touch, Enter, and Space interaction
- forgiving chase behavior with a guaranteed fourth attempt and a skip action
- reduced-motion support and live-reader announcements
- acceptance persistence with guarded local storage
- runtime `.ics` calendar download

The dog animation uses a locally padded copy of `dog_medium.png` at `src/assets/dog_medium_padded.png`, sourced from [OpenGameArt's Dog](https://opengameart.org/content/dog-3) by rmazanek. It is published under CC0; the sheet has six rows for bark, walk, run, sit transition, idle sit, and idle stand. The padding keeps the bottom paws clear of each animation cell’s crop edge.
