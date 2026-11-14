# Alephic Product design system

The Alephic brand style applied to interactive software. **Brand** (`ai brand guide --brand alephic --design-system brand`) is the brand style for every format; this system adds what software needs on top of it. Registered 2026-11-12.

This system is for **interactive software Alephic builds**: internal tools, agent surfaces, and client tools that carry the Alephic look. Alephic Intelligence is the reference implementation. Its `DESIGN.md` ("Workbench") is where these rules were chosen and tested; this page keeps the parts that travel and leaves out what only Intelligence needs.

**How the systems fit:**

| You are making | Use |
| --- | --- |
| Anything | **Brand** first: identity, type, color, voice |
| A talking-head clip or reel | Brand + Video |
| An app, tool, dashboard, viewer, editor, anything people click | Brand + **Product** |

Product inherits Brand's identity (Ink, Forest, Mint, white; Alpina and Geist) and translates it for screens people work in. Where the two differ, Product wins inside the software, for one reason: **the app's chrome speaks Geist and Geist Mono, and Alpina is kept for the content people make in it and for marketing headlines**, so the chrome and the work never blur together. Translate Brand's principles into components; don't copy its layout rules for slides and pages onto a control.

## Product language: Workbench

**The work is the loudest thing on screen.** Alephic software is a workbench: a place to make things, spread them out, compare them and work on them together. The visual language makes the work tangible and keeps its controls compact.

An object keeps its identity as it moves from a list to a picker to a canvas. Opening it gives the work room to read. Tools, status and presence gather in one Ink tray or one short toolbar.

- Feels like: a studio; quiet, precise, physical.
- Both themes ship. Light mode's ground is **white, never gray**.

### The visual vocabulary

| Part | What it tells the person using it | How it looks |
| --- | --- | --- |
| **Object** | A thing you can open, select, pick up or arrange | Preview, kind, title and owner; a border and restrained shadow; the same identity in a grid or row |
| **Work surface** | Space to read, compare or arrange the work | White in light mode; flat, open and free of decorative containers |
| **Tray** | The tools and state of the current activity | One compact Ink bar; tools, key hints, presence and status together |
| **Selection** | The object or tool you are working with | Forest outline and lift on an object; bright green for an active tool on Ink |
| **Note** | A contribution placed alongside the work | Mint fill, dark readable text, object depth |
| **Detail** | One opened thing, with its context close by | One title, a short metadata line, one toolbar; secondary information in a drawer |
| **Stage** | The work presented for watching | Content fills an Ink ground; controls appear on demand |

These are reusable visual roles, not new names for navigation or data types. Use the same parts across screens. Keep the authored work's own type, colors and layout intact.

### Hierarchy in use

1. **The work:** preview or content, then its title.
2. **Its context:** kind, version, owner and date, close to the object they describe.
3. **Its controls:** one committing action; quieter supporting tools.
4. **Its machinery:** technical details disclosed only when they help someone act.

Geist carries the readable work of the interface. Geist Mono identifies kinds, versions, counts and keys. Alpina belongs to authored content and marketing headlines. Forest marks action and object selection; Mint marks notes and “yours”; Ink gathers tools. Depth signals something that can be picked up, or a control floating above the work.

## Color

Strategy: committed. White ground, objects set apart by border and shadow, Ink for type and the tray, Forest for every action and selection, Mint for notes and "yours". **No orange in the chrome.**

| Role                     | Token                      | Light             | Dark              |
| ------------------------ | -------------------------- | ----------------- | ----------------- |
| Ground                   | `background`               | #ffffff           | #161515           |
| Objects, panels, inputs  | `card`                     | #ffffff           | #211f20           |
| Ink (type)               | `foreground`               | #231f20           | #ededeb           |
| Tray                     | `tray` / `tray-foreground` | #231f20 / #f4f4f2 | #0b0a0a / #ededeb |
| Active tool on the tray  | `tray-active` / fg         | #45bf55 / #0f1f12 | same              |
| Action, selection | `primary` / fg             | #23602b / #ffffff | #45bf55 / #0f1f12 |
| Focus ring | `ring` | #23602b | #8fd999 |
| Notes, "yours"           | `note` / fg                | #8fd999 / #12301a | same              |
| Secondary text           | `muted-foreground`         | #575c58           | #a6aba7           |
| Hover, chips             | `muted`                    | #e3e6e3           | #2a2829           |
| Border                   | `border`                   | #d3d8d4           | #363334           |
| Field edge               | `input`                    | #858b86           | #6e6b6c           |
| Destructive              | `destructive`              | #b42318           | #ff8f8f           |

Rules:

