import { chord, noteSequence, pitchNames } from './notation';

function node<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = '') {
  const item = document.createElement(tag);
  item.className = className;
  item.textContent = text;
  return item;
}

export function createScoreRenderer(score: HTMLElement, piano: HTMLElement, pianoPanel: HTMLDetailsElement) {
  let selectedChord = '';
  let semitones = 0;
  let showChords = true;
  function renderPiano() {
    const active = selectedChord && chord(selectedChord, semitones);
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

      const transposed = chord(symbol.trim(), semitones);
      if (!transposed) {
        if (match[0].trim()) beforeLyrics = false;
        paragraph.append(match[0]);
        continue;
      }
      if (!showChords) {
        paragraph.append(beforeLyrics && /^\s{2,}/.test(text) ? text.trimStart() : text);
        if (text.trim()) beforeLyrics = false;
        continue;
      }

      const leading = /^\s*/.exec(text)?.[0] ?? '';
      const word = /^\S+/.exec(text.slice(leading.length))?.[0] ?? '';
      const introductory = beforeLyrics && leading.length >= 2;
      const anchor = node('span', 'chord-start' + (introductory ? ' intro' : word ? '' : ' solo'));
      const button = node('button', 'chord-tag', transposed.label);
      button.type = 'button';
      button.dataset.chord = symbol.trim();
      button.setAttribute('aria-label', 'آکورد ' + transposed.label + ' روی پیانو');
      button.setAttribute('aria-pressed', String(symbol.trim() === selectedChord));
      anchor.append(button);
    if (word && !introductory) anchor.append(node('span', 'chord-word', word));
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

  function render(source: string, transpose: number, visible: boolean) {
    semitones = transpose;
    showChords = visible;
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
          const notesElement = node('code', '', noteSequence(notes.join('|').trim(), semitones));
          notesElement.dir = 'ltr';
          cue.append(notesElement);
        }
        rows.push(cue);
        continue;
      }
      rows.push(lyricLine(line));
    }
    score.replaceChildren(...(rows.length ? rows : [node('p', 'empty-score', 'متن این قطعه هنوز وارد نشده است.')]));
    pianoPanel.hidden = !showChords || !score.querySelector('button[data-chord]');
    renderPiano();
  }

  score.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-chord]');
    if (!button) return;
    selectedChord = button.dataset.chord ?? '';
    for (const tag of score.querySelectorAll<HTMLButtonElement>('button[data-chord]')) {
      tag.setAttribute('aria-pressed', String(tag.dataset.chord === selectedChord));
    }
    pianoPanel.open = true;
    renderPiano();
  });

  return { render, reset() { selectedChord = ''; pianoPanel.open = false; } };
}
