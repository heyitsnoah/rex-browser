# Rex Browser design decisions

## 2026-11-17: three directions published, choice pending

Branch B (brand exists). Palette, faces, radii, shadows and motion come from Alephic Product registry revision 2 (`research/product-system.md`), so the directions diverge on structure, density, material and how boldly Forest is used.

Evidence that shaped them: live Rex metadata on 2026-11-17 showed 4 computers, about 12 sessions and about 35 tabs, nearly all single pane. Navigation is the larger problem; tiling is the smaller one.

| Direction | Slug | Color | Type | Density | Material | Primary mode |
| --- | --- | --- | --- | --- | --- | --- |
| A · Ink Stage | `ink-stage` | Restrained: Ink ground, bright green only on the target pane and Send | Mono-forward chrome | Compact, edge to edge | Flat, one floating tray | Dark |
| B · Session Rail | `session-rail` | Committed: white ground, Forest for selection and Send | Geist workhorse, Mono for counts and ids | Normal | Bordered, no shadow | Light |
| C · Tab Deck | `tab-deck` | Full Product palette: Ink trays, Forest selection, Mint for typing and destination | Geist, Mono for kinds and counts | Normal to spacious | Layered objects with shadow and lift | Light |

Review surface: canvas https://intelligence.alephic.ai/artifacts/103870dc-52b1-4f15-9977-e3e95acdcfdb with one artifact per mockup:

- A: https://intelligence.alephic.ai/artifacts/de5605db-1a45-400f-9e6f-204ca8b4e073
- B: https://intelligence.alephic.ai/artifacts/e075bc9c-a9d8-4cc8-acdc-8a41a1bc56aa
- C: https://intelligence.alephic.ai/artifacts/1d17d3ce-8ed2-4547-984a-07c4d35d579a

Notes:

- Mockups are built by `tiles/build.mjs`. They are full-size app mockups, not the skill's generic style tile: with brand tokens fixed, a hero and stat-card tile would have shown one direction three times.
- Host, session and tab names are real metadata (client-named tabs left out). Terminal output is synthetic and says so on its first line.
- Fonts: Geist and Geist Mono (SIL OFL), latin subset embedded in `tiles/fonts.css` because the Intelligence viewer does not load remote fonts.
- `selected` row fill (#e4f1e5 light, #1c2b1e dark) and the `lifted` shadow are derived, not registry values.
- Motion stance for all three: crisp, per Product. 150ms ease-out on color and lift only; terminal output never animates.
- Open: phone scope. All three are desktop-first.

## 2026-11-17: direction chosen, Session Rail (B)

**Why:** with about 35 tabs across 4 computers and almost no tiling, finding the tab is the job; B is the only direction that keeps all of it visible. Noah picked it from the canvas.
**Rejected:** Ink Stage, navigation hidden behind a switcher; Tab Deck, most chrome and one session at a time.
**Axes:** color committed · type Geist workhorse with Mono for counts · density normal · material bordered and flat.
**Built:** `public/index.html` and `public/client.js` now follow `DESIGN.md`. No server change. Behavior kept: discovery, lazy tab loading per session, pane targeting, read only by default, draft kept on failure. Added: last tab reopened on reload, filter, in-place new tab name, system theme with toggle.
**Not verified:** sending input, direct typing, new tab creation and the under-760px layout were not exercised after the restyle.
