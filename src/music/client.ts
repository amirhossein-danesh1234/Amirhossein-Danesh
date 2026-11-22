import { demo, type Piece } from './demo';
import { addTake, bindVisualEditor } from './editor';
import { bindPerformance } from './performance';
import { chord, noteSequence, pitchNames } from './notation';
import { resolveVideo } from '../../ops/music/video.mjs';
import { normalizeSlug } from '../../ops/music/slug.mjs';

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
const slugInput = element<HTMLInputElement>('slug');
let slugManuallyEdited = false;
const originalKey = element<HTMLSelectElement>('original-key');
const mode = element<HTMLSelectElement>('mode');
const visibility = element<HTMLSelectElement>('visibility');
const metadataFields = Array.from(document.querySelectorAll<HTMLInputElement>('[data-metadata]'));
const takeFields = element('take-fields');
const visibilityLabels: Record<string, string> = { draft: 'پیش‌نویس', published: 'منتشرشده', unlisted: 'دارای پیوند', private: 'خصوصی' };
const direction = element<HTMLSelectElement>('shift-direction');
let dirty = false;
const scoreInput = element<HTMLTextAreaElement>('score-input');
const usernameInput = element<HTMLInputElement>('admin-username');
const passwordInput = element<HTMLInputElement>('admin-password');
const admin = document.body.dataset.musicMode === 'admin';
const selectedId = new URL(location.href).searchParams.get('piece') || demo.id;
const selectedSlug = admin ? '' : location.pathname.replace(/^\/+|\/+$/g, '');
const editKey = admin ? '' : new URLSearchParams(location.hash.slice(1)).get('edit') ?? '';
const editingAvailable = window.isSecureContext;
let ownerAuthenticated = false;
let ownerPieces: Pick<Piece, 'id' | 'title' | 'slug' | 'visibility'>[] = [];
const ownerSearch = element<HTMLInputElement>('owner-search');
const filterOwner = () => {
  const query = normalizeSlug(ownerSearch.value);
  renderList('owner-list', ownerPieces.filter((item) => normalizeSlug(item.title).includes(query) || item.slug?.includes(query)));
};
ownerSearch.addEventListener('input', filterOwner);
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
  if (!response.ok) throw Object.assign(new Error(data.error || 'درخواست انجام نشد.'), { status: response.status });
  return data as T;
}

const pieceUrl = (id: string, insidePanel = false, slug = '') => {
  const url = insidePanel ? new URL(location.pathname, location.origin) : new URL('https://music.amirhossein-danesh.ir/');
  if (!insidePanel && slug) url.pathname = '/' + slug;
  else if (id !== demo.id) url.searchParams.set('piece', id);
  return url;
};

function renderList(target: string, pieces: Pick<Piece, 'id' | 'title' | 'slug' | 'visibility'>[]) {
  element(target).replaceChildren(...pieces.map((item) => {
    const link = node('a', 'piece-link', item.title + (target === 'owner-list' && item.visibility ? ' · ' + visibilityLabels[item.visibility] : ''));
    link.href = pieceUrl(item.id, target === 'owner-list', item.slug).href;
    if (item.id === piece.id) link.setAttribute('aria-current', 'page');
    return link;
  }));
}