- **Forest means "act" or "selected".** One Forest button per group: the action that commits something. Everything else is an outline or a quiet tray button.
- **Forest is too dark on Ink** (2.2:1). The active tool on the tray uses `tray-active` (bright green).
- **Mint is never text on white.** It's a fill for notes and "yours".
- **Secondary text is a color, never reduced opacity.**
- Segmented controls: the selected segment is Ink with light text, never Forest. In dark mode, selected segments and trays have a 1px border edge.
- Status colors always come with a label or icon.
- WCAG AA for text and controls in both themes. Charts: Forest, Mint, Ink, bright green, gray; Mint and bright green fall under 3:1 on white, so label every series.
- Never recolor content people authored.

## Type

Geist for titles and prose; **Geist Mono for anything you count or type**: kinds, versions, counts, key hints, timestamps, filter chips, slide counters. Weights 400 and 500.

| Role            | Spec                                           |
| --------------- | ---------------------------------------------- |
| Page title (h1) | 1.75rem desktop, 1.375rem mobile, 500, -0.01em |
| Section title   | 1.125rem, 500                                  |
| Object title    | 0.8125rem, 500, one line, truncated            |
| Body            | 0.9375rem, 1.5                                 |
| Body secondary  | 0.875rem                                       |
| Caption         | 0.8125rem                                      |
| Label           | Geist Mono 0.6875rem, +0.04em, uppercase       |

## Shape, density, depth

- Radius: `sm` 4px (chips, fields), `md` 8px (objects, buttons, notes), `lg` 12px (tray, floating controls, dialogs). Don't nest rounded containers around the same content.
- Density: 4px unit; 40px default buttons; **36px toolbar and tray controls**.
- Icons: one line family, 1.5px stroke, 16px in toolbars, 17px in trays and 12px in chips (Intelligence uses Lucide).
- Depth is layered and opaque: no translucency, no backdrop blur.

| Level  | Light                                                            | Used by                                          |
| ------ | ---------------------------------------------------------------- | ------------------------------------------------ |
| object | `0 1px 2px rgb(35 31 32/.08), 0 6px 16px -6px rgb(35 31 32/.18)` | Things you can pick up                           |
| lifted | float + `translateY(-2px)`                                       | Selected or dragged object                       |
| float  | `0 12px 32px -10px rgb(0 0 0/.55)`                               | Tray, floating controls, menus, dialogs, drawers |

On white, an object needs **border plus shadow**; never drop the border. Never shadow authored content (a slide, an HTML frame, a document body), table rows, fields or chips.

## Components

### Object

The one way to draw a thing someone made, at any size. A white card, `md` radius, object shadow. Face on top (its preview at 16:9, cropped to the top), footer below: kind chip (icon + Mono kind), title, owner avatar. Sizes: grid (~300px), row (64–72px face left, title, Mono meta line) for pickers and narrow screens. **Same parts, same order, every size.** No preview: show its first heading and two lines of text on white, never a gray box with a big icon. Selection: Forest 2px outline, 2px offset, plus the lifted level.

### Tray

A tool's only chrome: one Ink bar, `lg` radius, float shadow. Tools with Mono key hints; the active one in `tray-active`. Presence is avatars in the tray and **nothing when you're alone** (no "Only you" label). Connection or save state is one Mono word in the tray (`LIVE`, `UPDATING`, `READ ONLY`, `NOT SAVED` in destructive). Status never floats on its own over the work, and a count never appears in two places.

### Detail page

One shell for every kind of record. The h1 is the only place the title appears. A meta line under it (kind chip, version chip, owner and date in caption type, Details). One toolbar row: the kind's own controls on the left; on the right one Ink tray segment with Comment (count), History, then the primary action (Forest only if it commits). Comments and history open as a right drawer. Prose caps at 72ch; wide content runs full width, flat.

**Below `md`:** the toolbar becomes a sticky Ink **bottom bar**: the primary action full width, then icon buttons. Kind controls move to one compact row under the meta line.

### Stepper

One part for every previous/next, wherever it appears (detail toolbar, present mode, presenter view):

- 36px ‹ and › icon buttons around a Mono `1 / 3` counter, tabular.
- **The same counter text at every width.** Never "Slide 1 of 3" on desktop and "1 / 3" on a phone.
- The counter is a number field: type a number and press Enter to jump; out-of-range input clamps.
- Two skins: `surface` (ghost buttons on white or a card) and `tray` (on Ink).
- An unavailable step is `aria-disabled` at 40% and **stays focusable**. Labels "Previous" / "Next" plus the thing being stepped.
- ← and → work wherever the stepper shows.

