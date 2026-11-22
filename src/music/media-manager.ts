import type { Take } from './demo';

const takeLabels = { title: 'عنوان', url: 'پیوند فایل یا اجرا', kind: 'نوع', recorded: 'تاریخ', instrument: 'ساز', notes: 'یادداشت', visibility: 'دسترسی' };
export function addTake(container: HTMLElement, take?: Take) {
  if (container.children.length >= 20) return;
  const item = document.createElement('details');
  item.className = 'recording-item';
  if (take?.id) item.dataset.takeId = take.id;
  item.open = !take;
  const summary = document.createElement('summary');
  const row = document.createElement('div');
  row.className = 'fields take-row';
  item.append(summary, row);
  function updateSummary() {
    const value = (name: string) => row.querySelector<HTMLInputElement>('[data-take=' + name + ']')?.value;
    summary.textContent = [value('title') || 'اجرای تازه', value('kind') === 'audio' ? 'صوت' : 'ویدیو', value('recorded'), value('visibility') === 'private' ? 'خصوصی' : 'عمومی'].filter(Boolean).join(' · ');
  }
  item.addEventListener('input', updateSummary);
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
    item.remove();
    container.dispatchEvent(new Event('input', { bubbles: true }));
  });
  row.append(remove);
  updateSummary();
  container.append(item);
}
