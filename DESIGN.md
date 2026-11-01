# Implemented design system

## Overview

SqueekPack: Jetstream Run is a playable Squeekchain arcade for touch, mouse and keyboard players. The visual idea is a copper mine arcade cabinet: a quiet charcoal interface frames a detailed pixel mine, a helmeted hamster and one bright orange play action. The game and its Start run control appear on the first screen at 390 CSS pixels.

The implementation is React/TypeScript with plain CSS. The source of truth is `src/styles.css`; canvas art and its separate environment palette live in `src/game.ts`. This document describes the implemented system rather than a proposed redesign. Browser evidence and the six-domain review are in `artifacts/validation.md`.

## Colors

The CSS has primitive values and semantic roles. Components use the semantic tier; the canvas intentionally owns its artwork colors.

| Semantic token         | Value / primitive          | Use                                                |
| ---------------------- | -------------------------- | -------------------------------------------------- |
| `--color-bg`           | `--neutral-950`, `#171917` | Page background, dark text on orange               |
| `--color-surface`      | `--neutral-900`, `#1d211c` | Arcade frame, telemetry panel, dialogs             |
| `--color-raised`       | `--neutral-850`, `#22271f` | Wallet rows, explanatory insets, segmented control |
| `--color-hover`        | `--neutral-800`, `#2c3227` | Hover/selected state and keyboard keys             |
| `--color-line`         | `--neutral-700`, `#42483b` | Structural dividers and panel outlines             |
| `--color-text`         | `--neutral-100`, `#eeeede` | Primary text                                       |
| `--color-muted`        | `--neutral-400`, `#a5ac98` | Supporting copy and metadata                       |
| `--color-accent`       | `--copper-400`, `#ff965c`  | Primary play/restart action and brand accent       |
| `--color-accent-hover` | `--copper-300`, `#ffae7f`  | Primary hover                                      |
| `--color-on-accent`    | `#171917`                  | Text/icons on the orange action                    |
| `--color-focus`        | `#ffae7f`                  | 2px focus outline, 4px offset                      |
| `--color-live`         | `--olive-300`, `#c6d49e`   | Fresh connection and verified state                |
| `--color-warning`      | `--gold-300`, `#f0cc74`    | Persistent errors, score trophy and power-up cues  |

The UI is deliberately dark, with `color-scheme: dark`. There is no unused light theme. Gameplay changes the canvas: Night Shift uses a cool dark mine and illuminated pipe edges; Zoomies retains the warmer mine and a copper mode strip. Status always has words or an icon as well as color.

Measured solid pairs in Chromium: primary action 8.22:1, primary page text 15.09:1, muted page text 7.54:1, primary panel text 13.93:1, Night Shift label 9.50:1. These are measurements of identified pairs, not a claim that all moving canvas pixels have one contrast ratio. The idle canvas uses a dark left scrim behind the heading and instructions; the validation record describes the separate canvas checks and their limits.

## Typography

Local `public/fonts/space-grotesk-latin.woff2` supplies Space Grotesk for the interface. Its CSS variable face is declared at weights 300–700; the UI uses 400, 600 and 700. Fallback is Arial/sans-serif. IBM Plex Mono, locally bundled in `public/fonts/ibm-plex-mono-latin.woff2`, is used at weight 400 for telemetry, scores, blocks and addresses, with a monospace fallback. Font requests have `font-display: swap`; there are no external font requests.

The single six-step scale is defined in `:root`:

| Token            | Size | Role                                               |
| ---------------- | ---: | -------------------------------------------------- |
| `--text-xs`      | 12px | Metadata, compact HUD labels, keyboard hints       |
| `--text-sm`      | 14px | Buttons, supporting copy and navigation            |
| `--text-body`    | 16px | Base text and modal subheadings                    |
| `--text-title`   | 24px | Dialog headings, panel numbers, secondary headings |
| `--text-display` | 40px | Phone title and narrower game headings             |
| `--text-hero`    | 56px | Desktop title, idle game heading, result score     |

Display headings use tight tracking (approximately -0.04 to -0.06em) and line-height 1.02–1.1. Body copy uses 1.6; short UI copy uses 1.4–1.5. Small text has natural tracking and at least weight 400. Headings use balanced wrapping; descriptions use pretty wrapping. Copy measures are limited locally (for example, 35ch for desktop field notes and 65ch for lore). Changing numbers use tabular numerals. Full wallet addresses remain available in the connected-wallet dialog; abbreviated leaderboard addresses expand through a native keyboard-accessible disclosure.

## Layout

Spacing tokens are 4, 8, 12, 16, 24, 32, 48 and 64px. The outer shell is capped at 1472px, with 48px default side padding and shared alignment edges. The game and engine-room monitor are the main grid; desktop columns are `minmax(0, 1fr) 284px`, separated by 20px. Controls sit with the canvas and the telemetry they change. Lower field notes are deliberately subordinate to the playable product.

Implemented breakpoints:

