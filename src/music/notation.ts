export const pitchNames = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
const naturalPitches: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const chordIntervals: Record<string, number[]> = {
  '': [0, 4, 7], m: [0, 3, 7], '5': [0, 7], '6': [0, 4, 7, 9], m6: [0, 3, 7, 9],
  '7': [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10],
  mMaj7: [0, 3, 7, 11], dim: [0, 3, 6], dim7: [0, 3, 6, 9], m7b5: [0, 3, 6, 10],
  aug: [0, 4, 8], sus2: [0, 2, 7], sus4: [0, 5, 7], '7sus4': [0, 5, 7, 10],
  add9: [0, 4, 7, 14], '9': [0, 4, 7, 10, 14], maj9: [0, 4, 7, 11, 14], m9: [0, 3, 7, 10, 14],
};

const modulo = (value: number) => ((value % 12) + 12) % 12;
const pitch = (name: string) => naturalPitches[name[0]] + ('#♯'.includes(name[1]) ? 1 : 'b♭'.includes(name[1]) ? -1 : 0);

export function chord(symbol: string, shift = 0) {
  const match = /^([A-G][#b♯♭]?)([^/]*)(?:\/([A-G][#b♯♭]?))?$/.exec(symbol);
  if (!Number.isInteger(shift) || !match || !Object.hasOwn(chordIntervals, match[2])) return null;
  const [, root, quality, bass] = match;
  const rootPitch = modulo(pitch(root) + shift);
  const label = (note: string) => shift === 0 ? note.replace('#', '♯').replace('b', '♭') : pitchNames[modulo(pitch(note) + shift)];
  let keys = chordIntervals[quality].map((interval) => rootPitch + interval);
  if (bass) {
    const bassPitch = modulo(pitch(bass) + shift);
    keys = [bassPitch, ...keys.filter((key) => modulo(key) !== bassPitch)
      .map((key) => key <= bassPitch ? key + 12 : key)];
  }
  return { label: label(root) + quality + (bass ? '/' + label(bass) : ''), keys };
}

export function noteSequence(source: string, shift: number) {
  return source.split(/(\s+)/).map((token) => {
    const match = /^([A-G][#b♯♭]?)(-?\d)?$/.exec(token);
    // Koron and sori require a separate tuning model. Preserve those tokens as authored.
    if (!match || !Number.isInteger(shift) || shift === 0) return token;
    const [, name, octave] = match;
    const position = pitch(name) + shift;
    return pitchNames[modulo(position)] + (octave === undefined ? '' : String(Number(octave) + Math.floor(position / 12)));
  }).join('');
}
