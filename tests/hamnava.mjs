import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash, createHmac, scryptSync } from 'node:crypto';
import { once } from 'node:events';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { createServer, request } from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { normalizeSlug, validSlug } from '../ops/music/slug.mjs';
import { chord, noteSequence } from '../src/music/notation.ts';

assert.equal(normalizeSlug('  يک  آهنگ ۲ '), 'یک-آهنگ-2');
assert.equal(validSlug('می‌روم'), true);
for (const invalid of ['api', '../music', 'https://host/path', '']) assert.equal(validSlug(invalid), false);
assert.equal(chord('Am/C', 2).label, 'Bm/D');
assert.equal(chord('C/E/invalid'), null);
assert.equal(noteSequence('B4  C5', 1), 'C5  C♯5');

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.HAMNAVA_PLAYWRIGHT || 'playwright');
const temp = await mkdtemp(join(tmpdir(), 'hamnava-'));
const database = join(temp, 'pieces.sqlite');
const legacy = 'legacy-piece-01234567890';
const owner = createHash('sha256').update('test-only').digest('base64url');
const password = 'test-admin-password';
const salt = Buffer.alloc(16, 1);
const digest = scryptSync(password, salt, 32, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 });
const seed = new DatabaseSync(database);
seed.exec('CREATE TABLE pieces (id TEXT PRIMARY KEY, title TEXT, artist TEXT, root INTEGER, mode TEXT, score TEXT, video TEXT, listed INTEGER, revision INTEGER)');
seed.prepare('INSERT INTO pieces VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(legacy, 'اثر قدیمی', '', 0, 'major', 'متن', 'https://example.com/legacy.mp4', 0, 1);
seed.close();

const backPort = 39043;
const origins = { admin: 'http://127.0.0.1:39041', music: 'http://127.0.0.1:39042' };
const fronts = Object.entries(origins).map(([name, origin]) => createServer(async (req, res) => {
  const pathname = new URL(req.url, origin).pathname;
  const isAsset = pathname.startsWith('/_astro/') || pathname.startsWith('/brand/') || pathname.startsWith('/fonts/');
  if (pathname === '/' || isAsset) {
    const file = pathname === '/' ? (name === 'admin' ? 'music-admin' : 'music') + '/index.html' : pathname.slice(1);
    const mime = { html: 'text/html; charset=utf-8', js: 'text/javascript', css: 'text/css', svg: 'image/svg+xml', png: 'image/png', woff: 'font/woff' };
    try {
      const asset = await readFile(resolve('dist', file));
      res.writeHead(200, { 'Content-Type': mime[file.split('.').at(-1)] || 'application/octet-stream' }).end(asset);
    } catch { res.writeHead(404).end(); }
    return;
  }
  const upstream = request({ hostname: '127.0.0.1', port: backPort, path: req.url, method: req.method, headers: req.headers }, (response) => {
    res.writeHead(response.statusCode, response.headers);
    response.pipe(res);
  });
  upstream.on('error', () => res.writeHead(502).end());
  req.pipe(upstream);
}).listen(Number(new URL(origin).port), '127.0.0.1'));
const server = spawn(process.execPath, [resolve('ops/music/server.mjs')], {
  cwd: resolve('dist'), stdio: 'inherit',
  env: { ...process.env, HAMNAVA_DATABASE: database, HAMNAVA_MEDIA_DIR: join(temp, 'media'), HAMNAVA_OWNER_KEY: owner,
    HAMNAVA_ADMIN_USERNAME: 'qa', HAMNAVA_ADMIN_PASSWORD_HASH: salt.toString('hex') + ':' + digest.toString('hex'),
    HAMNAVA_PORT: String(backPort), HAMNAVA_ORIGIN: origins.music, HAMNAVA_ADMIN_ORIGIN: origins.admin },
});
const stopped = once(server, 'exit');
let browser;
try {
  for (let attempt = 0; attempt < 30; attempt++) {
    if ((await fetch(origins.music + '/api/pieces')).ok) break;
    await new Promise((done) => setTimeout(done, 100));
  }
  assert.equal((await fetch(origins.music + '/api/pieces/' + legacy)).status, 200);
  const migrated = await (await fetch(origins.music + '/api/slug/' + encodeURIComponent('اثر-قدیمی'))).json();
  assert.equal(migrated.visibility, 'unlisted');
  assert.equal(migrated.takes[0].url, 'https://example.com/legacy.mp4');
  const oldInvite = createHmac('sha256', owner).update('score:' + legacy).digest('base64url');
  const guest = await fetch(origins.music + '/api/pieces/' + legacy, {
    method: 'PUT', headers: { Origin: origins.music, 'Content-Type': 'application/json', Authorization: 'Bearer ' + oldInvite },
    body: JSON.stringify({ score: 'متن قدیمی', revision: 1 }),
  });
  assert.equal(guest.status, 200);

  browser = await chromium.launch({ channel: process.env.HAMNAVA_BROWSER || 'chrome', headless: true });
  const admin = await browser.newPage();
  const errors = [];
  admin.on('pageerror', (error) => errors.push(error.message));
  admin.on('dialog', (dialog) => dialog.accept());
  admin.setDefaultTimeout(10000);
  await admin.goto(origins.admin);
  await admin.locator('#admin-username').fill('qa');
  await admin.locator('#admin-password').fill(password);
  await admin.locator('#unlock button').click();
  await admin.locator('#new-piece').click();
  await admin.locator('#title').fill('رهایم کن');
  assert.equal(await admin.locator('#slug').inputValue(), 'رهایم-کن');
  await admin.locator('#visual-score textarea').fill('متن نمونه');
  await admin.locator('#visual-score button').first().click();
  await admin.locator('#chord-input').fill('Am');
  await admin.locator('#add-intro').click();
  await admin.locator('#raw-mode').click();
  assert.equal(await admin.locator('#score-input').inputValue(), '[Am]     متن نمونه');
  const score = '[Am]من آغاز\n[Am]     من بعد\nمن [Am]باید ولی [G]دلم\n[Am]   [G]     من سوم\n[C] [G]';
  await admin.locator('#score-input').fill(score);
  await admin.locator('#original-key').selectOption('9');
  await admin.locator('#mode').selectOption('minor');
  await admin.locator('#metadata-fields').evaluate((el) => { el.parentElement.open = true; });
  await admin.locator('[data-metadata=timeSignature]').fill('6/8');
  await admin.locator('[data-metadata=rhythm]').fill('آرام');
  await admin.locator('#edit-form button[type=submit]').click();
  await admin.waitForURL('**/?piece=*');
  const id = new URL(admin.url()).searchParams.get('piece');
  assert.equal((await fetch(origins.music + '/api/pieces/' + id)).status, 404);
  assert.equal((await fetch(origins.music + '/' + encodeURIComponent('رهایم-کن'))).status, 404);
  const callAdmin = (path, method, data) => admin.evaluate(async ({ path, method, data }) => {
    const response = await fetch(path, {
      method, headers: data ? { 'Content-Type': 'application/json' } : {},
      body: data ? JSON.stringify(data) : undefined,
    });
    return { status: response.status, body: await response.json().catch(() => null) };
  }, { path, method, data });
  const fetched = await callAdmin('/api/pieces/' + id, 'GET');
  assert.equal(fetched.status, 200, JSON.stringify(fetched.body));
  const body = fetched.body;
  assert.equal(body.score, score);
  const duplicate = await callAdmin('/api/owner/pieces', 'POST', body);
  assert.equal(duplicate.status, 409);
  const upload = await admin.evaluate(async () => {
    const response = await fetch('/api/owner/upload', {
      method: 'POST', headers: { 'Content-Type': 'audio/wav' }, body: 'RIFF1234WAVE5678',
    });
    return { status: response.status, body: await response.json() };
  });
  assert.equal(upload.status, 201, JSON.stringify(upload.body));
  const { url } = upload.body;
  assert.equal((await fetch(origins.music + url)).status, 404);
  const take = { url, kind:'audio', title:'آزمون', recorded:'', instrument:'', notes:'', visibility:'private' };
  const published = await callAdmin('/api/pieces/' + id, 'PUT', {
    ...body, listed:true, visibility:'published', takes:[take, {...take, url:'https://example.com/music.mp3',visibility:'public'}],
  });
  assert.equal(published.status, 200);
  const saved = published.body;
  assert.equal(saved.takes.length, 2);
  assert.equal((await fetch(origins.music + url)).status, 404);
  assert.equal((await (await fetch(origins.music + '/api/pieces/' + id)).json()).takes.length, 1);
  assert.equal((await callAdmin(url, 'GET')).status, 200);

  const mobile = await browser.newPage({ viewport: { width: 390, height: 800 }, isMobile: true });
  mobile.on('pageerror', (error) => errors.push(error.message));
  await mobile.goto(origins.music + '/' + encodeURIComponent(saved.slug));
  await mobile.locator('#piece-title').waitFor();
  await mobile.reload();
  await mobile.locator('#piece-title').waitFor();
  const rows = mobile.locator('#score .lyric');
  assert.equal(await rows.nth(0).locator('.chord-start:not(.intro)').count(), 1);
  assert.equal(await rows.nth(1).locator('.intro').count(), 1);
  assert.equal(await rows.nth(2).locator('.intro').count(), 0);
  assert.deepEqual(await rows.nth(3).locator('.intro button').allTextContents(), ['Am','G']);
  assert.equal(await rows.nth(4).locator('.solo').count(), 2);
  await rows.nth(1).locator('.intro button').click();
  assert.match(await mobile.locator('#piano').innerText(), /Am/);
  assert.equal(await mobile.locator('#key option').first().textContent(), 'C');
  await mobile.locator('#key').selectOption('2');
  assert.match(await mobile.locator('#piece-key').innerText(), /لا مینور.*ر مینور.*6\/8/);
  assert.deepEqual(await rows.nth(3).locator('.intro button').allTextContents(), ['Dm','C']);
  await mobile.locator('#chords').uncheck();
  assert.equal(await rows.nth(1).textContent(), 'من بعد');
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth), 390);
  await mobile.locator('#perform').click();
  assert(await mobile.locator('body.performance').count());

  const alias = await callAdmin('/api/pieces/' + id, 'PUT', { ...saved, slug:'رهایم-کن-تازه', visibility:'unlisted' });
  assert.equal(alias.status, 200);
  await mobile.goto(origins.music + '/' + encodeURIComponent(saved.slug));
  await mobile.waitForURL('**/' + encodeURIComponent('رهایم-کن-تازه'));
  assert.equal((await (await fetch(origins.music + '/api/pieces')).json()).length, 0);
  assert.equal((await fetch(origins.music + '/unknown-slug')).status, 404);
  assert.equal((await callAdmin('/api/owner/pieces/' + id + '/invite', 'POST')).status, 200);
  assert.equal((await callAdmin('/api/pieces/' + id, 'DELETE')).status, 200);
  assert.equal((await fetch(origins.music + '/' + encodeURIComponent(saved.slug))).status, 404);
  assert.deepEqual(errors, []);
  console.log('Hamnava browser, legacy migration, visibility, media, chord placement and slug checks passed.');
} finally {
  await browser?.close();
  fronts.forEach((front) => front.close());
  server.kill();
  await stopped;
  await rm(temp, { recursive: true, force: true });
}
