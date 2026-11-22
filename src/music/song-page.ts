import type { Piece } from './demo';
import { createScoreRenderer } from './score-renderer';
import { resolveVideo } from '../../ops/music/video.mjs';

function node<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = '') {
  const item = document.createElement(tag);
  item.className = className;
  item.textContent = text;
  return item;
}

export function bindSongPage(root: HTMLElement) {
  const find = <T extends HTMLElement = HTMLElement>(id: string) => root.querySelector<T>('#' + id)!;
  const key = find<HTMLSelectElement>('key');
  const chords = find<HTMLInputElement>('chords');
  const direction = find<HTMLSelectElement>('shift-direction');
  const video = find('video');
  const recordings = find<HTMLDetailsElement>('recordings-panel');
  const scoreRenderer = createScoreRenderer(find('score'), find('piano'), find<HTMLDetailsElement>('piano-card'));
  function shift(root: number) {
    const distance = (Number(key.value) - root + 12) % 12;
    if (distance === 0 || direction.value === 'up') return distance;
    if (direction.value === 'down') return distance - 12;
    return distance > 6 ? distance - 12 : distance;
  }

  function renderScore(piece: Piece) {
    const semitones = shift(piece.root);
    scoreRenderer.render(piece.score, semitones, chords.checked);
    const persianPitches = ['دو', 'دو دیز', 'ر', 'می بمل', 'می', 'فا', 'فا دیز', 'سل', 'لا بمل', 'لا', 'سی بمل', 'سی'];
    const modeName = piece.mode === 'minor' ? 'مینور' : 'ماژور';
    const original = persianPitches[piece.root] + ' ' + modeName;
    const selected = persianPitches[Number(key.value)] + ' ' + modeName;
    find('piece-key').textContent = 'گام اصلی: ' + original +
      (semitones === 0 ? '' : ' · گام انتخابی: ' + selected) +
      (piece.metadata?.timeSignature ? ' · کسر میزان: ' + piece.metadata.timeSignature : '') +
      (piece.metadata?.rhythm ? ' · ریتم: ' + piece.metadata.rhythm : '');
    find('reset-key').hidden = semitones === 0;

  }

  function renderRecordings(piece: Piece) {
    const takes = piece.takes ?? (piece.video ? [{ title: 'اجرای اصلی', url: piece.video, kind: 'video' }] : []);
    video.replaceChildren();
    recordings.hidden = takes.length === 0;
    recordings.open = false;
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

  function renderHeader(piece: Piece) {
    find('piece-title').textContent = piece.title;
    find('piece-artist').textContent = piece.artist;
    const names: Record<string, string> = { composer: 'آهنگساز', lyricist: 'ترانه‌سرا', instrument: 'ساز', tempo: 'BPM', dastgah: 'دستگاه', difficulty: 'درجه سختی' };
    const metadata = piece.metadata ?? {};
    find('piece-details').textContent = [
      ...Object.entries(names).filter(([name]) => metadata[name]).map(([name, label]) => label + ' ' + metadata[name]),
      metadata.notes,
    ].filter(Boolean).join(' · ');
    find('song-details').hidden = !find('piece-details').textContent;
  }

  return {
    render(piece: Piece) { renderHeader(piece); renderScore(piece); },
    reset(piece: Piece) {
      key.value = String(piece.root);
      find<HTMLInputElement>('metronome-bpm').value = piece.metadata?.tempo || '90';
      scoreRenderer.reset();
      renderHeader(piece);
      renderScore(piece);
      renderRecordings(piece);
    },
  };
}
