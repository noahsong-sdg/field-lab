# Run locally

Requires Python 3 and Node.js 20 or newer.

```sh
npm run serve
```

Open http://127.0.0.1:8765. This static site has no backend.

## Check the models

```sh
npm run test:unit
node references-test.cjs
```

These checks need no installed npm dependencies. They test analytic identities,
limits, numerical convergence, model constraints, saved-state migration, and the
citation-only reader. They do not validate browser rendering or establish that
the simplified models are suitable for engineering design.

## Browser integration checks

```sh
npm install
npx playwright install chromium
npm test
```

Keep `npm run serve` running in a separate terminal during these browser checks;
they expect the site at port 8765. Field Lab is an educational model, not a magnet design tool.
