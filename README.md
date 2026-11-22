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

On a new server, provision a root-owned `/etc/hamnava/production.env` with permissions 600 containing `HAMNAVA_OWNER_KEY`. Generate a 32-byte base64url key without padding and share it privately with the owner. The deployment script installs the versioned service and vhost, activates the release, and checks both hosts on the origin. Configure the music hostname in the CDN to serve HTTPS at the edge and use HTTP to the origin.

In «مدیریت قطعه‌ها», enter the owner key to create pieces, choose which appear in the public list, and add performance-video links. Anyone with the view link can open the piece. The separate edit link grants access to the score only. Store a backup of the SQLite database with SQLite's online backup command. Changing the owner key also invalidates previous edit links.

## Future path

The UI consumes structured data from `src/data/`, so those sources can later be replaced by a CMS, Notion, Supabase, API, or database without coupling content to page markup.
