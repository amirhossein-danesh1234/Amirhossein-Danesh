export function bindPerformance() {
  const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const perform = byId<HTMLButtonElement>('perform');
  const auto = byId<HTMLButtonElement>('auto-scroll');
  const tempo = byId<HTMLInputElement>('metronome-bpm');
  const metronome = byId<HTMLButtonElement>('metronome');
  const speed = byId<HTMLInputElement>('scroll-speed');
  const sheet = byId('score');
  const settings = byId('performance-settings');
  const trigger = byId<HTMLButtonElement>('settings-trigger');
  function toggleSettings(open: boolean) {
    settings.hidden = !open;
    trigger.setAttribute('aria-expanded', String(open));
  }
  trigger.addEventListener('click', () => toggleSettings(settings.hidden));
  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || settings.hidden) return;
    event.preventDefault();
    toggleSettings(false);
    trigger.focus();
  });
  let playing = false;
  let last = 0;
  let position = 0;
  let frame = 0;
  let clock = 0;
  let audio: AudioContext | undefined;
  let beat = 0;

  function size(id: string, property: string) {
    const control = byId<HTMLInputElement>(id);
    control.addEventListener('input', () => sheet.style.setProperty(property, String(Number(control.value) / 100)));
  }
  size('lyric-size', '--lyric-scale');
  size('chord-size', '--chord-scale');
  try {
    const saved = Number(localStorage.getItem('hamnava-scroll-speed'));
    if (saved >= Number(speed.min) && saved <= Number(speed.max)) speed.value = String(saved);
  } catch { /* Storage can be disabled. */ }
  speed.addEventListener('input', () => {
    try { localStorage.setItem('hamnava-scroll-speed', speed.value); } catch { /* Optional preference. */ }
  });

  function scroll(time: number) {
    if (last) position += Math.min(time - last, 50) * Number(speed.value) / 1000;
    last = time;
    window.scrollTo(0, position);
    if (position >= document.documentElement.scrollHeight - innerHeight) {
      toggleScroll(false);
      return;
    }
    frame = requestAnimationFrame(scroll);
  }
  function toggleScroll(value: boolean) {
    playing = value;
    auto.setAttribute('aria-pressed', String(value));
    auto.textContent = value ? 'مکث پیمایش' : 'پیمایش خودکار';
    cancelAnimationFrame(frame);
    if (value) {
      last = 0;
      position = window.scrollY;
      frame = requestAnimationFrame(scroll);
    }
  }
  auto.addEventListener('click', () => toggleScroll(!playing));
  window.addEventListener('wheel', () => { if (playing) toggleScroll(false); }, { passive: true });
  window.addEventListener('touchstart', (event) => {
    if (playing && !(event.target as HTMLElement).closest('button,input,select')) toggleScroll(false);
  }, { passive: true });

  function tick() {
    if (!audio) return;
    const bpm = Math.min(300, Math.max(20, Number(tempo.value) || 90));
    const oscillation = audio.createOscillator();
    const envelope = audio.createGain();
    oscillation.frequency.value = beat++ % 4 === 0 ? 960 : 650;
    oscillation.connect(envelope).connect(audio.destination);
    envelope.gain.setValueAtTime(0.12, audio.currentTime);
    envelope.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.07);
    oscillation.start();
    oscillation.stop(audio.currentTime + 0.08);
    clock = window.setTimeout(tick, 60_000 / bpm);
  }
  metronome.addEventListener('click', async () => {
    const enabled = metronome.getAttribute('aria-pressed') !== 'true';
    metronome.setAttribute('aria-pressed', String(enabled));
    clearTimeout(clock);
    if (!enabled) return;
    try {
      audio ??= new AudioContext();
      await audio.resume();
      if (metronome.getAttribute('aria-pressed') === 'true') {
        beat = 0;
        tick();
      }
    } catch { metronome.setAttribute('aria-pressed', 'false'); }
  });

  function enter(value: boolean) {
    toggleSettings(false);
    document.body.classList.toggle('performance', value);
    perform.setAttribute('aria-pressed', String(value));
    perform.textContent = value ? 'پایان اجرا' : 'حالت اجرا';
    if (value) byId('piece').scrollIntoView();
    else {
      toggleScroll(false);
      clearTimeout(clock);
      metronome.setAttribute('aria-pressed', 'false');
    }
  }
  perform.addEventListener('click', () => enter(!document.body.classList.contains('performance')));
  window.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || !document.body.classList.contains('performance') || event.altKey || event.ctrlKey || event.metaKey ||
        (event.key !== 'Escape' && (event.target as HTMLElement).closest('button,input,textarea,select,[contenteditable]'))) return;
    if (event.key === 'Escape') enter(false);
    if (event.code === 'Space') { event.preventDefault(); toggleScroll(!playing); }
    if (event.key.toLowerCase() === 'm') metronome.click();
  });
}
