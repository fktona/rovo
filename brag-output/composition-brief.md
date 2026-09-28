# Hyperframes Composition Brief: Rovo

## Objective
Create a 21-second landscape launch film for Rovo centered on its real profile launch flow.

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape — 1280x720
- Duration: 21 seconds

## Source Material
- Project root: `/Users/faith/Documents/rovo`
- Primary files: `apps/web/src/app/layout.tsx`, `apps/web/src/app/how-it-works/page.tsx`, `apps/web/src/components/launch/launch-flow.tsx`, `apps/web/src/components/launch/launch-live.tsx`, `apps/web/src/app/globals.css`, and Rovo public logo assets.
- Product name: Rovo
- Strongest claim: “Put a person on the market.”
- Key UI: Self-Rove / Scout mode switch; Identity, Pair, First Buy, Review progress; pair selection; review card.
- Exact copy: “Scout someone before they launch.” and “Make a market around a profile.”

## Creative Direction
- Tone: polished; confident market launch film.
- Angle and detailed scene timing: see `brag-plan.md`.
- Avoid invented metrics, claims of completed transactions, and real profile details. The sample profile is fictional.

## Visual Identity
- Background #000000; surface #191919; text #ffffff; accent #ccff00; muted #737373.
- System sans font, matching the app.
- Use the product's rounded dark cards, lime active state, and real Rovo logo asset.

## Audio
- Music: `happy-beats-business-moves-vol-12-by-ende-dot-app.mp3`, quiet with end fade.
- Cue preset: bundled vol. 12, 109.96 BPM; notable 8.74s and 17.47s cues.
- Sparse clicks and soft reveal sounds tied to visible UI actions.
- Subtle lime edge presence can respond to strong moments.

## Implementation note
Hyperframes was unavailable in this environment: the CLI is neither installed nor cached, and package retrieval did not complete. The composition uses a local Pillow/ffmpeg renderer that follows the storyboard and keeps all assets local. `npx hyperframes check` could not run; the rendered MP4 will be checked with ffprobe and representative frames.
