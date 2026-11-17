import { test } from '@playwright/test';
import { runBrowserChecks as chapter } from '../test.mjs';
import { runBrowserChecks as design } from '../design-test.mjs';
import { runBrowserChecks as playground } from '../playground-test.mjs';
import { runBrowserChecks as integrated } from '../integrated-test.mjs';

for (const [name, checks] of Object.entries({ chapter, design, playground, integrated })) {
  test(`${name}: model and browser regression suite`, async ({ browser }, testInfo) => {
    await checks(browser, testInfo);
  });
}
