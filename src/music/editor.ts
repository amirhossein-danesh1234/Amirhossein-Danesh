import { chord, pitchNames } from './notation';

type ChordMark = { index: number; value: string; start: number; end: number };

export function projectLyrics(markup: string) {
  const marks: ChordMark[] = [];
  const offsets: number[] = [];
  let text = '';
  let beforeLyrics = true;
  let literalLine = /^[#!~] /.test(markup);
  for (let i = 0; i < markup.length;) {
    const symbol = !literalLine && markup[i] === '[' ? /^\[([^\][\r\n]+)\]/.exec(markup.slice(i)) : null;
    if (symbol && chord(symbol[1].trim())) {
      const start = i;
      i += symbol[0].length;
      const gap = beforeLyrics ? /^[ \t]{2,}/.exec(markup.slice(i)) : null;
      if (gap) i += gap[0].length;
      marks.push({ index: text.length, value: markup.slice(start, i), start, end: i });
      continue;
    }
    offsets.push(i);
    const char = markup[i++];
    text += char;
    if (char === '\n') {
      beforeLyrics = true;
      literalLine = /^[#!~] /.test(markup.slice(i));
    }
    else if (char.trim()) beforeLyrics = false;
  }
  offsets.push(markup.length);
  return { text, marks, offsets };
}

export function editLyrics(previous: ReturnType<typeof projectLyrics>, next: string, selection: [number, number]) {
  const old = previous.text;
  let start = 0;
  let tail = 0;
  const limit = Math.min(old.length, next.length, selection[0]);
  while (start < limit && old[start] === next[start]) start++;
  while (old.length - tail > Math.max(start, selection[1]) && next.length - tail > start &&
    old[old.length - tail - 1] === next[next.length - tail - 1]) tail++;
  if (old === next) return null;
  const oldEnd = old.length - tail;
  const nextEnd = next.length - tail;
  const markers = new Map<number, string>();
  for (const mark of previous.marks) {
    const position = mark.index <= start ? mark.index
      : mark.index >= oldEnd ? mark.index + nextEnd - oldEnd
      : Math.min(mark.index, nextEnd);
    markers.set(position, (markers.get(position) ?? '') + mark.value);
  }
  let raw = '';
  for (let i = 0; i <= next.length; i++) raw += (markers.get(i) ?? '') + (next[i] ?? '');
  return raw;
}

export function bindVisualEditor(source: HTMLTextAreaElement, preview: () => void) {
  const find = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const area = find('visual-score');
  const lyrics = find<HTMLTextAreaElement>('visual-lyrics');
  const label = find('score-label');
  const visualButton = find<HTMLButtonElement>('visual-mode');
  const rawButton = find<HTMLButtonElement>('raw-mode');
  const chooser = find<HTMLInputElement>('chord-input');
  const trigger = find<HTMLButtonElement>('toggle-chord-tool');
  const tool = find('chord-tool');
  const context = find('chord-context');
  const move = find<HTMLButtonElement>('move-chord');
  const remove = find<HTMLButtonElement>('remove-chord');
  const existing = document.createElement('select');
  existing.setAttribute('aria-label', 'آکوردهای درج‌شده');
  tool.append(existing);
  let projection = projectLyrics('');
  let visual = false;
  let selection: [number, number] = [0, 0];
  let previousSelection: [number, number] = [0, 0];

  function cursor() {
    if (!visual) return source.selectionStart;
    const [start, end] = selection;
    if (start !== end) return start;
    return start - (/[^\s]+$/.exec(lyrics.value.slice(0, start))?.[0].length ?? 0);
  }

  function updateContext() {
    const active = Boolean(existing.value);
    move.hidden = remove.hidden = !active;
    const text = visual ? lyrics.value : source.value;
    const from = cursor();
    const word = /^\S+/.exec(text.slice(from))?.[0] ?? '';
    context.textContent = word ? 'محل درج: ' + word.slice(0, 60) : 'نشانگر را در متن قرار بده.';
  }

  function paint() {
    projection = projectLyrics(source.value);
    if (visual && lyrics.value !== projection.text) {
      lyrics.value = projection.text;
      const start = Math.min(selection[0], lyrics.value.length);
      const end = Math.min(selection[1], lyrics.value.length);
      lyrics.setSelectionRange(start, end);
    }
    existing.replaceChildren(new Option('آکوردهای درج‌شده', ''));
    projection.marks.forEach((mark, i) => {
      const line = projection.text.slice(0, mark.index).split('\n').length;
      existing.add(new Option(mark.value.trim() + ' · سطر ' + line, String(i)));
    });
    updateContext();
  }

  function setMode(value: boolean) {
    visual = value;
    area.hidden = !visual;
    source.hidden = label.hidden = visual;
    visualButton.setAttribute('aria-pressed', String(visual));
    rawButton.setAttribute('aria-pressed', String(!visual));
    find('score-format').hidden = visual;
    tool.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    selection = [0, 0];
    paint();
  }

  function markSelection() {
    selection = [lyrics.selectionStart, lyrics.selectionEnd];
    updateContext();
  }
  lyrics.addEventListener('beforeinput', () => { previousSelection = [lyrics.selectionStart, lyrics.selectionEnd]; });
  lyrics.addEventListener('input', () => {
    const next = editLyrics(projection, lyrics.value, previousSelection);
    if (next === null) return;
    if (next.length > source.maxLength) {
      paint();
      return;
    }
    selection = [lyrics.selectionStart, lyrics.selectionEnd];
    source.value = next;
    source.dispatchEvent(new Event('input', { bubbles: true }));
  });
  for (const event of ['select', 'keyup', 'pointerup', 'focus']) lyrics.addEventListener(event, markSelection);
  source.addEventListener('select', updateContext);
  trigger.addEventListener('click', () => {
    tool.hidden = !tool.hidden;
    trigger.setAttribute('aria-expanded', String(!tool.hidden));
    if (!tool.hidden) { updateContext(); chooser.focus(); }
  });

  function currentMark() {
    return existing.value ? projection.marks[Number(existing.value)] : undefined;
  }
  existing.addEventListener('change', () => {
    const mark = currentMark();
    if (mark) chooser.value = /^\[([^\]]+)\]/.exec(mark.value)?.[1].trim() ?? '';
    updateContext();
  });
  remove.addEventListener('click', () => {
    const mark = currentMark();
    if (!mark) return;
    source.setRangeText('', mark.start, mark.end);
    source.dispatchEvent(new Event('input', { bubbles: true }));
  });
  move.addEventListener('click', () => {
    const mark = currentMark();
    if (!mark) return;
    let at = visual ? projection.offsets[cursor()] : cursor();
    if (at >= mark.start && at < mark.end) return;
    source.setRangeText('', mark.start, mark.end);
    if (at >= mark.end) at -= mark.end - mark.start;
    source.setRangeText(mark.value.trimEnd(), at, at);
    source.dispatchEvent(new Event('input', { bubbles: true }));
  });

  visualButton.addEventListener('click', () => setMode(true));
  rawButton.addEventListener('click', () => setMode(false));
  source.addEventListener('input', () => { paint(); preview(); });
  const choices = find<HTMLDataListElement>('common-chords');
  for (const note of pitchNames) {
    for (const quality of ['', 'm', '7', 'maj7', 'm7', 'sus4', 'dim']) choices.append(new Option(note + quality, note + quality));
  }

  return {
    setMode,
    position() { return visual ? projection.offsets[cursor()] ?? source.value.length : source.selectionStart; },
    lineStart() {
      if (!visual) return source.value.lastIndexOf('\n', source.selectionStart - 1) + 1;
      const at = projection.offsets[selection[0]] ?? 0;
      return at ? source.value.lastIndexOf('\n', at - 1) + 1 : 0;
    },
    isVisual: () => visual,
  };
}