function shift() {
  const root = ownerAuthenticated && !editor.hidden ? Number(originalKey.value) : piece.root;
  const distance = (Number(key.value) - root + 12) % 12;
  if (distance === 0 || direction.value === 'up') return distance;
  if (direction.value === 'down') return distance - 12;
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
  let beforeLyrics = true;
  for (const match of line.matchAll(symbols)) {
    const index = match.index!;
    const [, symbol, text] = match;
    const plainText = line.slice(offset, index);
    paragraph.append(plainText);
    if (plainText.trim()) beforeLyrics = false;
    offset = index + match[0].length;

    const transposed = chord(symbol.trim(), shift());
    if (!transposed) {
      if (match[0].trim()) beforeLyrics = false;
      paragraph.append(match[0]);
      continue;
    }
    if (!chords.checked) {
      paragraph.append(beforeLyrics && /^\s{2,}/.test(text) ? text.trimStart() : text);
      if (text.trim()) beforeLyrics = false;
      continue;
    }

    const leading = /^\s*/.exec(text)?.[0] ?? '';
    const word = /^\S+/.exec(text.slice(leading.length))?.[0] ?? '';
    const introductory = beforeLyrics && leading.length >= 2;
    const anchor = node('span', 'chord-start' + (introductory ? ' intro' : word ? '' : ' solo'), introductory ? '' : word);
    const button = node('button', 'chord-tag', transposed.label);
    button.type = 'button';
    button.dataset.chord = symbol.trim();
    button.setAttribute('aria-label', 'آکورد ' + transposed.label + ' روی پیانو');
    button.setAttribute('aria-pressed', String(symbol.trim() === selectedChord));
    anchor.append(button);
    paragraph.classList.add('has-chords');
    if (introductory) {
      anchor.style.marginInlineEnd = Math.min(leading.length * 0.18, 1.5) + 'em';
      paragraph.append(anchor, text.slice(leading.length));
    } else {
      paragraph.append(leading, anchor, text.slice(leading.length + word.length));
    }
    if (word) beforeLyrics = false;
  }
  paragraph.append(line.slice(offset));
  return paragraph;
}

function renderScore(source = piece.score) {
  const rows: HTMLElement[] = [];
  const lines = source.split('\n');
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

  const persianPitches = ['دو', 'دو دیز', 'ر', 'می بمل', 'می', 'فا', 'فا دیز', 'سل', 'لا بمل', 'لا', 'سی بمل', 'سی'];
  const preview = ownerAuthenticated && !editor.hidden;
  const modeName = (preview ? mode.value : piece.mode) === 'minor' ? 'مینور' : 'ماژور';
  const original = persianPitches[preview ? Number(originalKey.value) : piece.root] + ' ' + modeName;
  const selected = persianPitches[Number(key.value)] + ' ' + modeName;
  element('piece-key').textContent = 'گام اصلی: ' + original +
    (shift() === 0 ? '' : ' · گام انتخابی: ' + selected) +
    (piece.metadata?.timeSignature ? ' · کسر میزان: ' + piece.metadata.timeSignature : '') +
    (piece.metadata?.rhythm ? ' · ریتم: ' + piece.metadata.rhythm : '');
  element('reset-key').hidden = shift() === 0;
  element('piano-card').hidden = !chords.checked;
  renderPiano();
}

function renderVideo() {
  const takes = piece.takes ?? (piece.video ? [{ title: 'اجرای اصلی', url: piece.video, kind: 'video' }] : []);
  video.replaceChildren();
  if (!takes.length) {
    video.append(node('p', 'video-empty', 'هنوز اجرایی برای این قطعه ثبت نشده است.'));
    return;
  }
  for (const take of takes) {
    const card = node('details', 'take');
    card.append(node('summary', '', [take.title || 'اجرا', ...('recorded' in take ? [take.recorded, take.instrument] : [])].filter(Boolean).join(' · ')));
    if ('notes' in take && take.notes) card.append(node('p', '', take.notes));
    card.addEventListener('toggle', () => {
      if (!card.open || card.querySelector('iframe, video, audio')) return;
      const source = take.kind === 'audio' || take.url.startsWith('/api/media/') ? { kind: take.kind, src: take.url } : resolveVideo(take.url);
      if (!source) return;
      if (source.kind === 'embed') {
        const player = node('iframe');
        player.src = source.src;
        player.title = take.title || 'ویدیوی اجرا';
        player.referrerPolicy = 'strict-origin-when-cross-origin';
        player.allowFullscreen = true;
        card.append(player);
      } else {
        const player = source.kind === 'audio' ? node('audio') : node('video');
        player.src = source.src;
        player.controls = true;
        player.preload = 'none';
        card.append(player);
      }
    });
    video.append(card);
  }
}

function renderPermissions() {
  const realPiece = piece.id !== demo.id;
  const shareable = !['draft', 'private'].includes(piece.visibility ?? '');
  element('invite').hidden = !realPiece || !ownerAuthenticated || !shareable;
  element('share').hidden = !shareable;
  element('edit').hidden = !editingAvailable || !realPiece || (!ownerAuthenticated && !editKey);
  element('unlock').hidden = Boolean(ownerAuthenticated);
  element('owner-actions').hidden = !ownerAuthenticated;
}

