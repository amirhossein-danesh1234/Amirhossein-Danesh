import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { resolveVideo } from './video.mjs';

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
const get = db.prepare('SELECT * FROM pieces WHERE id = ?');
const list = db.prepare('SELECT id, title FROM pieces WHERE listed = 1 ORDER BY rowid DESC');
const owned = db.prepare('SELECT id, title FROM pieces ORDER BY rowid DESC');
const insert = db.prepare(`
  INSERT INTO pieces (id, title, artist, root, mode, score, video, listed, revision)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
`);
const update = db.prepare(`
  UPDATE pieces SET title = ?, artist = ?, root = ?, mode = ?, score = ?, video = ?,
  listed = ?, revision = revision + 1 WHERE id = ? AND revision = ?
`);

const clientError = (status, message) => Object.assign(new Error(message), { status });
const invite = (id) => createHmac('sha256', owner).update('score:' + id).digest('base64url');
const matches = (actual, expected) => keyPattern.test(actual) &&
  timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
const expose = (row) => ({ ...row, listed: Boolean(row.listed) });

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
  return input.replace(/\r\n?/g, '\n').trim();
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
  if (method === 'POST' || method === 'PUT') {
    if (headers.origin !== site.origin) throw clientError(403, 'این درخواست باید از خود هم‌نوا ارسال شود.');
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
      const input = fields(await readJson(req));
      const id = randomBytes(18).toString('base64url');
      insert.run(id, ...input);
      return send(res, 201, expose(get.get(id)));
    }
  }
  const invitation = /^\/api\/owner\/pieces\/([\w-]{24})\/invite$/.exec(path);
  if (invitation && method === 'GET') {
    if (!isOwner) throw clientError(401, 'برای ادامه وارد پنل شو.');
    if (!get.get(invitation[1])) throw clientError(404, 'قطعه پیدا نشد.');
    return send(res, 200, { key: invite(invitation[1]) });
  }

  const match = /^\/api\/pieces\/([\w-]{24})$/.exec(path);
  if (match && (method === 'GET' || method === 'PUT')) {
    const id = match[1];
    const row = get.get(id);
    if (!row) throw clientError(404, 'قطعه پیدا نشد.');
    if (method === 'GET') return send(res, 200, expose(row));
    const isGuest = !isAdminHost && matches(credential, invite(id));
    if (isAdminHost && !isOwner) throw clientError(401, 'برای ادامه وارد پنل شو.');
    if (!isOwner && !isGuest) throw clientError(403, 'دسترسی ویرایش معتبر نیست.');
    const input = await readJson(req);
    if (!Number.isSafeInteger(input.revision)) throw clientError(400, 'نسخهٔ قطعه معتبر نیست.');
    const values = isOwner
      ? fields(input)
      : [row.title, row.artist, row.root, row.mode, scoreValue(input.score), row.video, row.listed];
    if (!update.run(...values, id, input.revision).changes) {
      throw clientError(409, 'قطعه جایی دیگر تغییر کرده است. متن فعلی را کپی کن و صفحه را دوباره باز کن.');
    }
    return send(res, 200, expose(get.get(id)));
  }
  throw clientError(404, 'صفحه پیدا نشد.');
}

createServer({ requestTimeout: 15_000 }, (req, res) => {
  handle(req, res).catch((error) => {
    if (!error.status) console.error(error);
    if (!res.headersSent) send(res, error.status ?? 500, { error: error.status ? error.message : 'خطای سرور رخ داد.' });
  });
}).listen(Number(process.env.HAMNAVA_PORT ?? 3102), '127.0.0.1');
