import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { resolveVideo } from './video.mjs';
import { mediaName, serveMedia, upload } from './media.mjs';
import { normalizeSlug, validSlug } from './slug.mjs';

const {
  HAMNAVA_OWNER_KEY: owner,
  HAMNAVA_DATABASE: database,
  HAMNAVA_ADMIN_USERNAME: adminUsername,
  HAMNAVA_ADMIN_PASSWORD_HASH: passwordHash,
} = process.env;
const publicSite = new URL(process.env.HAMNAVA_ORIGIN ?? 'https://music.amirhossein-danesh.ir');
const adminSite = new URL(process.env.HAMNAVA_ADMIN_ORIGIN ?? 'https://music-admin.amirhossein-danesh.ir');
const keyPattern = /^[\w-]{43}$/;
if (!owner || !keyPattern.test(owner) || !database) throw new Error('Hamnava requires an owner key and database path.');

const verifier = /^([a-f0-9]{32}):([a-f0-9]{64})$/.exec(passwordHash ?? '');
if (!adminUsername || !verifier) throw new Error('Hamnava requires an admin username and password verifier.');
const passwordSalt = Buffer.from(verifier[1], 'hex');
const passwordDigest = Buffer.from(verifier[2], 'hex');
const sessionCookie = '__Host-hamnava-session';
const sessionSeconds = 8 * 60 * 60;
let failedLogins = 0;
let failureWindow = 0;

const db = new DatabaseSync(database);
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS pieces (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, artist TEXT NOT NULL,
    root INTEGER NOT NULL, mode TEXT NOT NULL, score TEXT NOT NULL,
    video TEXT NOT NULL, listed INTEGER NOT NULL, revision INTEGER NOT NULL
  );
`);
db.exec('BEGIN IMMEDIATE');
try {
  const columns = db.prepare('PRAGMA table_info(pieces)').all().map((column) => column.name);
  if (!columns.includes('slug')) db.exec("ALTER TABLE pieces ADD COLUMN slug TEXT");
  if (!columns.includes('metadata')) db.exec("ALTER TABLE pieces ADD COLUMN metadata TEXT NOT NULL DEFAULT '{}'");
  if (!columns.includes('visibility')) {
    db.exec("ALTER TABLE pieces ADD COLUMN visibility TEXT NOT NULL DEFAULT 'unlisted'");
    db.exec("UPDATE pieces SET visibility = 'published' WHERE listed = 1");
  }
  if (!columns.includes('invite_version')) db.exec("ALTER TABLE pieces ADD COLUMN invite_version INTEGER NOT NULL DEFAULT 0");
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS current_piece_slug ON pieces(slug)");
  db.exec("CREATE TABLE IF NOT EXISTS performance_takes (id TEXT PRIMARY KEY, piece_id TEXT NOT NULL REFERENCES pieces(id), title TEXT NOT NULL, url TEXT NOT NULL, kind TEXT NOT NULL, recorded TEXT NOT NULL, instrument TEXT NOT NULL, notes TEXT NOT NULL, visibility TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)");
  db.exec("INSERT OR IGNORE INTO performance_takes (id, piece_id, title, url, kind, recorded, instrument, notes, visibility) SELECT 'legacy-' || id, id, 'اجرای اصلی', video, 'video', '', '', '', 'public' FROM pieces WHERE video <> '' AND NOT EXISTS (SELECT 1 FROM performance_takes WHERE piece_id = pieces.id)");
  db.exec('CREATE TABLE IF NOT EXISTS piece_slugs (slug TEXT PRIMARY KEY, piece_id TEXT NOT NULL REFERENCES pieces(id))');
  const addAlias = db.prepare('INSERT INTO piece_slugs (slug, piece_id) VALUES (?, ?)');
  const setSlug = db.prepare('UPDATE pieces SET slug = ? WHERE id = ?');
  for (const row of db.prepare('SELECT id, title FROM pieces WHERE slug IS NULL').all()) {
    let base = normalizeSlug(row.title).slice(0, 94).replace(/-+$/, '');
    if (!validSlug(base)) base = 'قطعه';
    let slug = base;
    let count = 2;
    while (db.prepare('SELECT 1 FROM piece_slugs WHERE slug = ?').get(slug)) slug = base + '-' + count++;
    addAlias.run(slug, row.id);
    setSlug.run(slug, row.id);
  }
  db.exec('COMMIT');
} catch (error) {
  db.exec('ROLLBACK');
  throw error;
}
const getSlug = db.prepare('SELECT pieces.* FROM pieces JOIN piece_slugs ON pieces.id = piece_slugs.piece_id WHERE piece_slugs.slug = ?');
const findSlug = db.prepare('SELECT piece_id FROM piece_slugs WHERE slug = ?');
const addSlug = db.prepare('INSERT INTO piece_slugs (slug, piece_id) VALUES (?, ?)');
const setSlug = db.prepare('UPDATE pieces SET slug = ? WHERE id = ?');

function assignSlug(id, value) {
  const slug = normalizeSlug(value);
  if (!validSlug(slug)) throw clientError(400, 'نشانی قطعه معتبر نیست. فقط حروف، عدد، نیم‌فاصله و خط تیره وارد کن.');
  const existing = findSlug.get(slug);
  if (existing && existing.piece_id !== id) throw clientError(409, 'این نشانی قبلاً استفاده شده است.');
  if (!existing) addSlug.run(slug, id);
  setSlug.run(slug, id);
}
const get = db.prepare('SELECT * FROM pieces WHERE id = ?');
const list = db.prepare("SELECT id, title, slug FROM pieces WHERE visibility = 'published' ORDER BY rowid DESC");
const owned = db.prepare('SELECT id, title, slug, visibility FROM pieces ORDER BY rowid DESC');
const insert = db.prepare(`
  INSERT INTO pieces (id, title, artist, root, mode, score, video, listed, revision)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
