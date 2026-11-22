import { demo, type Piece } from './demo';
import { chord, noteSequence, pitchNames } from './notation';
import { resolveVideo } from '../../ops/music/video.mjs';

function element<T extends HTMLElement = HTMLElement>(id: string) {
  return document.getElementById(id) as T;
}

function node<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = '') {
  const item = document.createElement(tag);
  item.className = className;
  item.textContent = text;
  return item;
}

const key = element<HTMLSelectElement>('key');
const chords = element<HTMLInputElement>('chords');
const score = element('score');
const piano = element('piano');
const video = element('video');
const editor = element('editor');
const title = element<HTMLInputElement>('title');
const artist = element<HTMLInputElement>('artist');
const originalKey = element<HTMLSelectElement>('original-key');
const mode = element<HTMLSelectElement>('mode');
const videoUrl = element<HTMLInputElement>('video-url');
const listed = element<HTMLInputElement>('listed');
const scoreInput = element<HTMLTextAreaElement>('score-input');
const ownerKeyInput = element<HTMLInputElement>('owner-key');
const admin = document.body.dataset.musicMode === 'admin';
const selectedId = new URL(location.href).searchParams.get('piece') || demo.id;
const editKey = admin ? '' : new URLSearchParams(location.hash.slice(1)).get('edit') ?? '';
const editingAvailable = window.isSecureContext;
let ownerKey = admin && editingAvailable ? sessionStorage.getItem('hamnava-owner-key') ?? '' : '';
let piece = demo;
let selectedChord = '';
let creating = false;
let saving = false;

function notice(message: string, error = false) {
  const box = element('notice');
  box.hidden = !message;
  box.classList.toggle('error', error);
  box.textContent = message;
}

