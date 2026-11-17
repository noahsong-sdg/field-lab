# Finite-coil playground responsiveness

Measured 2026-11-17 using headless Firefox 159.0, Node 24.22.1, Linux 6.18.57
x64, Intel Xeon Platinum 8573C. This is a shared cloud CPU, not a phone or a
performance guarantee. Timing is diagnostic, not a pass/fail CI gate.

## Results

| Angular segments per filament      | Before: main-thread callback median / p95 | Worker: main-thread callback median / p95 | Worker: input-to-rendered-result median / p95 |
| ---------------------------------- | ----------------------------------------- | ----------------------------------------- | --------------------------------------------- |
| 32 (default; 1,024 total segments) | 32 / 61 ms                                | 10.5 / 16 ms                              | 37 / 50 ms                                    |
| 128 (4,096 total segments)         | 76.5 / 163 ms                             | 9 / 12 ms                                 | 78.5 / 98 ms                                  |

The baseline is the synchronous implementation at `744de4e`. The after run uses
the worker implementation. At resolution 128, baseline callbacks ranged from
61 to 268 ms; after callbacks ranged from 6 to 14 ms. The measured benefit is
less continuous UI-thread blocking, **not faster numerical computation**.
End-to-end latency still includes physics, message transfer, scheduling and
rendering. It is not equivalent to the callback duration.

The worker computes both the analysis and field-map samples. The full segment
mesh is not transferred back. A synchronous fallback remains available when the
worker cannot run; it does not have the same responsiveness benefit.

## Method

- Start the app, select stage 6 and reset the playground.
- Instrument `requestAnimationFrame` before app scripts load, measuring the
  elapsed synchronous duration of each callback, not the time between frames.
- For each resolution, cycle the bore-radius slider (`#pg-a`) through
  50, 55, 60 and 65 mm using its normal `input` event.
- Discard five warmups and collect 30 updates. Baseline updates were spaced
  140 ms apart; the repeatable script keeps at least that interval and waits
  for each rendered result before issuing the next request.
- Record the longest RAF callback per update. The baseline draw contains physics
  and rendering; the worker draw contains rendering only. This measurement does
  not capture every main-thread task, browser paint, or compositor work.
- Separately measure input-to-rendered-result latency with a MutationObserver on
  `#pg-compute`, ending when the completed numerical-result status appears.
  This latency was added for the worker run; a directly comparable baseline
  latency was not recorded.
- Report median and nearest-rank p95 (29th sorted observation of 30).

## Reproduce

In one terminal:

```sh
npm run dev -- --host 127.0.0.1 --port 8765
```

In another, with Playwright Firefox installed:

```sh
node scripts/profile.mjs
```

Optional environment variables: `BASE_URL` selects a different local server;
`FIREFOX_EXECUTABLE_PATH` selects an existing Firefox executable. The script
prints environment metadata, summary statistics and per-update samples as JSON.
Run browser profiling alone when possible; parallel builds and tests can distort
timing. Repeat on representative physical mobile devices before setting a
product-level latency target.