`);
const update = db.prepare(`
  UPDATE pieces SET title = ?, artist = ?, root = ?, mode = ?, score = ?, video = ?,
  listed = ?, revision = revision + 1 WHERE id = ? AND revision = ?
`);

const clientError = (status, message) => Object.assign(new Error(message), { status });
const invite = (row) => createHmac('sha256', owner)
  .update('score:' + row.id + (row.invite_version ? ':' + row.invite_version : '')).digest('base64url');
const matches = (actual, expected) => keyPattern.test(actual) &&
  timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
const metadataNames = ['composer', 'lyricist', 'instrument', 'timeSignature', 'rhythm', 'tempo', 'dastgah', 'difficulty', 'notes'];
const readable = (row) => row && ['published', 'unlisted'].includes(row.visibility);
const getTakes = db.prepare('SELECT id, title, url, kind, recorded, instrument, notes, visibility, created_at, updated_at FROM performance_takes WHERE piece_id = ? ORDER BY rowid');
function expose(row, isOwner = false) {
  const { invite_version, metadata, ...fields } = row;
  const takes = getTakes.all(row.id).filter((take) => isOwner || take.visibility === 'public');
  return { ...fields, video: takes.find((take) => take.kind === 'video')?.url ?? '', metadata: JSON.parse(metadata), listed: Boolean(row.listed), takes };
}

function updateDetails(id, input) {
  const row = get.get(id);
  const visibility = input.visibility ?? (input.listed ? 'published' : row.visibility === 'published' ? 'unlisted' : row.visibility);
  if (!['published', 'unlisted', 'private', 'draft'].includes(visibility)) throw clientError(400, 'وضعیت انتشار معتبر نیست.');
  const metadata = input.metadata === undefined ? JSON.parse(row.metadata) : {};
  for (const name of metadataNames) {
    if (input.metadata === undefined) break;
    const value = input.metadata?.[name] ?? '';
    if (typeof value !== 'string' || value.length > (name === 'notes' ? 2000 : 120)) throw clientError(400, 'مشخصات قطعه معتبر نیست.');
    metadata[name] = value.trim().replace(/[۰-۹]/g, (digit) => name === 'tempo' ? String(digit.charCodeAt(0) - 1776) : digit);
  }
  if (metadata.tempo && (!/^\d+$/.test(metadata.tempo) || Number(metadata.tempo) < 20 || Number(metadata.tempo) > 300)) {
    throw clientError(400, 'سرعت را به صورت عددی بین ۲۰ و ۳۰۰ وارد کن.');
  }
  db.prepare("UPDATE pieces SET metadata = ?, visibility = ?, listed = ?, invite_version = invite_version + ? WHERE id = ?")
    .run(JSON.stringify(metadata), visibility, Number(visibility === 'published'),
      Number(readable(row) && ['private', 'draft'].includes(visibility)), id);
  if (input.takes === undefined) {
    if (input.video) {
      db.prepare("INSERT INTO performance_takes (id, piece_id, title, url, kind, recorded, instrument, notes, visibility) VALUES (?, ?, 'اجرای اصلی', ?, 'video', '', '', '', 'public') ON CONFLICT(id) DO UPDATE SET url = excluded.url, updated_at = CURRENT_TIMESTAMP")
        .run('legacy-' + id, id, input.video);
    } else if (input.video === '') {
      db.prepare('DELETE FROM performance_takes WHERE id = ? AND piece_id = ?').run('legacy-' + id, id);
    }
    return;
  }
  if (!Array.isArray(input.takes) || input.takes.length > 20) throw clientError(400, 'تا ۲۰ اجرا برای هر قطعه قابل ثبت است.');
  const previous = new Map(getTakes.all(id).map((take) => [take.id, take]));
  const insertTake = db.prepare('INSERT INTO performance_takes VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP)');
  const used = new Set();
  db.prepare('DELETE FROM performance_takes WHERE piece_id = ?').run(id);
  for (const take of input.takes) {
    const { title, url, kind, recorded, instrument, notes, visibility } = take ?? {};
    if ([title, url, recorded, instrument, notes].some((part) => typeof part !== 'string' || part.length > 2048) ||
        !['audio', 'video'].includes(kind) || !['public', 'private'].includes(visibility) ||
        !(mediaName(url) ? (kind === 'video' ? /\.(mp4|webm)$/ : /\.(mp3|wav|ogg|m4a)$/).test(url) : kind === 'video' ? resolveVideo(url) : /^https:\/\/[^\s]+\.(mp3|m4a|ogg|wav|webm)(?:\?[^#]*)?$/i.test(url))) {
      throw clientError(400, 'پیوند یا مشخصات یکی از اجراها معتبر نیست.');
    }
    const prior = previous.get(take.id);
    const takeId = prior?.id ?? randomBytes(12).toString('base64url');
    if (used.has(takeId)) throw clientError(400, 'یکی از اجراها تکرار شده است.');
    used.add(takeId);
    insertTake.run(takeId, id, title, url, kind, recorded, instrument, notes, visibility, prior?.created_at ?? null);
  }
  db.prepare("UPDATE pieces SET video = '' WHERE id = ?").run(id);
}

function send(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(JSON.stringify(data));
}

async function readJson(req) {
  const limit = 96 * 1024;
  if (req.headers['content-type'] !== 'application/json') throw clientError(415, 'فرمت درخواست معتبر نیست.');
  if (Number(req.headers['content-length']) > limit) throw clientError(413, 'اندازهٔ متن بیش از حد مجاز است.');
  const parts = [];
  let bytes = 0;
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    bytes += chunk.length;
    if (bytes > limit) throw clientError(413, 'اندازهٔ متن بیش از حد مجاز است.');
    parts.push(chunk);
  }
  try {
    const value = JSON.parse(Buffer.concat(parts).toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value;
  } catch {
    throw clientError(400, 'داده‌های فرم معتبر نیست.');
  }
}

function sessionSignature(payload) {
  return createHmac('sha256', owner)
    .update(JSON.stringify(['admin-session', adminUsername, passwordHash, payload]))
    .digest('base64url');
}

function hasSession(cookies = '') {
  const token = cookies.split(';').map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(sessionCookie + '='))?.slice(sessionCookie.length + 1);
  const match = /^(\d{10})\.([\w-]{22})\.([\w-]{43})$/.exec(token ?? '');
  if (!match || Number(match[1]) <= Math.floor(Date.now() / 1000)) return false;
  return matches(match[3], sessionSignature(match[1] + '.' + match[2]));
}

function setSession(res, token, age) {
  res.setHeader('Set-Cookie', `${sessionCookie}=${token}; Path=/; Max-Age=${age}; HttpOnly; Secure; SameSite=Strict`);
}

async function login(req, res) {
  const { username, password } = await readJson(req);
  if (typeof username !== 'string' || username.length > 100 ||
      typeof password !== 'string' || !password || password.length > 128) {
    throw clientError(400, 'نام کاربری و رمز عبور را وارد کن.');
  }
  const now = Date.now();
  if (now >= failureWindow) {
    failedLogins = 0;
    failureWindow = now + 60_000;
  }
  if (failedLogins >= 12) {
    res.setHeader('Retry-After', String(Math.ceil((failureWindow - now) / 1000)));
    throw clientError(429, 'تلاش‌های ورود زیاد بود. کمی بعد دوباره امتحان کن.');
  }
  const digest = scryptSync(password, passwordSalt, 32, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 });
  if (!timingSafeEqual(digest, passwordDigest) || username !== adminUsername) {
    failedLogins++;
    throw clientError(401, 'نام کاربری یا رمز عبور درست نیست.');
  }
  failedLogins = 0;
  const expires = Math.floor(now / 1000) + sessionSeconds;
  const payload = expires + '.' + randomBytes(16).toString('base64url');
  setSession(res, payload + '.' + sessionSignature(payload), sessionSeconds);
  return send(res, 200, {});
}

function scoreValue(input) {
  if (typeof input !== 'string' || input.length > 16_000) {
    throw clientError(400, 'متن قطعه باید حداکثر ۱۶ هزار نویسه باشد.');
  }
  return input.replace(/\r\n?/g, '\n');
}

function fields(input) {
  const { title, artist, score, root, mode, video, listed } = input;
  if (typeof title !== 'string' || !title.trim() || title.length > 100 ||
      typeof artist !== 'string' || artist.length > 120 ||
      !Number.isInteger(root) || root < 0 || root > 11 ||
      (mode !== 'major' && mode !== 'minor') || typeof listed !== 'boolean') {
    throw clientError(400, 'نام قطعه، گام و سایر مشخصات را بررسی کن.');
  }
  if (typeof video !== 'string' || video.length > 2048 || (video && !resolveVideo(video))) {
    throw clientError(400, 'پیوند مستقیم MP4 یا WebM، یا پیوند معتبر یوتیوب یا آپارات را وارد کن.');
  }
  return [title.trim(), artist.trim(), root, mode, scoreValue(score), video, Number(listed)];
}

async function handle(req, res) {
  const { method, headers } = req;
  const isAdminHost = headers.host === adminSite.host;
  const site = isAdminHost ? adminSite : publicSite;
  const path = new URL(req.url, site).pathname;
  const credential = headers.authorization?.replace(/^Bearer /, '') ?? '';
  const isOwner = isAdminHost && hasSession(headers.cookie);
  if (!isAdminHost && path.startsWith('/api/owner/')) throw clientError(404, 'صفحه پیدا نشد.');
  if (['POST', 'PUT', 'DELETE'].includes(method)) {
    if (headers.origin !== site.origin) throw clientError(403, 'این درخواست باید از خود هم‌نوا ارسال شود.');
  }

  if (path === '/api/owner/upload' && method === 'POST') {
    if (!isOwner) throw clientError(401, 'برای ادامه وارد پنل شو.');
    return send(res, 201, await upload(req));
  }
  const media = mediaName(path);
  if (media && ['GET', 'HEAD'].includes(method)) {
    const visible = db.prepare("SELECT 1 FROM performance_takes t JOIN pieces p ON p.id = t.piece_id WHERE t.url = ? AND t.visibility = 'public' AND p.visibility IN ('published', 'unlisted')").get(path);
    if (!isOwner && !visible) throw clientError(404, 'فایل پیدا نشد.');
    return serveMedia(req, res, media);
  }

  if (path === '/api/owner/login' && method === 'POST') return login(req, res);
  if (path === '/api/owner/logout' && method === 'POST') {
    setSession(res, '', 0);
    return send(res, 200, {});
  }

  if (path === '/api/pieces' && method === 'GET') return send(res, 200, list.all());
  if (path === '/api/owner/pieces') {
    if (!isOwner) throw clientError(401, 'برای ادامه وارد پنل شو.');
    if (method === 'GET') return send(res, 200, owned.all());
    if (method === 'POST') {
      const body = await readJson(req);
      const input = fields(body);
      const id = randomBytes(18).toString('base64url');
      db.exec('BEGIN IMMEDIATE');
      try {
        insert.run(id, ...input);
        assignSlug(id, body.slug ?? body.title);
        updateDetails(id, body);
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
      return send(res, 201, expose(get.get(id), isOwner));
    }
  }
  const invitation = /^\/api\/owner\/pieces\/([\w-]{24})\/invite$/.exec(path);
  if (invitation && ['GET', 'POST'].includes(method)) {
    if (!isOwner) throw clientError(401, 'برای ادامه وارد پنل شو.');
    const row = get.get(invitation[1]);
    if (!readable(row)) throw clientError(404, 'قطعه باید منتشر یا دارای پیوند باشد.');
    if (method === 'POST') {
      db.prepare('UPDATE pieces SET invite_version = invite_version + 1 WHERE id = ?').run(row.id);
    }
    return send(res, 200, { key: invite(get.get(row.id)) });
  }

  if (path.startsWith('/api/slug/') && method === 'GET') {
    let slug;
    try { slug = normalizeSlug(decodeURIComponent(path.slice('/api/slug/'.length))); }
    catch { throw clientError(400, 'نشانی قطعه معتبر نیست.'); }
    const row = validSlug(slug) && getSlug.get(slug);
    if (!readable(row)) throw clientError(404, 'قطعه پیدا نشد.');
    return send(res, 200, expose(row));
  }
  const match = /^\/api\/pieces\/([\w-]{24})$/.exec(path);
  if (match && ['GET', 'PUT', 'DELETE'].includes(method)) {
    const id = match[1];
    const row = get.get(id);
    if (!row || (!isOwner && !readable(row))) throw clientError(404, 'قطعه پیدا نشد.');
    if (method === 'GET') return send(res, 200, expose(row, isOwner));
    if (method === 'DELETE') {
      if (!isOwner) throw clientError(403, 'دسترسی معتبر نیست.');
      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare('DELETE FROM performance_takes WHERE piece_id = ?').run(id);
        db.prepare('DELETE FROM piece_slugs WHERE piece_id = ?').run(id);
        db.prepare('DELETE FROM pieces WHERE id = ?').run(id);
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
      return send(res, 200, {});
    }
    const isGuest = !isAdminHost && matches(credential, invite(row));
    if (isAdminHost && !isOwner) throw clientError(401, 'برای ادامه وارد پنل شو.');
    if (!isOwner && !isGuest) throw clientError(403, 'دسترسی ویرایش معتبر نیست.');
    const input = await readJson(req);
    if (!Number.isSafeInteger(input.revision)) throw clientError(400, 'نسخهٔ قطعه معتبر نیست.');
    const values = isOwner
      ? fields(input)
      : [row.title, row.artist, row.root, row.mode, scoreValue(input.score), row.video, row.listed];
    db.exec('BEGIN IMMEDIATE');
    try {
      if (!isOwner) {
        const current = get.get(id);
        if (!readable(current) || !matches(credential, invite(current))) throw clientError(403, 'دسترسی ویرایش معتبر نیست.');
      }
      if (!update.run(...values, id, input.revision).changes) {
        throw clientError(409, 'قطعه جایی دیگر تغییر کرده است. متن فعلی را کپی کن و صفحه را دوباره باز کن.');
      }
      if (isOwner && input.slug !== undefined) assignSlug(id, input.slug);
      if (isOwner) updateDetails(id, input);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    return send(res, 200, expose(get.get(id), isOwner));
  }
  if (!isAdminHost && ['GET', 'HEAD'].includes(method) && /^\/[^/]+\/?$/.test(path)) {
    let slug;
    try { slug = normalizeSlug(decodeURIComponent(path.slice(1).replace(/\/$/, ''))); }
    catch { throw clientError(404, 'قطعه پیدا نشد.'); }
    const row = validSlug(slug) && getSlug.get(slug);
    if (!readable(row)) throw clientError(404, 'قطعه پیدا نشد.');
    const canonical = new URL('/' + encodeURIComponent(row.slug), publicSite);
    const html = (await readFile('music/index.html', 'utf8')).replace(
      /(<link rel="canonical" href=")[^"]+/, '$1' + canonical.href,
    );
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(html);
  }
  throw clientError(404, 'صفحه پیدا نشد.');
}

createServer({ requestTimeout: 15_000 }, (req, res) => {
  handle(req, res).catch((error) => {
    if (!error.status) console.error(error);
    if (!res.headersSent) send(res, error.status ?? 500, { error: error.status ? error.message : 'خطای سرور رخ داد.' });
  });
}).listen(Number(process.env.HAMNAVA_PORT ?? 3102), '127.0.0.1');
