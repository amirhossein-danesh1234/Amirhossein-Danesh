import { randomBytes } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const formats = {
  mp3: ['audio/mpeg', (b) => b.toString('ascii', 0, 3) === 'ID3' || (b[0] === 255 && (b[1] & 224) === 224)],
  wav: ['audio/wav', (b) => b.toString('ascii', 8, 12) === 'WAVE'],
  ogg: ['audio/ogg', (b) => b.toString('ascii', 0, 4) === 'OggS'],
  webm: ['video/webm', (b) => b.readUInt32BE(0) === 0x1a45dfa3],
  mp4: ['video/mp4', (b) => b.toString('ascii', 4, 8) === 'ftyp'],
  m4a: ['audio/mp4', (b) => b.toString('ascii', 4, 8) === 'ftyp'],
};
const limit = 32 * 1024 * 1024;
const quota = 256 * 1024 * 1024;
const fail = (status, message) => Object.assign(new Error(message), { status });
const directory = process.env.HAMNAVA_MEDIA_DIR;
let uploading = false;

export function mediaName(url) {
  return /^\/api\/media\/([a-f0-9]{32}\.(?:mp3|wav|ogg|webm|mp4|m4a))$/.exec(url)?.[1];
}

export async function upload(req) {
  if (!directory) throw fail(503, 'محل ذخیرهٔ فایل تنظیم نشده است.');
  const extension = Object.keys(formats).find((key) => formats[key][0] === req.headers['content-type']);
  if (!extension) throw fail(415, 'فرمت صدا یا ویدیو پشتیبانی نمی‌شود.');
  const length = Number(req.headers['content-length']);
  if (!Number.isSafeInteger(length) || length < 12 || length > limit) throw fail(413, 'حجم فایل حداکثر ۳۲ مگابایت است.');
  if (uploading) throw fail(409, 'بارگذاری دیگری در حال انجام است.');
  uploading = true;
  try {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const files = await readdir(directory);
    const sizes = await Promise.all(files.map((name) => stat(join(directory, name))));
    if (sizes.reduce((sum, file) => sum + file.size, 0) + length > quota) throw fail(507, 'ظرفیت بارگذاری تکمیل شده است.');
    const bytes = Buffer.alloc(length);
    let received = 0;
    for await (const part of req.iterator({ destroyOnReturn: false })) {
      if (received + part.length > length) throw fail(413, 'فایل بیش از حد بزرگ است.');
      part.copy(bytes, received);
      received += part.length;
    }
    if (received !== length || !formats[extension][1](bytes)) throw fail(415, 'محتوای فایل با فرمت اعلام‌شده مطابقت ندارد.');
    const name = randomBytes(16).toString('hex') + '.' + extension;
    await writeFile(join(directory, name), bytes, { flag: 'wx', mode: 0o600 });
    return { url: '/api/media/' + name, kind: formats[extension][0].split('/')[0] };
  } finally { uploading = false; }
}

export async function serveMedia(req, res, name) {
  if (!directory) throw fail(404, 'فایل پیدا نشد.');
  const file = join(directory, name);
  const info = await stat(file).catch(() => null);
  if (!info?.isFile()) throw fail(404, 'فایل پیدا نشد.');
  const headers = {
    'Content-Type': formats[name.split('.')[1]][0], 'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff', 'Accept-Ranges': 'bytes',
  };
  let start = 0;
  let end = info.size - 1;
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
  if (range && (range[1] || range[2])) {
    if (!range[1]) start = Math.max(0, info.size - Number(range[2]));
    else {
      start = Number(range[1]);
      if (range[2]) end = Math.min(end, Number(range[2]));
    }
    if (start > end) {
      res.writeHead(416, { ...headers, 'Content-Range': 'bytes */' + info.size });
      return res.end();
    }
    headers['Content-Range'] = 'bytes ' + start + '-' + end + '/' + info.size;
  }
  res.writeHead(headers['Content-Range'] ? 206 : 200, { ...headers, 'Content-Length': end - start + 1 });
  if (req.method === 'HEAD') return res.end();
  const stream = createReadStream(file, { start, end });
  res.on('close', () => stream.destroy());
  stream.on('error', () => res.destroy());
  stream.pipe(res);
}