function showPiece(next: Piece) {
  piece = next;
  selectedChord = '';
  element('piece-title').textContent = piece.title;
  if (!admin) document.title = piece.title + ' | هم‌نوا';
  element('piece-artist').textContent = piece.artist;
  const names: Record<string, string> = { composer: 'آهنگساز', lyricist: 'ترانه‌سرا', instrument: 'ساز', tempo: 'BPM', dastgah: 'دستگاه', difficulty: 'درجه سختی' };
  const metadata = piece.metadata ?? {};
  element('piece-details').textContent = [
    ...Object.entries(names).filter(([name]) => metadata[name]).map(([name, label]) => label + ' ' + metadata[name]),
    metadata.notes,
  ].filter(Boolean).join(' · ');
  element<HTMLInputElement>('metronome-bpm').value = metadata.tempo || '90';
  if (!admin && piece.slug) document.querySelector<HTMLLinkElement>('link[rel="canonical"]')!.href = pieceUrl(piece.id, false, piece.slug).href;
  key.value = String(piece.root);
  element('piece').hidden = false;
  renderPermissions();
  renderScore();
  renderVideo();
}

function startEditor(isNew: boolean) {
  creating = isNew;
  const editable = isNew ? { ...demo, title: '', artist: '', root: 0, mode: 'major', score: '' } : piece;
  element('editor-heading').textContent = isNew ? 'قطعهٔ تازه' : 'ویرایش قطعه';
  element('owner-fields').hidden = !ownerAuthenticated;
  element('score-tools').hidden = !ownerAuthenticated;
  title.value = editable.title;
  artist.value = editable.artist;
  slugInput.value = editable.slug ?? '';
  slugManuallyEdited = !isNew;
  updateSlugPreview();
  originalKey.value = String(editable.root);
  mode.value = editable.mode;
  visibility.value = isNew ? 'draft' : editable.visibility ?? (editable.listed ? 'published' : 'unlisted');
  metadataFields.forEach((field) => { field.value = editable.metadata?.[field.dataset.metadata!] ?? ''; });
  takeFields.replaceChildren();
  if (!isNew) editable.takes?.forEach((take) => addTake(takeFields, take));
  scoreInput.value = editable.score;
  dirty = false;
  editor.hidden = false;
  if (isNew || ownerAuthenticated) key.value = originalKey.value;
  element('editor-modes').hidden = !ownerAuthenticated;
  element('duplicate').hidden = element('delete-piece').hidden = isNew || !ownerAuthenticated;
  element('revoke-invite').hidden = isNew || !ownerAuthenticated || ['private', 'draft'].includes(visibility.value);
  visualEditor.setMode(ownerAuthenticated);
  repaint();
  (ownerAuthenticated ? title : scoreInput).focus();
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

async function loadOwner() {
  const pieces = await api<Pick<Piece, 'id' | 'title' | 'slug'>[]>('owner/pieces');
  ownerAuthenticated = true;
  ownerPieces = pieces;
  filterOwner();
  renderPermissions();
}

async function loadLibrary() {
  const pieces = await api<Pick<Piece, 'id' | 'title' | 'slug'>[]>('pieces');
  renderList('piece-list', [demo, ...pieces]);
  element('library').hidden = false;
}

element<HTMLFormElement>('unlock').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  if (button.disabled) return;
  button.disabled = true;
  try {
    await api('owner/login', {
      method: 'POST',
      data: { username: usernameInput.value.trim(), password: passwordInput.value },
    });
    await loadOwner();
    notice('');
    if (!(await loadAdminPiece())) element('new-piece').focus();
  } catch (error) {
    notice(message(error), true);
  } finally {
    passwordInput.value = '';
    button.disabled = false;
  }
});
element('logout').addEventListener('click', async () => {
  if (!editor.hidden && dirty && !window.confirm('تغییرات ذخیره‌نشده کنار گذاشته شوند؟')) return;
  dirty = false;
  try {
    await api('owner/logout', { method: 'POST' });
  } catch (error) {
    notice(message(error), true);
    return;
  }
  ownerAuthenticated = false;
  element('owner-list').replaceChildren();
  editor.hidden = true;
  element('piece').hidden = true;
  notice('');
  renderPermissions();
  usernameInput.focus();
});
const repaint = () => {
  if (admin && !editor.hidden && creating) {
    element('piece').hidden = false;
    element('piece-title').textContent = title.value || 'پیش‌نمایش قطعه';
    element('piece-artist').textContent = artist.value;
    element('share').hidden = element('invite').hidden = element('edit').hidden = true;
  }
  renderScore(editor.hidden ? piece.score : scoreInput.value);
};
const visualEditor = bindVisualEditor(scoreInput, repaint);
chords.addEventListener('change', repaint);
key.addEventListener('change', repaint);
direction.addEventListener('change', repaint);
bindPerformance();
element('edit-form').addEventListener('input', () => { dirty = true; repaint(); });
originalKey.addEventListener('change', () => { key.value = originalKey.value; repaint(); });
window.addEventListener('beforeunload', (event) => {
  if (!dirty || editor.hidden) return;
  event.preventDefault();
});
element('add-take').addEventListener('click', () => { addTake(takeFields); dirty = true; });
element('reset-key').addEventListener('click', () => {
  key.value = ownerAuthenticated && !editor.hidden ? originalKey.value : String(piece.root);
  key.focus();
  repaint();
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
element('share').addEventListener('click', () => void copy(pieceUrl(piece.id, false, piece.slug)));
element('invite').addEventListener('click', async () => {
  try {
    const { key: token } = await api<{ key: string }>('owner/pieces/' + piece.id + '/invite');
    const url = pieceUrl(piece.id, false, piece.slug);
    url.hash = 'edit=' + token;
    await copy(url);
  } catch (error) {
    notice(message(error), true);
  }
});
element('edit').addEventListener('click', () => startEditor(false));
element('new-piece').addEventListener('click', () => startEditor(true));
element('cancel').addEventListener('click', () => {
  if (dirty && !window.confirm('تغییرات ذخیره‌نشده کنار گذاشته شوند؟')) return;
  dirty = false;
  editor.hidden = true;
  if (piece.id !== demo.id || !admin) renderScore();
  else element('piece').hidden = true;
  element(creating ? 'new-piece' : 'edit').focus();
});
element<HTMLFormElement>('edit-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (saving) return;
  if (takeFields.querySelector('input[type=file]:disabled')) return notice('منتظر پایان بارگذاری بمان.', true);
  const isNew = creating;
  const submit = element('edit-form').querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const data: Record<string, unknown> = { score: scoreInput.value, revision: piece.revision };
  if (ownerAuthenticated) Object.assign(data, {
    title: title.value.trim(),
    slug: slugInput.value,
    artist: artist.value.trim(),
    root: Number(originalKey.value),
    mode: mode.value,
    video: '',
    listed: visibility.value === 'published',
    visibility: visibility.value,
    metadata: Object.fromEntries(metadataFields.map((field) => [field.dataset.metadata, field.value])),
    takes: Array.from(takeFields.children, (row) => ({ id: (row as HTMLElement).dataset.takeId, ...Object.fromEntries(
      Array.from(row.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-take]'), (field) => [field.dataset.take, field.value.trim()]),
    )})).filter((take) => 'url' in take && take.url),
  });
  submit.disabled = saving = true;
  try {
    const next = await api<Piece>(isNew ? 'owner/pieces' : 'pieces/' + piece.id, {
      method: isNew ? 'POST' : 'PUT', key: editKey, data,
    });
    dirty = false;
    if (isNew) {
      location.assign(pieceUrl(next.id, true).href);
      return;
    }
    showPiece(next);
    if (ownerAuthenticated) startEditor(false);
    notice('قطعه ذخیره شد.');
    if (!ownerAuthenticated) { editor.hidden = true; element('edit').focus(); }
    if (!admin) void loadLibrary().catch(() => {});
    if (ownerAuthenticated) void loadOwner().catch(() => {});
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
  const current = scoreInput.value;
  const selectionStart = visualEditor.position();
  const selectionEnd = visualEditor.isVisual() ? selectionStart : scoreInput.selectionEnd;
  const prefix = asLine && selectionStart > 0 && current[selectionStart - 1] !== '\n' ? '\n' : '';
  const suffix = asLine && current[selectionEnd] !== '\n' ? '\n' : '';
  if (current.length - (selectionEnd - selectionStart) + prefix.length + value.length + suffix.length > scoreInput.maxLength) {
    notice('اندازهٔ متن بیش از حد مجاز است.', true);
    return;
  }
  scoreInput.setRangeText(prefix + value + suffix, selectionStart, selectionEnd, 'end');
  scoreInput.dispatchEvent(new Event('input', { bubbles: true }));
  if (!visualEditor.isVisual()) scoreInput.focus();
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
element('add-intro').addEventListener('click', () => {
  const symbol = chordInput.value.trim();
  if (!chord(symbol)) return notice('ابتدا یک آکورد معتبر انتخاب کن.', true);
  const start = visualEditor.lineStart();
  const existing = /^(?:\[[^\]]+\][ \t]{2,})*/.exec(scoreInput.value.slice(start))![0];
  scoreInput.setRangeText('[' + symbol + ']     ', start + existing.length, start + existing.length);
  scoreInput.dispatchEvent(new Event('input', { bubbles: true }));
});
chordInput.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  element('add-chord').click();
});
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-score-line]')) {
  button.addEventListener('click', () => insertScore(button.dataset.scoreLine!, true));
}

