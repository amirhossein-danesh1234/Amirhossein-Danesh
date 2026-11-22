# AmirHossein Danesh

Static personal website built with Astro, TypeScript, and plain CSS.

## Local development

```bash
npm install
npm run dev
```

Build and validate with `npm run check` and `npm run build`. The generated static site is written to `dist/`.

## Structure

- `src/components/` — reusable UI pieces
- `src/layouts/` — shared page layout and metadata
- `src/pages/` — static routes
- `src/data/` — editable profile, NOW, project, work, academic, and skills content
- `src/styles/` — global design tokens and responsive CSS
- `public/` — static assets

## Updating content

Edit `src/data/profile.ts` for identity and links, `src/data/now.ts` for the frequently changing NOW section, `src/data/projects.ts` for projects, `src/data/work.ts` for experience, `src/data/academic.ts` for university content, and `src/data/skills.ts` for capability groups. Replace the profile image inside `public/` and update its path in `profile.ts`.

## Deployment

`scripts/deploy.ps1` verifies that the clean local commit matches GitHub main, builds `dist/`, uploads a timestamped archive through the `amirhossein-danesh` SSH alias, and switches the server's atomic release symlink. Each release records its Git SHA in `REVISION`. Production serves static files through Nginx on origin HTTP port 80; ArvanCloud handles public HTTPS. The `app` subdomain redirects to the main site. Pass `-SshAlias` to use another explicitly configured host.

## Hamnava music notebook

https://music.amirhossein-danesh.ir uses the same release as the profile, with a dedicated Nginx virtual host. The Astro page is served from `dist/music/index.html`. A loopback Node 22.18+ service on port 3102 stores pieces in `/var/lib/hamnava/pieces.sqlite`. The release replaces code and leaves the service's persistent state directory intact.

On a new server, provision a root-owned `/etc/hamnava/production.env` with permissions 600 containing `HAMNAVA_OWNER_KEY`. Generate the 32-byte base64url key without padding and keep it stable to preserve guest links. Provision `HAMNAVA_ADMIN_USERNAME` and `HAMNAVA_ADMIN_PASSWORD_HASH` separately. The verifier is `salt:digest` in lowercase hex, using a random 16-byte salt and a 32-byte scrypt digest with N=32768, r=8, p=3. The deployment script installs the versioned service and vhost, activates the release, and checks both hosts on the origin. Configure the music and music-admin hostnames in the CDN to serve HTTPS at the edge and use HTTP to the origin.

At https://music-admin.amirhossein-danesh.ir/, sign in with the admin username and password to create pieces, choose which appear in the public list, and add performance-video links. Anyone with the view link can open the piece. The separate edit link grants access to the score only. Store a backup of the SQLite database with SQLite's online backup command. Changing the admin password verifier invalidates existing admin sessions. Changing the signing key also invalidates previous guest edit links.

## Future path

The UI consumes structured data from `src/data/`, so those sources can later be replaced by a CMS, Notion, Supabase, API, or database without coupling content to page markup.

### Hamnava upgrades and recordings

Run the browser acceptance checks from this repository with Node 24 and Chrome. Install Playwright in the local environment or set HAMNAVA_PLAYWRIGHT to its existing module directory, then run npm run build and node tests/hamnava.mjs. The test starts two loopback sites and a temporary SQLite database populated with an old-format song.

The service migrates SQLite in a transaction at startup. It assigns slugs to existing songs, preserves old IDs and editing links, maps published and unlisted songs from their original list setting, and copies existing video references into the recordings archive. Retain an SQLite online backup before the first deployment.

Deploy from the clean GitHub main revision with scripts/deploy.ps1. The activation script checks Nginx and restores the previous release on activation failure. Before manually rolling back to a pre-visibility release after the new version has accepted writes, take the service offline. Older code cannot enforce the new private and draft rules. Keep a backup of the current data and prefer a forward fix.

Uploads use the service state directory configured by HAMNAVA_MEDIA_DIR. The default deployment stores files under /var/lib/hamnava/media. Individual files are limited to 32 MiB and total stored media to 256 MiB. Include the media directory in backups. The public API serves uploaded files only when an accessible song links to them through a public recording. External media links follow the access rules of their source.

Practice history, the microphone tuner, structured scores and MusicXML, arrangements, and camera recording are future product work. Practice history can build on the piece and take IDs. A tuner needs explicit microphone access and calibration. Structured notation needs a duration and pitch model before adding import or export. Arrangements and capture can build on the recording archive. Current transposition uses twelve semitones. Koron and sori tokens are preserved as written.