async function api<T>(path: string, options: { method?: string; key?: string; data?: unknown } = {}): Promise<T> {
  const headers = new Headers();
  if (options.key) headers.set('Authorization', 'Bearer ' + options.key);
  if (options.data) headers.set('Content-Type', 'application/json');
  let response: Response;
  try {
    response = await fetch('/api/' + path, {
      method: options.method ?? 'GET',
      headers,
      body: options.data ? JSON.stringify(options.data) : undefined,
    });
  } catch {
    throw new Error('ارتباط با سرور برقرار نشد.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'درخواست انجام نشد.');
  return data as T;
}

const pieceUrl = (id: string, insidePanel = false) => {
  const url = insidePanel ? new URL(location.pathname, location.origin) : new URL('https://music.amirhossein-danesh.ir/');
  if (id !== demo.id) url.searchParams.set('piece', id);
  return url;
};

function renderList(target: string, pieces: Pick<Piece, 'id' | 'title'>[]) {
  element(target).replaceChildren(...pieces.map((item) => {
    const link = node('a', 'piece-link', item.title);
    link.href = pieceUrl(item.id, target === 'owner-list').href;
    if (item.id === piece.id) link.setAttribute('aria-current', 'page');
    return link;
  }));
}

function shift() {
  const distance = (Number(key.value) - piece.root + 12) % 12;
  return distance > 6 ? distance - 12 : distance;
}

function renderPiano() {
  const active = selectedChord && chord(selectedChord, shift());
  if (!active) {
    piano.replaceChildren(node('p', '', 'روی یکی از آکوردهای بالای متن بزن تا کلیدهای پیانو را ببینی.'));
    return;
  }

  const keyboard = node('div', 'keyboard');
  keyboard.dir = 'ltr';
  keyboard.setAttribute('aria-hidden', 'true');
  const white = [0, 2, 4, 5, 7, 9, 11];
  const octaves = Math.max(2, Math.floor(Math.max(...active.keys) / 12) + 1);
  let whiteCount = 0;
  for (let position = 0; position < octaves * 12; position++) {
    const black = !white.includes(position % 12);
    const tile = node('i', 'key');
    tile.classList.toggle('active', active.keys.includes(position));
    if (black) {
      tile.classList.add('black');
      tile.style.left = (100 * whiteCount / (octaves * 7)) + '%';
    } else {
      whiteCount++;
    }
    keyboard.append(tile);
  }
  const notes = active.keys.map((position) => pitchNames[position % 12]).join(' · ');
  const caption = node('p', 'piano-notes', active.label + '   |   ' + notes);
  caption.dir = 'ltr';
  piano.replaceChildren(keyboard, caption);
}

function lyricLine(line: string) {
  const paragraph = node('p', 'lyric');
  const symbols = /\[([^\[\]\r\n]+)\]([^\[]*)/g;
  let offset = 0;
  for (const match of line.matchAll(symbols)) {
    const index = match.index!;
    const [, symbol, text] = match;
    paragraph.append(line.slice(offset, index));
    offset = index + match[0].length;

    const transposed = chord(symbol.trim(), shift());
    if (!transposed) {
      paragraph.append(match[0]);
      continue;
    }
    if (!chords.checked) {
      paragraph.append(text);
      continue;
    }

    const leading = /^\s*/.exec(text)?.[0] ?? '';
    const word = /^\S+/.exec(text.slice(leading.length))?.[0] ?? '';
    const anchor = node('span', 'chord-start' + (word ? '' : ' solo'), word);
    const button = node('button', 'chord-tag', transposed.label);
    button.type = 'button';
    button.dataset.chord = symbol.trim();
    button.setAttribute('aria-label', 'آکورد ' + transposed.label + ' روی پیانو');
    button.setAttribute('aria-pressed', String(symbol.trim() === selectedChord));
    anchor.append(button);
    paragraph.classList.add('has-chords');
    paragraph.append(leading, anchor, text.slice(leading.length + word.length));
  }
  paragraph.append(line.slice(offset));
  return paragraph;
}

function renderScore() {
  const rows: HTMLElement[] = [];
  const lines = piece.score.split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    if (line.startsWith('# ')) {
      rows.push(node('h4', 'section-title', line.slice(2)));
      continue;
    }
    if (line.startsWith('! ') || line.startsWith('~ ')) {
      const instrumental = line.startsWith('~ ');
      const cue = node('div', instrumental ? 'cue melody' : 'cue');
      const [text, ...notes] = line.slice(2).split('|');
      cue.append(node('strong', '', instrumental ? 'ملودی · آواز نخوانید' : 'مکث · آواز نخوانید'), node('span', '', text.trim()));
      if (instrumental && notes.length) {
        const notesElement = node('code', '', noteSequence(notes.join('|').trim(), shift()));
        notesElement.dir = 'ltr';
        cue.append(notesElement);
      }
      rows.push(cue);
      continue;
    }
    rows.push(lyricLine(line));
  }
  score.replaceChildren(...(rows.length ? rows : [node('p', '', 'متن این قطعه هنوز وارد نشده است.')]));
  const modeLabel = piece.mode === 'minor' ? 'مینور' : 'ماژور';
  for (const [index, option] of Array.from(key.options).entries()) {
    option.textContent = pitchNames[index] + ' ' + modeLabel;
  }
  element('reset-key').hidden = shift() === 0;
  element('piano-card').hidden = !chords.checked;
  renderPiano();
}

function renderVideo() {
  const source = resolveVideo(piece.video);
  if (!source) {
    const empty = node('div', 'video-empty');
    const mark = node('span', '', '▷');
    mark.setAttribute('aria-hidden', 'true');
    empty.append(mark, node('div', '', 'هنوز ویدیویی برای این اجرا ثبت نشده است.'));
    video.replaceChildren(empty);
    return;
  }
  if (source.kind === 'video') {
    const player = node('video');
    player.src = source.src;
    player.controls = true;
    player.preload = 'none';
    player.playsInline = true;
    video.replaceChildren(player);
    return;
  }
  const player = node('iframe');
  player.src = source.src;
  player.title = 'ویدیوی اجرای ' + piece.title;
  player.loading = 'lazy';
  player.referrerPolicy = 'strict-origin-when-cross-origin';
  player.allowFullscreen = true;
  player.allow = 'fullscreen; picture-in-picture; encrypted-media';
  video.replaceChildren(player);
}

function renderPermissions() {
  const realPiece = piece.id !== demo.id;
  element('invite').hidden = !realPiece || !ownerKey;
  element('edit').hidden = !editingAvailable || !realPiece || (!ownerKey && !editKey);
  element('unlock').hidden = Boolean(ownerKey);
  element('owner-actions').hidden = !ownerKey;
}

function showPiece(next: Piece) {
  piece = next;
  selectedChord = '';
  element('piece-title').textContent = piece.title;
  element('piece-artist').textContent = piece.artist;
  key.value = String(piece.root);
  element('piece').hidden = false;
  element('share').hidden = false;
  renderPermissions();
  renderScore();
  renderVideo();
}

function startEditor(isNew: boolean) {
  creating = isNew;
  const editable = isNew ? { ...demo, title: '', artist: '', root: 0, mode: 'major', score: '' } : piece;
  element('editor-heading').textContent = isNew ? 'قطعهٔ تازه' : 'ویرایش قطعه';
  element('owner-fields').hidden = !ownerKey;
  element('score-tools').hidden = !ownerKey;
  title.value = editable.title;
  artist.value = editable.artist;
  originalKey.value = String(editable.root);
  mode.value = editable.mode;
  videoUrl.value = editable.video;
  listed.checked = editable.listed;
  scoreInput.value = editable.score;
  editor.hidden = false;
  (ownerKey ? title : scoreInput).focus();
}

async function copy(url: URL) {
  try {
    await navigator.clipboard.writeText(url.href);
    notice('لینک کپی شد.');
  } catch {
    window.prompt('لینک را کپی کنید', url.href);
  }
}

const message = (error: unknown) => error instanceof Error ? error.message : 'درخواست انجام نشد.';

async function loadOwner(credential: string) {
  const pieces = await api<Pick<Piece, 'id' | 'title'>[]>('owner/pieces', { key: credential });
  ownerKey = credential;
  sessionStorage.setItem('hamnava-owner-key', credential);
  renderList('owner-list', pieces);
  renderPermissions();
}

async function loadLibrary() {
  const pieces = await api<Pick<Piece, 'id' | 'title'>[]>('pieces');
  renderList('piece-list', [demo, ...pieces]);
  element('library').hidden = false;
}

element<HTMLFormElement>('unlock').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await loadOwner(ownerKeyInput.value.trim());
    ownerKeyInput.value = '';
    notice('');
    if (!(await loadAdminPiece())) element('new-piece').focus();
  } catch (error) {
    notice(message(error), true);
  }
});
element('logout').addEventListener('click', () => {
  ownerKey = '';
  sessionStorage.removeItem('hamnava-owner-key');
  element('owner-list').replaceChildren();
  editor.hidden = true;
  element('piece').hidden = true;
  renderPermissions();
  ownerKeyInput.focus();
});
chords.addEventListener('change', renderScore);
key.addEventListener('change', renderScore);
element('reset-key').addEventListener('click', () => {
  key.value = String(piece.root);
  key.focus();
  renderScore();
});
score.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-chord]');
  if (!button) return;
  selectedChord = button.dataset.chord ?? '';
  for (const tag of score.querySelectorAll<HTMLButtonElement>('button[data-chord]')) {
    tag.setAttribute('aria-pressed', String(tag.dataset.chord === selectedChord));
  }
  renderPiano();
});
element('share').addEventListener('click', () => void copy(pieceUrl(piece.id)));
element('invite').addEventListener('click', async () => {
  try {
    const { key: token } = await api<{ key: string }>('owner/pieces/' + piece.id + '/invite', { key: ownerKey });
    const url = pieceUrl(piece.id);
    url.hash = 'edit=' + token;
    await copy(url);
  } catch (error) {
    notice(message(error), true);
  }
});
element('edit').addEventListener('click', () => startEditor(false));
element('new-piece').addEventListener('click', () => startEditor(true));
element('cancel').addEventListener('click', () => {
  editor.hidden = true;
  element(creating ? 'new-piece' : 'edit').focus();
});
element<HTMLFormElement>('edit-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (saving) return;
  const isNew = creating;
  const submit = element('edit-form').querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const data: Record<string, unknown> = { score: scoreInput.value, revision: piece.revision };
  if (ownerKey) Object.assign(data, {
    title: title.value.trim(),
    artist: artist.value.trim(),
    root: Number(originalKey.value),
    mode: mode.value,
    video: videoUrl.value.trim(),
    listed: listed.checked,
  });
  submit.disabled = saving = true;
  try {
    const next = await api<Piece>(isNew ? 'owner/pieces' : 'pieces/' + piece.id, {
      method: isNew ? 'POST' : 'PUT', key: ownerKey || editKey, data,
    });
    if (isNew) {
      location.assign(pieceUrl(next.id, true).href);
      return;
    }
    showPiece(next);
    notice('قطعه ذخیره شد.');
    editor.hidden = true;
    element('edit').focus();
    if (!admin) void loadLibrary().catch(() => {});
    if (ownerKey) void loadOwner(ownerKey).catch(() => {});
  } catch (error) {
    notice(message(error), true);
    noticeElementIntoView();
  } finally {
    submit.disabled = saving = false;
  }
});

