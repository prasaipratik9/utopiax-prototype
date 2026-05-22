# UtopiaX - Trimester Prototype

Static site with **UI kit styling** (Primary `#5811FB`, Secondary `#00F0FF`, Tertiary `#FF4D80`, Neutral `#0F172A`, fonts **Space Grotesk** + **Inter**) and a built-in **admin CMS** so Christina (or other admins) can edit content without a developer.

## Quick start

```bash
cd utopiax-prototype
npm start
```

Open:

- **Website:** http://localhost:3000
- **Admin CMS:** http://localhost:3000/admin/
- **Live host:** https://utopiax-prototype-production.up.railway.app/index.html

Default login (change in `config.json`):

- **Username:** `admin`
- **Password:** `utopiax-admin`

## Admin CMS

1. Sign in at `/admin/`
2. Edit sections in the sidebar (homepage, pages, Xperiences, media, team, contact info)
3. Click **Save changes** - updates `content.json` immediately on the live site

No code edits needed for everyday content updates.

## Pages

| URL                  | Description                |
| -------------------- | -------------------------- |
| `/`                  | Homepage                   |
| `/openmindx.html`    | Speaking                   |
| `/ideationworx.html` | Ideation & design thinking |
| `/lumierex.html`     | Retreats                   |
| `/xperiences.html`   | Programs (paginated)       |
| `/media.html`        | Blog / media (filterable)  |
| `/about.html`        | About, founder, team       |
| `/contact.html`      | Contact form               |

## Project structure

```
content.json      ← all editable copy (CMS writes here)
config.json       ← admin username/password
server.js         ← static files + API
admin/            ← login + dashboard (no shared site header/footer)
css/styles.css    ← public UI kit
css/admin.css     ← admin UI
js/layout.js      ← universal header & footer (all public pages)
js/content-store.js
js/main.js        ← page-specific content
js/admin.js
```

Public pages use `data-public-site` on `<body>` and load `layout.js` for a consistent navbar and footer. Edit nav labels in the CMS or `content.json` → `nav` array.

## Security notes (trimester / demo)

- Change `config.json` before any real deployment
- Use HTTPS and stronger auth for production
- Contact form is client-side only (no email backend in this prototype)

## Live Server (VS Code port 5500)

You can preview with Live Server. Pages load from `content.json` automatically. The admin CMS also works: sign in at `/admin/` with the credentials in `config.json` (default **admin** / **utopiax-admin**). Saves are stored in the browser until you run `npm start`, which writes to `content.json` on disk.

## Without any server

Opening HTML files directly (`file://`) may block `fetch` for `content.json`. Prefer Live Server or `npm start`.
