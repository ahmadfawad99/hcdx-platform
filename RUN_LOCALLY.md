# Run HCDX Platform locally — verified working

This build has been test-run: server starts, pages render, and the
capture → store → publish API flow works.

## Steps (about 5 minutes — needs a free Supabase project)

1. Make sure Node.js 18+ is installed:  `node --version`
2. Create a free project at supabase.com (or use an existing one), then in
   its SQL editor run `supabase/migrations/0001_create_projects.sql`.
3. Copy `.env.example` to `.env.local` and fill in `SUPABASE_URL` and
   `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API in the Supabase dashboard).
4. Unzip this folder, then in a terminal:

   ```
   cd hcdx-platform
   npm install
   npm run dev
   ```

5. Open your browser to  http://localhost:3000
6. Log in:  admin@hcdx.com  /  demo1234
7. Paste a URL, click "Capture page", then edit inline and Publish.

## Notes

- Capture tries a headless Chromium render first (`puppeteer-core` +
  `@sparticuz/chromium`), and automatically falls back to plain `fetch()` if
  the browser can't launch. Some sites block non-browser requests (403) or
  need JS to render — those need the headless path to capture correctly.
- Captured pages are stored in Supabase (table `projects`), not the local
  filesystem — that's what lets published pages survive a serverless deploy.
  Without Supabase configured, capture/save/publish calls will fail with a
  clear "Supabase is not configured" error.
- For deploying to a public URL on Netlify, see README.md → "Deploying to Netlify".
