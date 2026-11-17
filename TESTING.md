# Development and verification

Use Node.js 24 LTS (`.nvmrc`) and the locked dependencies:

```sh
npm ci
npm run dev
```

Open the URL Vite prints. There is no backend or Python requirement. The production
build is static HTML/CSS/JavaScript; TypeScript checks the source at development time.

## Quality gates

```sh
npm run typecheck
npm run lint
npm run test:unit
npm run build
npx playwright install chromium firefox webkit
npm run test:browser
```

Playwright manages its own local server. Do not start a second server for the test
suite. The regression suites cover all learning challenges, analytical identities,
limits, convergence, model constraints, migrations, invalid persisted values,
duplicate completion credit, reference guides, keyboard focus, responsive layouts
and 200%-text reflow. These tests do not establish engineering-design validity.

The browser projects cover Chromium, Firefox and WebKit. Additional Pixel/iPhone
projects use browser touch/device emulation, **not physical-device certification**.
A real iPhone/Safari smoke check is still advisable before a public release.

Failure screenshots and traces are written to `test-results/`; inspect the HTML
report with `npx playwright show-report`. Historical preview screenshots are still
captured as artifacts, not treated as visual regression baselines. Add and review
platform-specific `toHaveScreenshot` baselines before enabling visual comparison
as a CI gate; do not silently bless screenshots generated from broken behavior.

## Production serving

```sh
npm run build
npm run preview
```

`dist/` is suitable for a static host. The preview server is for local inspection,
not production. Hosting and deployment are separate from these tests. At deployment,
configure CSP and other security headers for the selected host, then smoke-test the
actual URL. No hosting, account, analytics or backend is required for the app.

The CI workflow runs the locked install, typecheck, lint, model tests, build and
browser suites. Keep numerical outputs, saved-state migrations and educational
limitations intact when changing the implementation.

For local diagnostics only, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to an existing
Chromium binary. CI intentionally uses Playwright's pinned browsers instead; a
system-browser pass does not replace verification against those pinned versions.
