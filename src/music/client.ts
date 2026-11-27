import { demo, type Piece } from './demo';
import { bindVisualEditor } from './editor';
import { addTake } from './media-manager';
import { bindSongPage } from './song-page';
import { bindSongLibrary, type SongRow } from './song-library';
import { bindPerformance } from './performance';
import { chord } from './notation';
import { normalizeSlug } from '../../ops/music/slug.mjs';

function element<T extends HTMLElement = HTMLElement>(id: string) {
  return document.getElementById(id) as T;
}

const key = element<HTMLSelectElement>('key');
const chords = element<HTMLInputElement>('chords');
const voice = element<HTMLInputElement>('voice');
const songPage = bindSongPage(element('piece'));
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
const direction = element<HTMLSelectElement>('shift-direction');
let dirty = false;
const scoreInput = element<HTMLTextAreaElement>('score-input');
const usernameInput = element<HTMLInputElement>('admin-username');
const passwordInput = element<HTMLInputElement>('admin-password');
const admin = document.body.dataset.musicMode === 'admin';
const selectedId = new URL(location.href).searchParams.get('piece');
const selectedSlug = admin ? '' : location.pathname.replace(/^\/+|\/+$/g, '');
const editKey = admin ? '' : new URLSearchParams(location.hash.slice(1)).get('edit') ?? '';
const editingAvailable = window.isSecureContext;
let ownerAuthenticated = false;
const showOwnerList = bindSongLibrary(element('owner-list'), element('owner-search'), (song) => pieceUrl(song.id, true).href);
const showLibrary = admin ? undefined : bindSongLibrary(element('piece-list'), element('library-search'), (song) => {
  const url = pieceUrl(song.id, false, song.slug);
  return url.pathname + url.search;
}, element('library-count'));
let piece = demo;
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
  else if (!insidePanel || id !== demo.id) url.searchParams.set('piece', id);
  return url;
};

function renderPermissions() {
  const realPiece = piece.id !== demo.id;
  const shareable = !['draft', 'private'].includes(piece.visibility ?? '');
  element('invite').hidden = !realPiece || !ownerAuthenticated || !shareable;
  element('share').hidden = !shareable;
  element('edit').hidden = !editingAvailable || !realPiece || (!ownerAuthenticated && !editKey);
  element('unlock').hidden = Boolean(ownerAuthenticated);
  element('owner-actions').hidden = !ownerAuthenticated;
  element('song-actions').hidden = admin || (element('edit').hidden && element('share').hidden);
}

function showPiece(next: Piece) {
  piece = next;
  if (!admin) document.title = piece.title + ' | هم‌نوا';
  if (!admin && piece.slug) document.querySelector<HTMLLinkElement>('link[rel="canonical"]')!.href = pieceUrl(piece.id, false, piece.slug).href;
  element('piece').hidden = false;
  renderPermissions();
  songPage.reset(piece);
}

function startEditor(isNew: boolean) {
  creating = isNew;
  const editable = isNew ? { ...demo, title: '', artist: '', root: 0, mode: 'major', score: '' } : piece;
  element('editor-heading').textContent = isNew ? 'قطعهٔ تازه' : editable.title;
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
  if (admin) {
    element('owner').hidden = true;
    const panel = element<HTMLDetailsElement>('song-preview');
    panel.hidden = false;
    element('editor-back').hidden = false;
    element('publish-piece').hidden = visibility.value === 'published';
    element('publish-piece').textContent = 'ذخیره و انتشار';
    element('save-state').textContent = 'ویرایش قطعه';
  } else element('editor-back').hidden = true;
  if (isNew || ownerAuthenticated) key.value = originalKey.value;
  element('editor-modes').hidden = !ownerAuthenticated;
  element('duplicate').hidden = element('delete-piece').hidden = isNew || !ownerAuthenticated;
  element('revoke-invite').hidden = isNew || !ownerAuthenticated || ['private', 'draft'].includes(visibility.value);
  visualEditor.setMode(ownerAuthenticated);
  repaint();
  (ownerAuthenticated ? element('visual-lyrics') : scoreInput).focus({ preventScroll: true });
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
  const pieces = await api<SongRow[]>('owner/pieces');
  ownerAuthenticated = true;
  showOwnerList(pieces);
  renderPermissions();
}

