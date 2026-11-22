import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { resolveVideo } from './video.mjs';

const { HAMNAVA_OWNER_KEY: owner, HAMNAVA_DATABASE: database } = process.env;
const origin = process.env.HAMNAVA_ORIGIN ?? 'https://music.amirhossein-danesh.ir';
const keyPattern = /^[\w-]{43}$/;
if (!owner || !keyPattern.test(owner) || !database) throw new Error('Hamnava requires an owner key and database path.');

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
  const path = new URL(req.url, origin).pathname;
  const { method, headers } = req;
  const credential = headers.authorization?.replace(/^Bearer /, '') ?? '';
  const isOwner = matches(credential, owner);
  if (method === 'POST' || method === 'PUT') {
    if (headers.origin !== origin) throw clientError(403, 'این درخواست باید از خود هم‌نوا ارسال شود.');
  }

  if (path === '/api/pieces' && method === 'GET') return send(res, 200, list.all());
  if (path === '/api/owner/pieces') {
    if (!isOwner) throw clientError(401, 'کلید مدیریت معتبر نیست.');
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
    if (!isOwner) throw clientError(401, 'کلید مدیریت معتبر نیست.');
    if (!get.get(invitation[1])) throw clientError(404, 'قطعه پیدا نشد.');
    return send(res, 200, { key: invite(invitation[1]) });
  }

  const match = /^\/api\/pieces\/([\w-]{24})$/.exec(path);
  if (match && (method === 'GET' || method === 'PUT')) {
    const id = match[1];
    const row = get.get(id);
    if (!row) throw clientError(404, 'قطعه پیدا نشد.');
    if (method === 'GET') return send(res, 200, expose(row));
    if (!isOwner && !matches(credential, invite(id))) throw clientError(403, 'لینک ویرایش معتبر نیست.');
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
