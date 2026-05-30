# T-Central flight + hub form revision

## Implemented

- Added a stronger in-game free-flight preset to `components/StableSystemWorld.js`.
- Added six-axis movement support:
  - W/S or arrow up/down: forward/back
  - A/D or arrow left/right: strafe/roll response
  - Space/R: rise
  - Shift/F: descend
  - Ctrl: boost
- Added mouse-look orientation for free flight so movement follows the ship nose instead of only the world grid.
- Added ship reset control to return the player to the hub start vector.
- Added an in-game free-flight control grid inside the flight command deck.
- Rebuilt `/hub-form` to match the front page shell, cinematic background, Steam HUD, hero panel, and entry action layout.
- Added matching CSS for the new hub form visual cards and flight control help panel.

## Files edited

- `components/StableSystemWorld.js`
- `app/hub-form/page.js`
- `app/globals.css`

## Verification

- `npm run verify:api` passed.
- `npm run check:dyson-continuity` passed.
- `npm run build` was started, but this sandbox timed out during the Next.js optimized production build phase. The same timeout occurs on the baseline deployment revision package before these edits, so it is not introduced by the flight/hub-form changes.

## Vercel note

The package keeps the prior deployment revision baseline with Node `24.x`, no invalid Vercel runtime entry, and the patched dynamic API route settings from the last deployment pass.