async function loadLibrary() {
  const pieces = await api<SongRow[]>('pieces');
  showLibrary?.([...pieces, demo]);
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
function readMetadata() {
  return Object.fromEntries(metadataFields.map((field) => [field.dataset.metadata!, field.value]));
}

function previewPiece(): Piece {
  return {
    ...piece,
    title: title.value || 'پیش‌نمایش قطعه',
    artist: artist.value,
    root: Number(originalKey.value),
    mode: mode.value as Piece['mode'],
    metadata: readMetadata(),
    score: scoreInput.value,
  };
}
const repaint = () => {
  if (!editor.hidden && admin) {
    element('piece').hidden = false;
    songPage.render(previewPiece());
  } else songPage.render(editor.hidden ? piece : { ...piece, score: scoreInput.value });
};
const visualEditor = bindVisualEditor(scoreInput, repaint);
chords.addEventListener('change', repaint);
voice.addEventListener('change', repaint);
key.addEventListener('change', repaint);
direction.addEventListener('change', repaint);
bindPerformance();
if (admin) element('sharing-actions').prepend(element('share'), element('invite'));
function markDirty() {
  dirty = true;
  element('save-state').textContent = 'تغییرات ذخیره نشده‌اند';
}
element('edit-form').addEventListener('input', () => { markDirty(); repaint(); });
originalKey.addEventListener('change', () => { key.value = originalKey.value; repaint(); });
window.addEventListener('beforeunload', (event) => {
  if (!dirty || editor.hidden) return;
  event.preventDefault();
});
element('add-take').addEventListener('click', () => { addTake(takeFields); markDirty(); });
element('reset-key').addEventListener('click', () => {
  key.value = ownerAuthenticated && !editor.hidden ? originalKey.value : String(piece.root);
  key.focus();
  repaint();
});
element('share').addEventListener('click', () => {
  const url = pieceUrl(piece.id, false, piece.slug);
  if (!admin && voice.checked) url.searchParams.set('view', 'lyrics');
  if (!admin && Number(key.value) !== piece.root) url.searchParams.set('key', key.value);
  void copy(url);
});
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
function closeEditor() {
  if (dirty && !window.confirm('تغییرات ذخیره‌نشده کنار گذاشته شوند؟')) return;
  dirty = false;
  if (admin) {
    location.assign(pieceUrl(demo.id, true).href);
  } else {
    editor.hidden = true;
    songPage.render(piece);
    element('edit').focus();
  }
}
element('cancel').addEventListener('click', closeEditor);
element('editor-back').addEventListener('click', closeEditor);
element('publish-piece').addEventListener('click', () => {
  visibility.value = 'published';
  markDirty();
  element<HTMLFormElement>('edit-form').requestSubmit();
});
element<HTMLFormElement>('edit-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (saving) return;
  if (takeFields.querySelector('input[type=file]:disabled')) return notice('منتظر پایان بارگذاری بمان.', true);
  if (ownerAuthenticated && !title.value.trim()) {
    element<HTMLDetailsElement>('metadata-section').open = true;
    title.focus();
    return notice('نام قطعه را وارد کن.', true);
  }
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
    metadata: readMetadata(),
    takes: Array.from(takeFields.children, (row) => ({ id: (row as HTMLElement).dataset.takeId, ...Object.fromEntries(
      Array.from(row.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-take]'), (field) => [field.dataset.take, field.value.trim()]),
    )})).filter((take) => 'url' in take && take.url),
  });
  submit.disabled = saving = true;
  element<HTMLButtonElement>('publish-piece').disabled = true;
  element('save-state').textContent = 'در حال ذخیره…';
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
    element('save-state').textContent = 'ذخیره شد';
    notice('قطعه ذخیره شد.');
    if (!ownerAuthenticated) { editor.hidden = true; element('edit').focus(); }
    if (ownerAuthenticated) void loadOwner().catch(() => {});
  } catch (error) {
    notice(message(error), true);
    element('save-state').textContent = 'ذخیره انجام نشد';
    noticeElementIntoView();
  } finally {
    submit.disabled = saving = false;
    element<HTMLButtonElement>('publish-piece').disabled = false;
  }
});

function noticeElementIntoView() {
  element('notice').scrollIntoView({ block: 'nearest' });
}

async function loadAdminPiece() {
  if (!selectedId || selectedId === demo.id) return false;
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
  if (scoreInput.value.length + symbol.length + 7 > scoreInput.maxLength) return notice('اندازهٔ متن بیش از حد مجاز است.', true);
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
      if (found.slug !== decodeURIComponent(selectedSlug)) history.replaceState(null, '', pieceUrl(found.id, false, found.slug).pathname + location.search + location.hash);
    } catch (error) {
      notice(message(error), true);
    }
  } else if (selectedId === demo.id) {
    showPiece(demo);
  } else if (selectedId) {
    try {
      showPiece(await api<Piece>('pieces/' + encodeURIComponent(selectedId)));
    } catch (error) {
      notice(message(error), true);
    }
  }
  if (!element('piece').hidden) {
    const shared = new URLSearchParams(location.search);
    const tonic = shared.get('key');
    if (shared.get('view') === 'lyrics') voice.checked = true;
    if (tonic !== null && /^(?:[0-9]|1[01])$/.test(tonic)) key.value = tonic;
    if (voice.checked || Number(key.value) !== piece.root) repaint();
  }
  if (!selectedSlug && !selectedId) {
    element('library').hidden = false;
    try { await loadLibrary(); } catch (error) { notice(message(error), true); }
  }
}

void initialize();
