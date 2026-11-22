const reserved = new Set(['api', 'admin', 'music', 'music-admin', 'fonts', 'brand', '_astro', 'favicon.svg', 'demo']);

export function normalizeSlug(value) {
  if (typeof value !== 'string') return '';
  return value.normalize('NFKC').replace(/[يى]/g, 'ی').replace(/ك/g, 'ک')
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632))
    .trim().toLowerCase().replace(/\s+/gu, '-').replace(/-+/g, '-');
}

export function validSlug(value) {
  return value.length > 0 && value.length <= 100 && !reserved.has(value) &&
    /^[\p{L}\p{M}\p{N}\u200c]+(?:-[\p{L}\p{M}\p{N}\u200c]+)*$/u.test(value);
}
