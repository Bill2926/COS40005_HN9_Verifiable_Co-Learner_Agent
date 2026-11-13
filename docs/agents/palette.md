# Colour Palette

The web app uses one light theme built from the "Tranquil Academic Study Sanctuary" palette. Values live in `web/app/assets/css/main.css` under `/* ---- Colour */`. That block is the single source of truth, so read the exact steps there.

| Source | Role |
|---|---|
| `#1F2A44` navy | ink: headings, body text, feature blocks |
| `#6C757D` grey | muted text |
| `#F3F4F6` light grey | page ground under white cards |
| `#4B8BBE` blue | accent fills: focus ring, progress, borders of the current item |
| `#A3C6E8` pale blue | soft tints: the student's bubble, selected chips |

## Choosing a class

Every colour class comes from these palettes:

- **`paper`**: card and panel surfaces (white).
- **`ink-50`…`ink-950`**: neutrals. 50–100 sit below paper (page ground, tracks, wells). 200–300 are borders. 400 is dimmed meta text, 500 is muted text, and 700–900 are body and heading text.
- **`brand-50`…`brand-950`**: the blues. 50–200 are tints and tinted borders, 500 is the palette blue, and 600+ is blue text and links.
- **Role tokens** name a surface with a fixed job. Pair each background with its `on-` text:
  - `bg-accent text-on-accent hover:bg-accent-hover`: every filled button.
  - `bg-self text-on-self`: the student's own chat bubble.
  - `bg-feature text-on-feature`, with `text-feature-muted`, `text-feature-accent` and `border-feature-line`: navy highlight blocks.
  - `roadmap-line`: connector strokes and locked-node borders on the roadmap canvas.
- **Status colours** stay Tailwind's: `emerald` (mastered, success), `amber` (the Deskmate), `rose`/`red` (errors), `sky` and `purple` (code highlighting, decoration).
- **Nuxt UI semantics** (`bg-default`, `text-muted`, `border-default`, `text-highlighted`, …) are pinned to the same ink steps, so they mix freely with the classes above.

Write new UI with these names. `slate-*`, `indigo-*`, `white`, `black` and raw hex values were all migrated away. Reintroducing them splits the palette.

## Contrast

Text must reach WCAG AA, 4.5:1. The palette blue `#4B8BBE` is only 3.7:1 with white text, so filled buttons use `accent` (`#36719F`, 5.2:1). Keep `#4B8BBE` for fills, rings and borders. `ink-400` is about 2.6:1 on white, so reserve it for non-essential meta text such as timestamps and counters.

## Dark mode

The app is light only: `colorMode.preference` is `'light'` in `web/nuxt.config.ts`. A dark theme was tried and dropped, so don't add `dark:` variants.
