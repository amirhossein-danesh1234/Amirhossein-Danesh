import { normalizeSlug } from '../../ops/music/slug.mjs';
import type { Piece } from './demo';

export type SongRow = Pick<Piece, 'id' | 'title' | 'slug' | 'visibility'> & Partial<Pick<Piece, 'artist' | 'root' | 'mode' | 'metadata'>>;
const states = { draft: 'پیش‌نویس', published: 'منتشرشده', unlisted: 'دارای پیوند', private: 'خصوصی' };
const pitches = ['دو', 'دو دیز', 'ر', 'می بمل', 'می', 'فا', 'فا دیز', 'سل', 'لا بمل', 'لا', 'سی بمل', 'سی'];

export function bindSongLibrary(list: HTMLElement, search: HTMLInputElement, linkFor: (song: SongRow) => string) {
  let songs: SongRow[] = [];
  function render() {
    const query = normalizeSlug(search.value);
    const visible = songs.filter((song) => normalizeSlug([song.title, song.slug, song.artist, song.metadata?.instrument].filter(Boolean).join(' ')).includes(query));
    list.replaceChildren();
    if (!visible.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-row';
      empty.textContent = query ? 'قطعه‌ای مطابق جست‌وجو پیدا نشد.' : 'هنوز قطعه‌ای ثبت نشده است.';
      list.append(empty);
      return;
    }
    for (const song of visible) {
      const row = document.createElement('a');
      row.className = 'song-row';
      row.href = linkFor(song);
      const title = document.createElement('strong');
      title.textContent = song.title;
      const details = document.createElement('span');
      const key = song.root === undefined ? '' : pitches[song.root] + (song.mode === 'minor' ? ' مینور' : ' ماژور');
      details.textContent = [song.artist, song.metadata?.instrument, key, song.metadata?.timeSignature, song.metadata?.rhythm].filter(Boolean).join(' · ');
      const status = document.createElement('span');
      status.className = 'row-status';
      status.textContent = song.visibility ? states[song.visibility] : 'مشاهده';
      row.append(title, details, status);
      list.append(row);
    }
  }
  search.addEventListener('input', render);
  return (next: SongRow[]) => { songs = next; render(); };
}
