/** @param {string} input */
export function resolveVideo(input) {
  let url;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;

  const host = url.hostname.replace(/^www\./, '');
  if (['youtube.com', 'm.youtube.com', 'youtu.be', 'youtube-nocookie.com'].includes(host)) {
    const id = host === 'youtu.be'
      ? url.pathname.slice(1)
      : url.searchParams.get('v') ?? /^\/(?:embed|shorts|live)\/([^/]+)\/?$/.exec(url.pathname)?.[1];
    return id && /^[\w-]{11}$/.test(id)
      ? { kind: 'embed', src: 'https://www.youtube-nocookie.com/embed/' + id }
      : null;
  }
  if (host === 'aparat.com') {
    const id = /^\/v\/([a-zA-Z0-9]+)\/?$/.exec(url.pathname)?.[1]
      ?? /^\/video\/video\/embed\/videohash\/([a-zA-Z0-9]+)\/vt\/frame\/?$/.exec(url.pathname)?.[1];
    return id ? { kind: 'embed', src: 'https://www.aparat.com/video/video/embed/videohash/' + id + '/vt/frame' } : null;
  }
  return /\.(mp4|webm)$/i.test(url.pathname) ? { kind: 'video', src: url.href } : null;
}
