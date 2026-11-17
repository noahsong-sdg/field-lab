# Stack decisions

Field Lab is a static educational simulator, not a backend service. Its numerical
models execute in the browser. Python previously served static files only; it did
not run the physics.

## Implemented

- Strict TypeScript and ES modules replace global classic-script dependencies.
- Vite provides development serving and a production bundle; Node 24 is the
  development/CI baseline. The shipped app has no runtime package dependencies.
- Locked dependencies, ESLint, readable formatting, model/state tests, production
  build and Playwright browser tests form explicit quality gates.
- CI exercises Chromium, Firefox and WebKit, plus touch emulation. Passing checks
  are required evidence, not a substitute for physical-device validation.
- Chapter restart resets integrated stage controls and kept designs as well as
  progress. A dedicated browser regression guards this behavior.
- A module Web Worker computes numerical analysis and field-map samples away
  from the UI thread. One active job and one replaceable latest snapshot bound
  work; full-state keys reject stale results. One-result caching reuses physics
  and field-map vectors on layout redraws.
- Keep and grading cannot use stale/pending results. Worker startup, runtime,
  message and timeout failures use the same numerical code synchronously.
  A visible status identifies fallback; it favors functionality, not performance.

## Deliberate choices and remaining work

TypeScript improves correctness and maintenance, not numerical execution speed.
A language rewrite is not justified by the current workload. Keep the portable
browser models unless measured workloads demonstrate a need for another kernel.

See [PERFORMANCE.md](PERFORMANCE.md) for measured responsiveness and reproduction.

Worker computation and numerical parity are regression-tested, including the
production build's bundled worker URL. Target-device profiling remains useful;
the worker avoids UI-thread blocking but does not promise faster numerical work.
Probe-only incremental computation remains a possible measured optimization.
WebAssembly/C++ is a later option for a measured kernel bottleneck; Julia is more
appropriate for a separate research solver than a mandatory browser runtime.

Model identities, limits, convergence and saved-state migration tests protect
behavior; they do not establish engineering-design validity. The existing
educational and conductor-peak sampling caveats remain in the interface.

Deployment is separate: configure CSP and host security headers for the actual
static host and test its deployed URL. No analytics, backend, new cloud account,
or deployment was introduced. Screenshot artifacts are not approved visual
regression baselines. Licensing requires the owner's choice and is unchanged.

## Dependency audit limitation

The modernization-time `npm audit --omit=dev` reported zero runtime advisories.
The full development audit reported GHSA-fc5q-39xc-vjpf (picomatch repeated-extglob
ReDoS), propagated through Vite and TypeScript-ESLint's glob tooling. The registry's
latest picomatch was 4.0.7, within the affected range. Do not interpret the runtime
result as a clean development audit. Avoid processing untrusted glob patterns;
track the upstream patch rather than blindly downgrade the toolchain to npm's
suggested old major versions. Re-run the full audit when updating dependencies.

Rechecked November 17, 2026: the [official GitHub advisory](https://github.com/advisories/GHSA-fc5q-39xc-vjpf)
lists no patched release; the npm registry still reports 4.0.7 as latest. No
unreviewed fork, suppressed audit result, or speculative downgrade was applied.
The static production app does not accept glob patterns or ship this package.