- Above 1600px: shell padding becomes 56px.
- At 1190px: side padding becomes 32px; the monitor narrows to 260px; secondary chrome and long mode explanation are reduced.
- At 960px: the main navigation is hidden, the monitor narrows to 236px, and field notes use two columns.
- At 760px: shell padding becomes 24px; the monitor moves below the game and becomes a compact two-column telemetry layout. The game is still first.
- At 480px: shell padding becomes 16px, the stage is taller (aspect ratio 1.14), the wallet sheet becomes a bottom sheet, and field notes stack. RPM, hamster state and block remain visible. The active game has its own score HUD.
- At 350px: the stage becomes square, the header and hints compact further, and the decorative title spark disappears.

The canvas keeps a consistent world height and uniform pixel scale. Narrow screens reveal a smaller horizontal field of view, instead of stretching the pilot. The idle pilot shifts right to leave the copy readable. Gameplay physics and collision coordinates stay in the same world units.

The page has no horizontal overflow at the checked 320, 390, 760, 1024 and 1440 widths. The six-column leaderboard has its own intentional horizontal table scroller on phones. Long raw JSON wraps within a separately scrollable inspector. Dialogs cap their height and scroll; close controls stay in their header. Insets account for the mobile safe area.

## Elevation & Depth

Main surfaces use a 1px structural border without a shadow. Tonal differences separate rows and insets; dividers appear only where they explain grouping. Native dialogs use the sole elevation treatment: `0 24px 100px #0009` over a dark backdrop with a 5px blur. There are no gradient-filled headings. The idle scene’s scrim is for readable text, while canvas light gradients and particle glows are game artwork.

## Shapes

Buttons and keyboard keys use roughly 4–5px radii. Arcade and monitor frames use 8px; desktop dialogs use 12px; phone bottom sheets use 16px top corners. The game frame clips its artwork and round corners; content and controls are not clipped to fit. Tiny circular status dots are redundant with text. The repeated mine pipes, rivets, wheels and pixel silhouettes belong to the canvas rather than the general UI component system.

## Components

| Component / source                                                           | Use and states                                                                                                                                                                                                                  |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.primary`, `.secondary`, `.text-action`, `.icon-button` in `src/styles.css` | One orange primary action per view; neutral secondary actions; named icon controls. Hover, press, focus, disabled and pending states are explicit. Touch controls are generally 44px; compact game toolbar buttons remain 40px. |
| `GameArea`, `src/GameArea.tsx`                                               | Idle, running, paused, game-over and unsupported-canvas states. Space/Arrow Up and pointer input boost; P/Esc pauses. Menus and tab visibility pause play.                                                                      |
| `TelemetryPanel` / `WheelGraphic`, `src/TelemetryPanel.tsx`                  | Fresh, loading, stale and offline states, actual reading history, source link and inspector action. The wheel animates only for fresh spinning telemetry.                                                                       |
| `Modal`, `src/Modal.tsx`                                                     | Native modal dialog, inert background, contained scrolling, close control, backdrop dismissal, Escape and focus restoration. Desktop centered dialog / phone bottom sheet.                                                      |
| `WalletSheet`, `src/WalletSheet.tsx`                                         | Named EIP-6963 rows, generic browser fallback, mobile wallet links, Coinbase Smart Wallet, pending/error handling, full connected address and disconnect. Wrong-chain signing offers an Ethereum switch.                        |
| `ResultView`, `src/Views.tsx`                                                | Result summary, local-save outcome, wallet signing pending/rejected/verified states, signed JSON export, instant restart and leaderboard navigation.                                                                            |
| `LeaderboardView`, `src/Views.tsx`                                           | Current round/all-time buttons, honest local scope, best run per pilot, verified import/export, expandable full player addresses, empty state and sticky personal-best footer.                                                  |
| `AboutView` / `HelpView`, `src/Views.tsx`                                    | Progressive disclosure for lore, raw API values, retry, official links, controls and collectible effects.                                                                                                                       |
| `Icon` / `HamsterMark`, `src/Icons.tsx`                                      | One SVG stroke icon set using currentColor; decorative icons are hidden from assistive technology. The local hamster favicon doubles as the brand mark.                                                                         |

Focus uses a visible copper outline. Native elements provide keyboard behavior. Pending wallet rows are disabled while a prompt is open and identify which wallet is opening; persistent inline status explains recovery. Native dialog focus is restored when closing. The idle Space key gently lifts 2px on a two-second loop as a boost cue, only when motion is allowed. The spinning monitor wheel uses a seven-second rotation. Audio is opt-in. Motion transitions name only changed properties and last 100–140ms. Under reduced motion, CSS animations/transitions stop and the engine removes decorative movement and particles; essential user-initiated gameplay remains.

## Do’s and Don’ts

- Start a new supporting view with `Modal` and the existing heading/body scale; reuse the semantic colors and button classes.
- Keep the playable game and its start/restart action before lore or explanatory content on phones.
- Keep score, block, units and freshness labels together. Show unavailable data honestly; never substitute random live readings or seeded competitors.
- Use one filled orange action per view. Keep secondary actions neutral, with visible interaction states.
- Preserve the full message and signature in an exported attestation. Distinguish a signed client score from an authoritative anti-cheat result.
- Add cosmetic canvas effects only behind the reduced-motion guard. Preserve the uniform canvas transform when changing phone composition.
- Do not add remote fonts, new type scales, card shadows, invented API fields or a second wallet connection path outside the existing sheet.
