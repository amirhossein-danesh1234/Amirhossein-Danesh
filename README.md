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

`scripts/deploy.ps1` builds `dist/`, uploads a timestamped archive through the `VPN` SSH alias, and switches the server's atomic release symlink. Production serves static files through Nginx on origin HTTP port 80; ArvanCloud handles public HTTPS. Xray remains on TCP 443.

## Future path

The UI consumes structured data from `src/data/`, so those sources can later be replaced by a CMS, Notion, Supabase, API, or database without coupling content to page markup.
