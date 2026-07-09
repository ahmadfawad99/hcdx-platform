# HCDX Platform — URL Capture & Inline Editing

A Next.js implementation of the updated HCDX requirement: an admin logs in, pastes
the URL of any live page, and the system **captures** that page, stores a copy,
and makes the **whole page editable** inline. Edits can be saved, reset, and
published — the same edit flow validated in the original CMC POC.

---

## The flow

```
Login  →  Paste URL  →  [server captures page]  →  Edit inline  →  Save / Publish
                              │
                              ├─ 1. FETCH    render the URL (headless browser)
                              ├─ 2. EXTRACT  absolutize assets, strip scripts
                              ├─ 3. STORE    save a self-contained copy
                              └─ 4. ANNOTATE tag every text/image element editable
```

Steps map to files:

| Step | File |
|------|------|
| Capture engine (fetch + absolutize + annotate) | `lib/capture.js` |
| Persistence (projects, drafts, published) | `lib/store.js` |
| Capture endpoint | `app/api/capture/route.js` |
| List / load projects | `app/api/projects/route.js` |
| Save / reset / publish | `app/api/publish/route.js` |
| Serve published page | `app/published/[id]/route.js` |
| Login + URL capture + project list | `app/page.js` |
| The inline editor | `app/editor/page.js` |

---

## Running it

```bash
cp .env.example .env.local   # fill in your Supabase URL + service role key
npm install                  # installs Next, React, cheerio, puppeteer-core, @sparticuz/chromium, supabase-js
npm run dev                  # http://localhost:3000
```

Login: `admin@hcdx.com` / `demo1234`

> **Headless capture note:** the capture engine drives Chromium via
> `puppeteer-core` + `@sparticuz/chromium` (the slim, serverless-sized build —
> see "Deploying to Netlify" below). If it can't launch (e.g. missing system
> deps locally), the capture engine **automatically falls back to a plain
> `fetch()`**, which works for server-rendered pages. No code change needed.

> **Supabase is required, including for local dev.** Storage moved off the
> filesystem (serverless hosts don't persist it — see "What's proven" below),
> so `lib/store.js` now talks to Supabase. Run the migration in
> `supabase/migrations/0001_create_projects.sql` against your project, then
> set `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.

---

## How "whole page auto-editable" works

The original POC hand-defined editable regions for the CMC homepage. That can't
work for an arbitrary URL, so `annotateEditable()` in `lib/capture.js` walks the
captured DOM and tags elements generically:

- **Text** — headings, paragraphs, list items, links, buttons, etc. get a
  `data-edit-id` and become click-to-edit. Inline children (`<em>`, `<a>`,
  `<strong>`) are folded into their parent so `<h1>foo <em>bar</em></h1>` is one
  editable heading, not three. Nested tagging is prevented.
- **Images** — every `<img>` becomes click-to-replace.
- **Backgrounds** — inline `background-image` elements become click-to-replace.

The editor (`app/editor/page.js`) loads the captured HTML into an `<iframe>` and
injects a small runtime that activates those tags: hovering highlights, clicking
text edits in place, clicking an image opens a file picker. Changes post back to
the parent, which saves them via `/api/publish`.

---

## Production notes (Supabase)

`lib/store.js` talks to Supabase (Postgres) via `@supabase/supabase-js`,
using the service-role key from server-side API routes only:

| store.js method | Supabase call |
|-----------------|---------------------|
| `createProject` | `insert into projects` |
| `getProject` | `select … where id =` |
| `listProjects` | `select … order by updated_at` |
| `saveDraft` | `update projects set draft_html` |
| `resetDraft` | `update projects set draft_html = original_html` |
| `publishProject` | `update projects set published_html, draft_html, status` |

Schema: `supabase/migrations/0001_create_projects.sql`. RLS is enabled with no
policies, since only the trusted server (service-role key) reads/writes.

Captured assets (images/fonts) still point at the source URL (see backlog
item 4 in CONTEXT.md) — moving them into Supabase Storage is the next step
for true self-containment.

---

## Deploying to Netlify

1. Push this repo to GitHub/GitLab/Bitbucket and connect it in the Netlify UI
   (or `netlify init` via the CLI), or run `netlify deploy` directly.
2. `netlify.toml` already configures the build (`npm run build`, `@netlify/plugin-nextjs`)
   and gives the server handler function extra memory/timeout for headless
   capture (`@sparticuz/chromium`'s binary is large and page rendering is slow).
3. In Site settings → Environment variables, set `SUPABASE_URL` and
   `SUPABASE_SERVICE_ROLE_KEY` (same values as `.env.local`).
4. Run `supabase/migrations/0001_create_projects.sql` against your Supabase
   project (SQL editor, or `supabase db push`) before the first deploy.
5. Deploy. Netlify Functions have a hard execution ceiling (26s on most
   plans) — if headless capture times out on heavy pages, the plain-`fetch()`
   fallback still gets you a working page for server-rendered sites.

---

## What's proven vs. what needs real credentials

- **Proven here:** the capture transform (absolutize + strip + annotate),
  the Supabase-backed storage interface, all API routes, the
  login/capture/editor/publish UI, the Netlify build config.
- **Needs your Supabase project:** `lib/store.js` throws a clear error until
  `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are set — there's no filesystem
  fallback anymore, since that's exactly what doesn't survive serverless.
- **Needs a real server/deploy for capture:** the live cross-domain fetch.
  Browsers block it (same-origin policy); the server does not. That's why
  capture is an API route, not client-side.