function noticeElementIntoView() {
  element('notice').scrollIntoView({ block: 'nearest' });
}

async function loadAdminPiece() {
  if (selectedId === demo.id) return false;
  showPiece(await api<Piece>('pieces/' + encodeURIComponent(selectedId)));
  startEditor(false);
  return true;
}

function insertScore(value: string, asLine: boolean) {
  const { selectionStart, selectionEnd, value: current } = scoreInput;
  const prefix = asLine && selectionStart > 0 && current[selectionStart - 1] !== '\n' ? '\n' : '';
  const suffix = asLine && current[selectionEnd] !== '\n' ? '\n' : '';
  if (current.length - (selectionEnd - selectionStart) + prefix.length + value.length + suffix.length > scoreInput.maxLength) {
    notice('اندازهٔ متن بیش از حد مجاز است.', true);
    return;
  }
  scoreInput.setRangeText(prefix + value + suffix, selectionStart, selectionEnd, 'end');
  scoreInput.focus();
}

const chordInput = element<HTMLInputElement>('chord-input');
element('add-chord').addEventListener('click', () => {
  const symbol = chordInput.value.trim();
  if (!chord(symbol)) {
    notice('آکورد را به شکل Am، C# یا G/B وارد کن.', true);
    chordInput.focus();
    return;
  }
  notice('');
  insertScore('[' + symbol + ']', false);
});
chordInput.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  element('add-chord').click();
});
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-score-line]')) {
  button.addEventListener('click', () => insertScore(button.dataset.scoreLine!, true));
}

async function initialize() {
  if (admin) {
    if (!editingAvailable) {
      notice('برای ورود به پنل، آدرس را با HTTPS باز کن.', true);
      return;
    }
    element('owner').hidden = false;
    if (ownerKey) {
      try {
        await loadOwner(ownerKey);
      } catch (error) {
        ownerKey = '';
        sessionStorage.removeItem('hamnava-owner-key');
        renderPermissions();
        notice(message(error), true);
        return;
      }
      try {
        await loadAdminPiece();
      } catch (error) {
        notice(message(error), true);
      }
    }
    return;
  }

  if (selectedId === demo.id) {
    showPiece(demo);
    renderList('piece-list', [demo]);
    element('library').hidden = false;
  } else {
    try {
      showPiece(await api<Piece>('pieces/' + encodeURIComponent(selectedId)));
    } catch (error) {
      notice(message(error), true);
    }
  }
  void loadLibrary().catch(() => {});
}

void initialize();