Reference: `src/artifacts/slide-stepper.tsx` in Intelligence.

### Stage (a phone held sideways)

For anything you watch rather than review: slides, video, a full-screen preview.

- When a touch screen is sideways (below `md` wide or under 500px tall), the same route becomes a stage: header, title, toolbar and bottom bar hide; the content fills the height on Ink, no shadow.
- **A tap shows the chrome**: a top scrim (back, title, Mono counter) and a small Ink tray in a corner with the two or three actions that matter. It hides after **3s idle** or on the next tap; any touch restarts the timer.
- **Swipe left or right steps.** A swipe needs 40px of mostly horizontal travel and **never starts on a control**: links, buttons, inputs, media and seek bars, menus, editable text, embedded players. Those keep their own gestures.
- If the content is a sandboxed frame, its touches never reach the page; the frame must relay swipes to the page itself (Intelligence does this on the same channel it uses for clicks).
- A short desktop window keeps the desktop layout; the stage is for touch.
- Respect `env(safe-area-inset-*)` for the chrome; the content may run under the notch.

### Present on a phone

- Sideways: the stage with no detail actions. A 2px `tray-active` progress line along the bottom is the only chrome until a tap shows the stepper pill at the bottom edge (never over the middle of the content); it hides after 2s.
- Upright: content centered full width on Ink. Tap the left third to go back, anywhere else to go forward. Progress dots, an exit button top left, a one-time "Turn phone to fill" hint.

### Phone, upright

A phone held upright is for reviewing; sideways is for watching.

- Content first: header, h1, meta line, then the content immediately.
- **One control row under the content that never wraps.** Its widest form must fit 358px (and still one line at 320px). Move the rest into the bottom bar or More.
- Progress dots for sequences of 2–12.
- Secondary panels (notes, outlines) are a disclosure row or a bottom sheet, not a card stacked above the content.

### Forms, tables, states

- White fields with a visible `input` edge; the theme’s focus ring (Forest in light, Mint in dark); errors as text tied to the field.
- Tables: compact rows on white, subtle hover, selected row `success` fill with a Forest left edge. Tables own horizontal scroll; the page never overflows.
- Empty and loading states use the same object and type hierarchy as the data. A loading object is a muted face with its footer.

## Motion

Crisp. Motion confirms a pick-up, a drop or a panel; it never decorates.

- Tokens: `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`, `--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1)`, `--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1)`, `--duration-fast: 150ms`, `--duration-panel: 240ms`.
- Enter and exit with `--ease-out`; move on screen with `--ease-in-out`; never `ease-in` on UI. Everything under 300ms.
- `transform` and `opacity` only. Never `transition: all`. Never animate layout next to an embedded frame (it reflows).
- Enter from `scale(0.95)` + `opacity: 0`; menus scale from their trigger. Press: `scale(0.97)` over 160ms.
- Stage chrome fades over `--duration-fast`.
- **Never animated:** the tray, presence, navigation, data rows, keyboard actions, content being read, and **the step between slides or pages**.
- Reduced motion: keep opacity and color, drop movement.

## Do and don't

- Do draw every made thing with the object part.
- Do keep controls, status and presence in one tray or toolbar.
- Do use Geist Mono for kinds, versions, counts, counters and key hints.
- Do check light and dark, long titles, missing previews, 320px wide and a phone sideways.
- Don't use a gray page ground in light mode.
- Don't use orange in the chrome, or Alpina and brand kickers anywhere in it.
- Don't shadow authored content, rows, fields or chips.
- Don't float a status chip over the work or show a count twice.
- Don't let a control row wrap on a phone.
- Don't change behavior, data or permissions as styling.

## Sources

Aligned 2026-11-13 against Intelligence main at `37796209d`. This revision makes the chosen Workbench vocabulary explicit; it does not choose a new visual direction.

- Intelligence `DESIGN.md` ("Workbench"), the source of truth for Intelligence itself, and `src/app/globals.css` for executable tokens.
- Decisions: `docs/design/artifacts-canvas/DECISIONS.md`, `docs/design/artifact-detail/DECISIONS.md`, `docs/design/mobile-slides/DECISIONS.md`.
- Mobile slides design record (private): https://intelligence.alephic.ai/artifacts/404c94c7-8c5c-4de0-8f5a-eeaedc05b935?version=3
- Shipped in PR #3152 (Workbench) and PR #3177 (slides on a phone).

**Keeping it current:** when a reusable pattern in Intelligence's `DESIGN.md` changes, update this system in the same change.


Source: ai artifacts get 808eb452-99c7-418c-beb3-3025006922f2 --artifact-version 4 --json
