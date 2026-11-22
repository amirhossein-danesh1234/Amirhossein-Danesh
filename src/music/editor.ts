import { chord, pitchNames } from './notation';
import type { Take } from './demo';

export function bindVisualEditor(source: HTMLTextAreaElement, preview: () => void) {
  const area = document.querySelector<HTMLElement>('#visual-score')!;
  const label = document.querySelector<HTMLElement>('#score-label')!;
  const visualButton = document.querySelector<HTMLButtonElement>('#visual-mode')!;
  const rawButton = document.querySelector<HTMLButtonElement>('#raw-mode')!;
  const chooser = document.querySelector<HTMLInputElement>('#chord-input')!;
  let visual = false;
  let activeLine = 0;
  let cursor = 0;
  let moving: { start: number; end: number; text: string } | undefined;

  const button = (title: string, onClick: () => void) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'quiet';
    item.textContent = title;
    item.addEventListener('click', onClick);
    return item;
  };
  function change(start: number, end: number, text: string) {
    if (source.value.length - end + start + text.length > source.maxLength) return;
    source.setRangeText(text, start, end, 'end');
    source.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function paint() {
    area.replaceChildren();
    if (!visual) return;
    const paste = document.createElement('textarea');
    paste.rows = 2;
    paste.placeholder = 'متن فارسی را اینجا وارد یا جای‌گذاری کن';
    paste.setAttribute('aria-label', paste.placeholder);
    area.append(paste, button('افزودن سطرهای متن', () => {
      if (!paste.value) return;
      change(source.value.length, source.value.length, (source.value ? '\n' : '') + paste.value);
    }));
    let offset = 0;
    for (const [index, line] of source.value.split('\n').entries()) {
      const start = offset;
      offset += line.length + 1;
      const row = document.createElement('div');
      row.className = 'visual-line actions';
      row.append(button('ابتدای سطر', () => select(start, index)));
      for (const token of line.matchAll(/\[[^\]\r\n]+\]|\S+?(?=\[|\s|$)|\[/g)) {
        const text = token[0];
        const at = start + token.index!;
        if (text.startsWith('[') && text.endsWith(']') && chord(text.slice(1, -1).trim())) {
          const existing = button(text, () => {
            moving = { start: at, end: at + text.length, text };
            activeLine = index;
            chooser.value = text.slice(1, -1).trim();
            chooser.focus();
          });
          existing.dir = 'ltr';
          row.append(existing, button('×', () => change(at, at + text.length, '')));
        } else {
          row.append(button(text, () => select(at, index)));
        }
      }
      const edit = document.createElement('input');
      edit.value = line;
      edit.setAttribute('aria-label', 'متن سطر ' + (index + 1));
      const save = () => { if (edit.value !== line) change(start, start + line.length, edit.value); };
      edit.addEventListener('change', save);
      edit.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') { event.preventDefault(); save(); }
      });
      row.append(edit);
      area.append(row);
    }
  }
  function select(at: number, line: number) {
    activeLine = line;
    cursor = at;
    if (moving) {
      const move = moving;
      moving = undefined;
      if (at >= move.start && at <= move.end) return;
      source.setRangeText('', move.start, move.end);
      if (at > move.end) at -= move.end - move.start;
      change(at, at, move.text);
      return;
    }
    chooser.focus();
  }
  function setMode(value: boolean) {
    visual = value;
    area.hidden = !visual;
    source.hidden = label.hidden = visual;
    visualButton.setAttribute('aria-pressed', String(visual));
    rawButton.setAttribute('aria-pressed', String(!visual));
    moving = undefined;
    cursor = activeLine = 0;
    paint();
  }

  visualButton.addEventListener('click', () => setMode(true));
  rawButton.addEventListener('click', () => setMode(false));
  source.addEventListener('input', () => { paint(); preview(); });
  const choices = document.querySelector('#common-chords')!;
  for (const note of pitchNames) {
    for (const quality of ['', 'm', '7', 'maj7', 'm7', 'sus4', 'dim']) {
      const option = document.createElement('option');
      option.value = note + quality;
      choices.append(option);
    }
  }
  return {
    setMode,
    position() { return visual ? cursor : source.selectionStart; },
    lineStart() {
      if (!visual) return source.value.lastIndexOf('\n', source.selectionStart - 1) + 1;
      return source.value.split('\n').slice(0, activeLine).reduce((sum, line) => sum + line.length + 1, 0);
    },
    isVisual: () => visual,
  };
}

