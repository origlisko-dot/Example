# 🎬 The Last Body at Vale House
A complete gothic-horror short, produced end-to-end with the **Higgsfield Connector**
(Higgsfield AI) from the provided script.

## Watch it
- **One-click web player:** open [`player.html`](player.html) in any browser → press play.
  It streams all 25 shots in order, lays the 6 voice tracks on their beats, and
  bookends the film with the title and end cards. ~2m20s.
- **Single film file:** `THE_LAST_BODY_AT_VALE_HOUSE.mp4` (1280×720, ~137s) — delivered
  to the requester and rebuildable any time with [`assemble_film.sh`](assemble_film.sh)
  (`bash assemble_film.sh`, needs `ffmpeg` + `curl`).

## How it was made (and how to read these docs)
| File | What it is |
|------|-----------|
| `01_PRODUCTION_BIBLE.md` | Logline, style guide, continuity system, 12-sequence / 57-shot breakdown |
| `02_ASSET_MANIFEST.md` | The 17 reusable **Elements** (cast, sets, prop) + IDs |
| `03_SHOT_LOG.md` | All 57 keyframes (`nano_banana_pro`) per shot |
| `04_ANIMATION_LOG.md` | 25 animated hero shots (`kling3_0_turbo`) + 6 VO tracks (ElevenLabs) |
| `05_DELIVERY.md` | Ordered watch list with every playable MP4 / MP3 URL |
| `player.html` | Self-contained web player (streams from CDN) |
| `assemble_film.sh` | Reproducible ffmpeg edit → the single MP4 |

## Continuity
Every recurring character, location, and the black mirror is a Higgsfield **Element**,
re-injected into each shot prompt — so faces (Mara, Daniel, Father Elias, Samuel…),
the sets, and the cursed mirror stay consistent across all 57 shots.

## Pipeline
`nano_banana_pro` (57 keyframes) → `kling3_0_turbo` (25 i2v hero clips) →
`text2speech_v2_elevenlabs` (6 voices) → `ffmpeg` edit (title + shots + VO + end card).
