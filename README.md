# Celeste: Mauve Low Spec (browser edition)

Play it at:

**https://a-faus.github.io/celeste-mauve-low-spec/**

A standalone GitHub Pages launcher for the same Mauve setup, with low-resolution options intended to reduce graphics load on slower devices.

- `Launch 540p` uses Celeste's 320×180 base resolution at 3× scale.
- `Launch 720p` uses 4× scale for a sharper image.
- Gameplay saves use the existing shared browser save folder.
- The Celeste settings file is private to this low-spec page, so its resolution does not change the normal Mauve launchers.
- Rolling caps keep the Webleste log history and visible log panel from growing without limit.
- Diagnostic Jiterpreter statistics are disabled in this copy; the game Jiterpreter itself remains enabled.

The browser WebAssembly runtime still uses substantial memory. This page lowers rendering resolution and bounds its log history; it does not rebuild the game runtime or guarantee a particular FPS increase.

The game and mod payloads match the existing Mauve project. See [THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md) and the licenses included under `mauve/`.
