import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('home landing page does not expose MatrixCoinExchange route content', async () => {
  const homePage = await readFile(new URL('../app/page.js', import.meta.url), 'utf8');

  assert.equal(/matrixcoinexchange/i.test(homePage), false);
  assert.equal(homePage.includes('https://matrixcoinexchange.com'), false);
});