const takeLabels = { title: 'عنوان', url: 'پیوند فایل یا اجرا', kind: 'نوع', recorded: 'تاریخ', instrument: 'ساز', notes: 'یادداشت', visibility: 'دسترسی' };
export function addTake(container: HTMLElement, take?: Take) {
  if (container.children.length >= 20) return;
  const row = document.createElement('fieldset');
  row.className = 'fields take-row';
  if (take?.id) row.dataset.takeId = take.id;
  for (const [name, text] of Object.entries(takeLabels)) {
    const label = document.createElement('label');
    label.textContent = text;
    const options = name === 'kind' ? [['video', 'ویدیو'], ['audio', 'صدا']] :
      name === 'visibility' ? [['public', 'عمومی'], ['private', 'خصوصی']] : [];
    const field = options.length ? document.createElement('select') : document.createElement('input');
    if (field instanceof HTMLSelectElement) {
      for (const [value, label] of options) field.add(new Option(label, value));
    } else {
      field.type = name === 'recorded' ? 'date' : 'text';
      field.maxLength = 2048;
    }
    field.dataset.take = name;
    if (take) field.value = String(take[name as keyof Take] ?? '');
    label.append(field);
    row.append(label);
  }
  const file = document.createElement('input');
  file.type = 'file';
  file.accept = '.mp3,.wav,.ogg,.webm,.mp4,.m4a';
  file.setAttribute('aria-label', 'بارگذاری اجرای ضبط‌شده');
  const progress = document.createElement('span');
  progress.setAttribute('role', 'status');
  file.addEventListener('change', () => {
    const selected = file.files?.[0];
    if (!selected) return;
    if (selected.size > 32 * 1024 * 1024) {
      progress.textContent = 'حجم فایل حداکثر ۳۲ مگابایت است.';
      return;
    }
    const request = new XMLHttpRequest();
    request.open('POST', '/api/owner/upload');
    const types: Record<string, string> = { mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', webm: 'video/webm', mp4: 'video/mp4', m4a: 'audio/mp4' };
    request.setRequestHeader('Content-Type', types[selected.name.split('.').at(-1)?.toLowerCase() ?? ''] || 'application/octet-stream');
    file.disabled = true;
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) progress.textContent = Math.round(event.loaded * 100 / event.total) + '٪';
    };
    request.onload = () => {
      let result;
      try { result = JSON.parse(request.responseText); } catch { /* Proxy errors may be HTML. */ }
      if (request.status === 201 && result?.url) {
        row.querySelector<HTMLInputElement>('[data-take=url]')!.value = result.url;
        row.querySelector<HTMLSelectElement>('[data-take=kind]')!.value = result.kind;
        progress.textContent = 'بارگذاری شد. برای ثبت، قطعه را ذخیره کن.';
        row.dispatchEvent(new Event('input', { bubbles: true }));
      } else progress.textContent = result?.error || 'بارگذاری انجام نشد.';
    };
    request.onerror = () => { progress.textContent = 'ارتباط هنگام بارگذاری قطع شد.'; };
    request.onloadend = () => { file.disabled = false; };
    request.send(selected);
  });
  row.append(file, progress);
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'quiet';
  remove.textContent = 'برداشتن اجرا';
  remove.addEventListener('click', () => {
    row.remove();
    container.dispatchEvent(new Event('input', { bubbles: true }));
  });
  row.append(remove);
  container.append(row);
}
