# Celeste: Mauve Low Spec

A standalone GitHub Pages launcher for the same Mauve setup, with low-resolution options intended to reduce graphics load on slower devices.

- `Launch 540p` uses Celeste's 320×180 base resolution at 3× scale.
- `Launch 720p` uses 4× scale for a sharper image.
- Gameplay saves use the existing shared browser save folder.
- The Celeste settings file is private to this low-spec page, so its resolution does not change the normal Mauve launchers.
- A rolling cap keeps the Webleste UI log buffer from growing without limit.

The browser WebAssembly runtime still uses substantial memory. This page lowers rendering resolution and bounds its log history; it does not rebuild the game runtime or guarantee a particular FPS increase.

The game and mod payloads match the existing Mauve project. See [THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md) and the licenses included under `mauve/`.
