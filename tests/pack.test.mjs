import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
test('README local documentation and image targets are in publish allowlist', () => {
 const root = new URL('../', import.meta.url);
 const pkg = JSON.parse(readFileSync(new URL('package.json', root)));
 for (const name of ['README.md', 'README.zh-CN.md']) {
  const text = readFileSync(new URL(name, root), 'utf8');
  for (const match of text.matchAll(/\]\((docs[/][^)#]+)(?:#[^)]*)?\)/g)) {
   assert.ok(existsSync(new URL(match[1], root)), match[1] + ' must exist');
   assert.ok(pkg.files.includes(match[1]), match[1] + ' must ship in npm tarball');
  }
 }
});
