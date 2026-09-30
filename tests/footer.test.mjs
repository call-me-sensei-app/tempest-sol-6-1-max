import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('footer links to the requested GitHub repository with opener isolation', () => {
  const source = readFileSync(new URL('../src/ui.ts', import.meta.url), 'utf8');
  const footer = source.match(/<footer class="footer">([\s\S]*?)<\/footer>/)?.[1];
  assert.ok(footer);
  const link = footer.match(/<a class="github-link"([^>]*)>GitHub ↗<\/a>/);
  assert.ok(link);
  assert.match(link[1], /href="https:\/\/github\.com\/call-me-sensei-app\/tempest-sol-6-1-max"/);
  assert.match(link[1], /target="_blank"/);
  assert.match(link[1], /rel="noopener noreferrer"/);
  assert.match(link[1], /aria-label="View Tempest source on GitHub"/);
});
