# Mirror Practice

A single-file, browser-based rehearsal desk: load a reference clip, record your own take
next to it, review both in sync, and download a stacked video with the reference on top and
your take below.

Everything runs locally in the browser — no server, no build step, no uploads. Camera
footage and imported clips never leave the device.

```
┌─────────────────────────┐
│   reference (trimmed)   │   ← crop / resize / delay
├─────────────────────────┤   ← border (thickness + colour)
│      your take          │   ← crop / resize
└─────────────────────────┘
```

## Features

- **Reference sources** — local file (MP4/MOV/WebM/MKV/AVI), direct video URL, or
  YouTube / Vimeo links (embedded through their official players).
- **Trim** the reference; the take length is derived from the trimmed span.
- **Crop** either clip by dragging a box on the stage, or with percentage sliders.
- **Resize** each clip independently (240–1920 px output width).
- **Camera capture** via `getUserMedia`, with device picker, 3-2-1 countdown and
  automatic stop at the record limit.
- **Mirror preview** so you see yourself as in a mirror (preview only — not recorded).
- **Review** mode plays the take and reference together with drift correction.
- **Export** a merged video (reference above, take below, border baked in), or download
  either clip on its own. Crop, resize, trim and border are all applied.
- **Sticky settings** — crops, trims, widths, border, delay, mute/loop and mirror state are
  stored in a cookie for a year.
- Responsive layout down to phone width, with `prefers-reduced-motion` support.

## Quick start

The app needs a secure context for camera access, so serve it over `localhost` rather than
opening the file directly:

```bash
python3 -m http.server 8130
# then open http://127.0.0.1:8130/index.html
```

Any static server works. There is nothing to install or compile.

### Requirements

- A Chromium-based browser or Firefox with `MediaRecorder` and `canvas.captureStream`.
- Camera/microphone permission (required only for recording).
- Recording format is negotiated: `video/mp4` (H.264/AAC) where supported, otherwise
  `video/webm` (VP9/VP8 + Opus).

## Workflow

The header tracks four steps, and each stage has a panel of controls.

1. **Reference** — drop a file on the stage, choose one, or paste a URL. YouTube and Vimeo
   links embed their player; direct `.mp4`/`.webm` links play natively and can be exported.
2. **Record** — enable the camera, then hit *Record*. A 3-2-1 countdown runs, the take
   starts, and recording stops by itself at `trim length + reference delay`.
3. **Review** — *Play both* runs the take from 0 and brings the reference in after the
   configured delay, resyncing if the two drift apart.
4. **Export** — *Download merged* renders the stacked video. Rendering happens in real
   time, so keep the tab open until the download starts; the export can be cancelled.

### Layout & timing

The footer panel controls how the merged video is composed:

| Setting | Range | Effect |
| --- | --- | --- |
| Border thickness | 0–40 px | Gap drawn between the two clips |
| Border colour | any hex | Fill for that gap |
| Reference delay | 0–3 s | Reference joins this long after the take in review and export |

The merged canvas uses `max(reference width, take width)` so the stack has no side gaps,
and its duration is `min(take length, delay + trim length)`. Recording itself starts both
clips together and simply allows the delay as extra time.

### Keyboard shortcuts

| Key | Action |
| --- | --- |
| `R` | Start / stop recording |
| `Space` | Play both |
| `E` | Export merged video |
| `Enter` | Apply the active crop selection |
| `Esc` | Cancel the crop selection / close the discard dialog |

Shortcuts are ignored while typing in an input.

## How it works

`index.html` contains the markup, CSS and a single IIFE holding all logic.

- **State** — one `state` object holds the reference (kind, blob, trim, crop, output width),
  camera stream, take blob/duration, playback flags and layout settings.
- **Recording** — `MediaRecorder` runs on the camera `MediaStream`; chunks are collected and
  turned into a `Blob` with a `blob:` URL for playback.
- **Review sync** — a timer compares the take clock with the reference clock and seeks the
  take if they drift more than ~0.45 s.
- **Export** — each clip is drawn into an offscreen `<canvas>` with `drawImage` using the
  crop rectangle; the canvas is captured with `captureStream(30)`, audio is mixed through an
  `AudioContext` destination, and the combined stream is recorded to MP4/WebM. The finished
  blob is downloaded as `merged-<timestamp>.<ext>` (or `reference-…` / `take-…`).
- **Embeds** — YouTube and Vimeo are driven over `postMessage` with their iframe APIs, which
  is why embedded references cannot be cropped or downloaded (there is no local blob).
- **Preferences** — a versioned JSON cookie (`mirrorPracticePrefs`, v2) is written on change
  and restored on load; trim is re-applied once the reference reports its duration.

## Project structure

```
index.html        the entire app (markup + styles + script)
.qa/              Playwright QA scripts and media fixtures (development only)
screenshots/      UI captures taken by the QA scripts (development only)
index.html.bak    older snapshot, not referenced by the app
.gitattributes    Git LFS rules for *.mp4 and *.y4m
```

## QA scripts

`.qa/` holds ~58 standalone Playwright scripts that drive the real UI against
`http://127.0.0.1:8130/index.html`. They expect Chrome, fake media devices, and a local
server on port 8130:

```bash
python3 -m http.server 8130        # in the repo root
node .qa/ui-flow.js                # in another shell
```

Each script launches Chromium with `--use-file-for-fake-video-capture=.qa/cam.y4m`, walks
the workflow and prints assertions or writes screenshots; most also clear the preferences
cookie first so runs start from defaults. They import `playwright-core` from a hardcoded global install path, so adjust
that `require(...)` line if your Playwright lives elsewhere. The scripts are development
tooling only and are not needed to run the app.

## Notes and limitations

- Media fixtures (`.qa/*.mp4`, `.qa/*.y4m`) are tracked with Git LFS. Clone with
  `git lfs install` first, otherwise those files arrive as pointers.
- Embedded YouTube/Vimeo references can be trimmed and played, but not cropped or exported;
  use a direct video file or URL for full export support.
- Export is real-time and CPU-bound: a 60 s take takes about a minute to render.
- Recording stops at `trim + delay`; if the delay is longer than the take, the merged export
  warns that the reference will be cut short.
- Large source files are handled entirely in memory; very long clips may strain low-memory
  devices.
