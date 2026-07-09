# HCDX Project — Full Context & Handoff Brief

> Paste this as your first message in Claude Code, or keep it in the repo root
> so any session (or teammate) is instantly oriented. It captures everything
> built so far and what's left to do.

---

## 1. What this project is

**Client:** Evan Katz (HCDX). HCDX builds high-quality HTML/Bootstrap website
prototypes for its own clients, then manages those sites as an ongoing service.

**The problem:** Once a prototype is delivered, any content change needs a
developer. WordPress and Webflow were rejected — they break the design and
overwhelm non-technical admins. HCDX wants a purpose-built inline editing system
they own outright (no SaaS fees), reusable across all their client sites.

**Delivery partner:** Clustox (that's us — Ahmad is Senior BA / Presales).

---

## 2. How the requirements evolved (important — read in order)

### Phase 1 — Original POC (DONE, validated by Evan)
A single representative page (the Central Maryland Chamber of Commerce homepage,
live at https://thehcdx.com/cmc/) rebuilt as an editable prototype:
- Append `?edit` to the URL → login modal → inline editing.
- Editable: text, images, cards, events (add/delete), stats, hero carousel
  (multi-slide, per-slide background color/image), CTAs.
- Save / Reset / Publish flow, persisted to browser localStorage.
- Built to visually match the real CMC site (verified via browser inspection:
  green accent #1B7A43, navy #0E2A47, pale-blue utility bar, mint event section,
  icon-badge help cards, etc.).

Evan approved the approach and asked us to focus the POC on CMC (not NSBC, whose
homepage has a complex "Explore Spaces" widget needing code-level work).

### Phase 2 — NEW requirement (the current build)
Evan changed the flow. Instead of editing one pre-built page, the system should:
1. Admin logs in.
2. Admin sees a screen with a URL input.
3. Admin enters ANY site URL → **system fetches that page and saves its HTML on
   the backend.**
4. The saved page loads into the editor and becomes **fully editable** (whole
   page auto-editable — not hand-defined regions).
5. Save / Reset / Publish — same flow as Phase 1, but now server-side.

**The new parts are: URL capture + storing HTML + auto-making-it-editable.**
Everything else (login, inline editing UX, save/publish) carries over from the
validated POC.

Decision made with Ahmad: the whole page should be **auto-editable generically**
(every text element becomes click-to-edit, every image click-to-replace), rather
than curated per-site regions — because the page can be any URL and its structure
isn't known in advance.

---

## 3. What has been BUILT (this is the current codebase)

A runnable **Next.js 14 (App Router)** app. Test-verified: server boots, pages
render (HTTP 200), and the capture → store → list API flow works against a live
request.

### File map
```
hcdx-platform/
├── lib/
│   ├── capture.js      ← CORE. Fetch a URL, absolutize assets, strip scripts,
│   │                     auto-tag every editable element (data-edit-id /
│   │                     data-edit-type). Falls back to fetch() if Puppeteer
│   │                     absent. THIS is the heart of the new requirement.
│   └── store.js        ← Persistence. File-based now, shaped like a DB table so
│                         swapping to Supabase is a per-method one-liner.
├── app/
│   ├── page.js         ← Login gate + URL-capture screen + project list.
│   ├── editor/page.js  ← Loads captured HTML in an iframe, injects a runtime
│   │                     that makes tagged elements editable, save/reset/publish.
│   ├── layout.js
│   ├── api/
│   │   ├── capture/route.js    ← POST {url} → captures, stores, returns project id
│   │   ├── projects/route.js   ← GET list / GET ?id= full project
│   │   └── publish/route.js    ← POST {id, action, html} save|reset|publish
│   └── published/[id]/route.js ← Serves the live published page
├── package.json        ← NOTE: puppeteer currently REMOVED (see §5)
├── next.config.js
├── jsconfig.json       ← @/* path alias
├── README.md           ← architecture + production notes
└── RUN_LOCALLY.md      ← quick run steps
```

### Login (demo): `admin@hcdx.com` / `demo1234`

### How the auto-editable tagging works (lib/capture.js)
- Walks the DOM. Tags text elements (h1–h6, p, span, a, button, li, etc.) with
  `data-edit-id` + `data-edit-type="text"`.
- Inline children (em, strong, a, span) fold into their parent, so
  `<h1>foo <em>bar</em></h1>` is ONE editable heading, not three. Nesting is
  prevented (an element inside an already-tagged text element is skipped).
- Empty / whitespace-only elements are skipped.
- Every `<img>` → `data-edit-type="image"` (click-to-replace).
- Inline `background-image` elements → `data-edit-type="background"`.
- All asset URLs (src, href, srcset, inline style url()) are absolutized so the
  stored copy is self-contained.
- `<script>` tags and on* handlers are stripped (captured page's JS must not run
  in the editor).
- This logic is UNIT-TESTED and passes all edge cases (mixed content, nesting,
  empty elements, deeply nested, inline-only headings).

---

## 4. What still needs DOING (the backlog)

In rough priority order:

1. **Make it deployable (Netlify or Vercel).** The app has server API routes, so
   it's NOT a static site. Two blockers on serverless hosts:
   - **Puppeteer/Chromium won't fit** in a serverless function (full Chromium
     ~300MB, over the size + timeout limits). Fix: swap `puppeteer` for
     `@sparticuz/chromium` + `puppeteer-core` (the slim serverless build).
   - **Filesystem storage doesn't persist** on serverless (ephemeral). Fix: wire
     up Supabase for storage (store.js is already shaped for this).
   - For Netlify specifically: add `netlify.toml` + the Next.js Netlify adapter.
     Vercel has smoother Next.js support if that's an option.

2. **Re-enable headless-browser capture.** Puppeteer was removed so `npm install`
   is fast/reliable locally. Re-add it (ideally the slim build from #1) so
   JS-rendered pages and sites that block plain fetch (e.g. the CMC site returns
   403 to non-browser requests) capture correctly.

3. **Supabase integration.** Auth (replace the demo login), project storage,
   captured-asset storage. store.js method → Supabase call mapping is in README.

4. **Asset handling at scale.** Currently assets are absolutized to the source
   URL (page depends on source staying online). For true self-containment,
   download assets into storage and rewrite to local paths.

5. **Editor polish.** The whole-page auto-editing may tag some structural/
   decorative elements. Consider a filter or an admin "lock element" control.

6. **Publish hardening.** Versioning/snapshots per publish (recommended for the
   managed-service model).

---

## 5. Known gotchas / decisions

- **Puppeteer is intentionally NOT in package.json right now.** Its Chromium
  download made `npm install` hang in restricted networks. The capture engine
  auto-falls-back to `fetch()`. Re-add Puppeteer (slim build) when doing the
  deploy work.
- **Cross-domain fetch must be server-side.** A browser can't fetch another
  domain's HTML (same-origin policy). That's why capture is an API route, not
  client-side. This also means the capture step can't be demoed in a pure static
  file — it needs the running backend.
- **Local dev is the best demo environment** right now — everything works with
  `npm install && npm run dev` → localhost:3000. Public deploy needs §4.1.
- **CMC site returns 403 to plain fetch** — needs the headless browser to capture.
  For local testing, point it at a simpler page or serve a sample locally.

---

## 6. Documents produced (for reference / sharing with Evan)
- POC User Guide & Feature Overview (how to use the Phase-1 prototype).
- Updated Architecture doc (explains the Phase-2 URL-capture flow, whole-page
  auto-editing, why capture is server-side, Supabase/Vercel stack, what changes
  vs the original).
- The Phase-1 editable prototype: `CMCPrototype.jsx` (React) and
  `CMCPrototype_local.html` (standalone, CDN React + Babel).

---

## 7. Recommended production stack (as pitched to Evan)
- **Front end:** Next.js + React (this codebase).
- **Capture service:** headless browser (Puppeteer / slim Chromium) server-side.
- **Auth + storage:** Supabase (free tier, no lock-in).
- **Hosting:** Vercel (or Netlify with the adapter).

---

## 8. First thing to ask Claude Code to do
Suggested opening task once it has this context and the code:

> "Make this project deployable to [Netlify/Vercel]: swap Puppeteer for the slim
>  serverless Chromium build, add the host config, and wire store.js to Supabase
>  so captured pages persist. Then give me the exact steps to deploy."