function updateSlugPreview() {
  element('slug-preview').textContent = 'https://music.amirhossein-danesh.ir/' + slugInput.value;
}
title.addEventListener('input', () => {
  if (!slugManuallyEdited) slugInput.value = normalizeSlug(title.value);
  updateSlugPreview();
});
slugInput.addEventListener('input', () => {
  slugManuallyEdited = true;
  updateSlugPreview();
});
element('duplicate').addEventListener('click', () => {
  if (!window.confirm('از این قطعه یک پیش‌نویس جدید ساخته شود؟')) return;
  creating = true;
  title.value += ' (کپی)';
  slugInput.value = (piece.slug || 'قطعه').slice(0, 75).replace(/-+$/, '') + '-کپی-' + Date.now().toString(36);
  visibility.value = 'draft';
  dirty = true;
  element('editor-heading').textContent = 'کپی قطعه';
  element('duplicate').hidden = element('delete-piece').hidden = element('revoke-invite').hidden = true;
  updateSlugPreview();
  title.focus();
});
element('delete-piece').addEventListener('click', async () => {
  if (!window.confirm('قطعه و نشانی‌های آن برای همیشه حذف شوند؟')) return;
  try {
    await api('pieces/' + piece.id, { method: 'DELETE' });
    dirty = false;
    location.assign(pieceUrl(demo.id, true).href);
  } catch (error) { notice(message(error), true); }
});
element('revoke-invite').addEventListener('click', async () => {
  if (!window.confirm('پیوند قبلی ویرایش لغو شود؟')) return;
  try {
    await api('owner/pieces/' + piece.id + '/invite', { method: 'POST' });
    notice('پیوند قبلی لغو شد.');
  } catch (error) { notice(message(error), true); }
});

async function initialize() {
  if (admin) {
    if (!editingAvailable) {
      notice('برای ورود به پنل، آدرس را با HTTPS باز کن.', true);
      return;
    }
    element('owner').hidden = false;
    try {
      await loadOwner();
      await loadAdminPiece();
    } catch (error) {
      if (!(error instanceof Error && 'status' in error && error.status === 401)) {
        notice(message(error), true);
      }
    }
    return;
  }

  if (selectedSlug) {
    try {
      const found = await api<Piece>('slug/' + encodeURIComponent(decodeURIComponent(selectedSlug)));
      showPiece(found);
      if (found.slug !== decodeURIComponent(selectedSlug)) history.replaceState(null, '', pieceUrl(found.id, false, found.slug).pathname + location.hash);
    } catch (error) {
      notice(message(error), true);
    }
  } else if (selectedId === demo.id) {
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
