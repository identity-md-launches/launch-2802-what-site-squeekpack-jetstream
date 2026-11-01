# SqueekPack: Jetstream Run

A responsive retro arcade driven by Squeektoshi’s real wheel telemetry. Boost a helmeted hamster through a procedural copper mine, collect coins and Golden Nuts, and sign a high score with an EVM wallet.

The ready-to-host website is **`dist/index.html`**. The complete export, source, locally bundled runtime assets, package manifest and npm lockfile are included. No server application or private key is required.

## Install, preview and rebuild

Use Node.js 22.12 or later (validated with Node 24) and npm.

```sh
npm ci
npm run dev
```

For the production export:

```sh
npm run typecheck
npm run build
npm run preview
```

`build` typechecks and replaces `dist/`. Serve `dist/` with any static HTTP server. Vite’s `base: './'`, relative metadata/assets and hash-only home navigation support gateway subpaths as well as ordinary domains. Opening the HTML directly with `file://` is not supported by module browsers. The static export needs no dependency installation to serve.

To reproduce the interaction checks:

```sh
npx playwright install chromium webkit
# On a suitable Linux host, install the browser runtime libraries if needed:
npx playwright install-deps
npm run validate
node scripts/review.mjs
node scripts/webkit-check.mjs
node scripts/check-delivery.mjs
```

The scripts manage their own temporary HTTP server at a `/preview/` subpath and shut it down. Results and screenshots go only to `test/scratch/`, which is excluded from the submission. `validate` tests deterministic engine rules, Chromium interaction flows, wallet discovery/signing using an ephemeral in-memory test account, touch controls and the live API. WebKit availability is reported separately; a successful Chromium result is not a claim of WebKit coverage. `review` audits all five modal types and records contrast diagnostics. The pinned taste probe was also run; see [the validation record](artifacts/validation.md).

## Play

Select **Start run**, tap/left-click the canvas, or press **Space**. Each tap or press boosts the jetpack. **P** or **Esc** pauses; opening a menu or hiding the tab also pauses. Avoid the pipes and mine edges. Collected $SQK coins add 50 points, or 100 during Zoomies. The Golden Nut grants three seconds of invulnerability. These coins are arcade collectibles, with no token value or redemption.

Audio starts muted. Reduced motion freezes idle scenery, parallax decoration, particles and wheel animation; player-initiated flight remains animated.

## Live data and modes

The browser polls [Squeekchain’s public status API](https://api.squeekchain.com/v1/status) every five seconds, with an eight-second request timeout and the API’s own freshness window. Requests pause while the tab is hidden. Refresh is also available in the inspector. No API key is needed.

- `measurement.rpmMilli / 1000` supplies RPM; speed, cumulative work, core status and observation time come from the same measurement.
- Fresh, spinning measurements select **Zoomies**, with RPM-dependent wind speed and a 2× score multiplier.
- Fresh, stationary measurements select **Night Shift**, with heavier gravity and illuminated pipe edges.
- Loading, stale, malformed or unavailable data selects **Practice** at 1×. Old readings stay labeled unavailable/stale; no random telemetry or fabricated blocks are supplied.
- `builder.anchor.blockHeight` is the settled Squeek block. The projected block is separately labeled optimistic in the inspector.
- The arcade’s current round is the next number after the latest accepted closure (`oracle.latestClosure.lastRound + 1`, falling back to the settled round). The board explicitly labels this grouping; it is not a fabricated real-time round clock.

The inspector exposes the received JSON and links to the [official livestream page](https://squeekchain.com) and [whitepaper](https://docs.squeekchain.com/whitepaper/). External service availability is outside the static export.

## Wallets and score attestations

One header control opens the wallet sheet. Wagmi discovers MetaMask, OKX, Rabby and other browser extensions through EIP-6963, using their own names and marks. A phone without an injected provider is offered links into MetaMask, Coinbase Wallet, Rabby and Phantom. Coinbase Smart Wallet is available through the Coinbase SDK without a relay or project ID. The Rabby link follows its current [official mobile universal-link handler](https://github.com/RabbyHub/rabby-mobile/blob/develop/apps/mobile/src/hooks/universalLink.ts); pasting the site URL into Rabby’s Dapps tab is also explained in the sheet.

The attestation uses Ethereum (chain 1), consistent with Squeekchain’s published Ethereum settlement model. A connected wallet on another chain offers a switch before signing. This application sends no token transactions or approvals. `personal_sign` includes the origin, wallet, chain, run ID, score, distance, coins, encountered modes, current settled Squeek block, round and completion date. The signed score is saved only after signature verification. EOA signatures are recovered locally; contract-wallet verification can read Ethereum through the public RPC in `src/config.ts`.

**Competition is local and portable.** The Hall of Squeeks ranks the best saved run per pilot, up to 50 pilots, with current-round and all-time filters. Up to 250 runs are retained in browser storage. Export a signed score and import a friend’s export to compare pilots. Imports check the canonical signed fields and wallet signature, and reject altered scores. A signature proves authorship of a client-reported score; it does not prove fair play. No global synchronization or authoritative anti-cheat service was supplied or invented. Browser storage can be cleared; keep an export for a durable copy. Storage failures show an export action.

## Source map

| Path                                    | Responsibility                                                               |
| --------------------------------------- | ---------------------------------------------------------------------------- |
| `src/game.ts`                           | Canvas renderer, physics, obstacles, collectibles, score and sound           |
| `src/GameArea.tsx`                      | Keyboard/touch input, overlays, pause and run lifecycle                      |
| `src/telemetry.ts`                      | Validated public telemetry, polling, freshness and mode selection            |
| `src/config.ts`                         | Public URLs, wallet chains/connectors and mobile links                       |
| `src/WalletSheet.tsx`                   | Wallet discovery, pending/error states and disconnect                        |
| `src/Views.tsx`, `src/Modal.tsx`        | Results, leaderboard, inspector, controls and native dialogs                 |
| `src/storage.ts`, `src/importScores.ts` | Local rankings, canonical attestations and verified import/export            |
| `src/styles.css`                        | Design tokens, components, responsive and motion rules                       |
| `scripts/`                              | Reproducible interaction/review scripts and share-card source                |
| `public/`                               | Required local fonts, wallet marks, favicon, share image and license notices |

## Validation and limitations

Final worker results: build and typecheck exited 0; 29 interaction checks passed across Chromium and WebKit. Axe reported no violations on the main screen and five modal types. The design probe passed 15/16 checks, with the requested hamster status emoji as its only flag. The full export is under 1 MB; the submission is below the 8 MiB limit.

Production build, explicit typecheck, meaningful browser interactions, rendered mobile/desktop review and the six Better Interface domains were checked. Actual command results, fixed defects, screenshots and remaining limits are recorded in [artifacts/validation.md](artifacts/validation.md). The design system is documented in [DESIGN.md](DESIGN.md).

Real wallet extensions, actual passkey creation, physical iOS/Android devices and a screen-reader session were not available. Wallet signing was validated with a simulated EIP-6963 provider and real cryptographic signatures; this does not certify every wallet app. The site is not an official Squeekchain service. Attribution and asset licenses are in [NOTICE.md](NOTICE.md), `licenses/` and the export’s `third-party-notices.txt`.
