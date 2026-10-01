import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

// The scene can be served from a sub-path (Vite's `base`), so same-origin URLs must resolve against the base URL or
// be relative. Root-absolute ones would leave the sub-path.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const rootAbsolute = /(?:href|src)="\/(?!\/)|(?:href|src)=\\"\/(?!\/)|fetch\(\s*['"`]\/(?!\/)/g;
// The benchmark recorder only exists on the local Vite dev server (vite.config.ts), which serves it from the root.
const allowed = new Set(["fetch('/__benchmark'"]);

test('scene source resolves same-origin URLs against the base URL', () => {
  const offenders = [];
  for (const name of readdirSync(new URL('../src/', import.meta.url))) {
    if (!/\.(ts|js)$/.test(name)) continue;
    const source = read(`src/${name}`);
    for (const match of source.matchAll(rootAbsolute)) {
      const context = source.slice(match.index, match.index + 40);
      if (![...allowed].some((prefix) => context.startsWith(prefix))) offenders.push(`src/${name}: ${context}`);
    }
  }
  assert.deepEqual(offenders, []);
  assert.match(read('src/ui.ts'), /const base=import\.meta\.env\.BASE_URL;/);
});

test('published reports link to their neighbours relatively', () => {
  for (const path of ['public/caustics-report.html', 'public/report.html']) {
    const html = read(path);
    assert.deepEqual(html.match(/(?:href|src)="\/(?!\/)[^"]*"/g) ?? [], [], path);
  }
});
