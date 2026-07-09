/**
 * lib/capture.js
 * ----------------------------------------------------------------------------
 * The heart of the new requirement.
 *
 * Given a URL, this module:
 *   1. FETCH    — loads the page in a headless browser so JS-rendered pages
 *                 are fully painted before capture.
 *   2. EXTRACT  — pulls the rendered HTML and rewrites asset URLs to absolute
 *                 form so the stored copy is self-contained and doesn't depend
 *                 on the source site staying online.
 *   3. ANNOTATE — walks the DOM and tags every text/image element with a
 *                 stable data-edit-id, so the editor can make the WHOLE page
 *                 editable generically without hand-defining regions.
 *
 * Puppeteer is optional at runtime: if it isn't installed (or can't launch in
 * a constrained environment), we fall back to a plain server-side fetch, which
 * still works for the many pages that render their content server-side.
 * ----------------------------------------------------------------------------
 */

const cheerio = require("cheerio");

// Elements whose text content is meaningful to edit.
const EDITABLE_TEXT_TAGS = new Set([
  "h1", "h2", "h3", "h4", "h5", "h6",
  "p", "span", "a", "button", "li",
  "blockquote", "figcaption", "label", "strong", "em", "small",
  "td", "th", "dt", "dd", "summary",
]);

// Tags we never descend into for text (their text is structural / code).
const SKIP_TAGS = new Set([
  "script", "style", "noscript", "svg", "canvas",
  "iframe", "template", "head", "meta", "link", "title",
]);

/**
 * Resolve a possibly-relative URL against the page's base URL.
 */
function absolutize(rawUrl, baseUrl) {
  if (!rawUrl) return rawUrl;
  const trimmed = rawUrl.trim();
  if (
    trimmed.startsWith("data:") ||
    trimmed.startsWith("mailto:") ||
    trimmed.startsWith("tel:") ||
    trimmed.startsWith("#") ||
    trimmed.startsWith("javascript:")
  ) {
    return trimmed;
  }
  try {
    return new URL(trimmed, baseUrl).href;
  } catch {
    return trimmed;
  }
}

/**
 * Rewrite every asset reference (src, href, srcset, inline style url())
 * to an absolute URL so the captured page renders standalone.
 */
function absolutizeAssets($, baseUrl) {
  $("[src]").each((_, el) => {
    const $el = $(el);
    $el.attr("src", absolutize($el.attr("src"), baseUrl));
  });

  // Only stylesheet / icon hrefs — leave anchor hrefs alone (handled below).
  $("link[href]").each((_, el) => {
    const $el = $(el);
    $el.attr("href", absolutize($el.attr("href"), baseUrl));
  });

  $("[srcset]").each((_, el) => {
    const $el = $(el);
    const rewritten = ($el.attr("srcset") || "")
      .split(",")
      .map((part) => {
        const [u, descriptor] = part.trim().split(/\s+/, 2);
        const abs = absolutize(u, baseUrl);
        return descriptor ? `${abs} ${descriptor}` : abs;
      })
      .join(", ");
    $el.attr("srcset", rewritten);
  });

  // Inline style background-image url(...)
  $("[style]").each((_, el) => {
    const $el = $(el);
    const style = $el.attr("style") || "";
    if (style.includes("url(")) {
      const rewritten = style.replace(
        /url\((['"]?)([^'")]+)\1\)/g,
        (_m, quote, u) => `url(${quote}${absolutize(u, baseUrl)}${quote})`
      );
      $el.attr("style", rewritten);
    }
  });

  // Anchor hrefs → absolute, but neutralize navigation inside the editor.
  $("a[href]").each((_, el) => {
    const $el = $(el);
    $el.attr("href", absolutize($el.attr("href"), baseUrl));
  });

  return $;
}

// Inline elements that can sit inside an editable text block without making
// that block a "container" — e.g. <h1>foo <em>bar</em></h1> is still one edit.
const INLINE_TEXT_TAGS = new Set([
  "a", "span", "strong", "em", "small", "b", "i", "u", "sub", "sup", "br", "mark", "code",
]);

/**
 * Walk the DOM and tag editable elements with a stable data-edit-id.
 * This is what enables "whole page auto-editable" without per-site config.
 */
function annotateEditable($) {
  let counter = 0;
  const editableMap = {};

  // --- Text elements -------------------------------------------------------
  $("*").each((_, el) => {
    const tag = (el.tagName || "").toLowerCase();
    if (SKIP_TAGS.has(tag)) return;
    if (!EDITABLE_TEXT_TAGS.has(tag)) return;

    const $el = $(el);

    // Skip if an ancestor is already tagged as editable text — prevents an
    // inline <a>/<span> inside an already-editable <h1> from being tagged
    // again (which would create nested contenteditable regions).
    if ($el.parents("[data-edit-type='text']").length > 0) return;

    // Meaningful direct text (ignoring inline children's text).
    const directText = $el
      .contents()
      .filter((_, node) => node.type === "text")
      .text()
      .trim();

    // Does this element contain a BLOCK-level editable child? If so, it's a
    // structural container — let the child be edited, not the wrapper. Inline
    // children (em, strong, a, span…) do NOT count, so "<h1>foo <em>bar</em>"
    // is still tagged as one editable heading.
    const hasBlockEditableChild =
      $el.children().filter((_, c) => {
        const ct = (c.tagName || "").toLowerCase();
        return EDITABLE_TEXT_TAGS.has(ct) && !INLINE_TEXT_TAGS.has(ct);
      }).length > 0;

    // Total visible text (including inline children) — used so a heading that
    // is ONLY "<h1><em>bar</em></h1>" (no direct text) still gets tagged.
    const totalText = $el.text().trim();
    const onlyInlineChildren =
      $el.children().filter((_, c) =>
        !INLINE_TEXT_TAGS.has((c.tagName || "").toLowerCase())
      ).length === 0;

    const shouldTag =
      !hasBlockEditableChild &&
      totalText.length > 0 &&
      (directText.length > 0 || onlyInlineChildren);

    if (shouldTag) {
      const id = `edit-${counter++}`;
      $el.attr("data-edit-id", id);
      $el.attr("data-edit-type", "text");
      editableMap[id] = { type: "text", tag };
    }
  });

  // --- Images --------------------------------------------------------------
  $("img").each((_, el) => {
    const $el = $(el);
    const id = `edit-${counter++}`;
    $el.attr("data-edit-id", id);
    $el.attr("data-edit-type", "image");
    editableMap[id] = { type: "image", tag: "img" };
  });

  // --- Background images (inline style only; class-based handled at runtime)
  $("[style*='background']").each((_, el) => {
    const $el = $(el);
    if (($el.attr("style") || "").includes("url(")) {
      const id = `edit-${counter++}`;
      $el.attr("data-edit-id", id);
      $el.attr("data-edit-type", "background");
      editableMap[id] = { type: "background", tag: (el.tagName || "div").toLowerCase() };
    }
  });

  return { editableCount: counter, editableMap };
}

/**
 * Strip things that would break or interfere inside the editor:
 *  - <script> tags (we don't want the captured page's JS running in the editor)
 *  - event-handler attributes
 * CSS and images are preserved so the page still looks identical.
 */
function sanitizeForEditor($) {
  $("script").remove();
  $("*").each((_, el) => {
    const attribs = el.attribs || {};
    Object.keys(attribs).forEach((name) => {
      if (/^on/i.test(name)) $(el).removeAttr(name);
    });
  });
  return $;
}

/**
 * Launch a headless browser for the current environment.
 *
 * - On Netlify/serverless, @sparticuz/chromium ships a slim Chromium binary
 *   sized to fit a function bundle, driven by puppeteer-core (no bundled
 *   browser download at install time).
 * - In local dev, @sparticuz/chromium can still launch, but if it's not
 *   installed at all, this throws and loadHtml() falls back to fetch().
 */
async function launchBrowser() {
  const chromium = require("@sparticuz/chromium");
  const puppeteer = require("puppeteer-core");
  return puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  });
}

/**
 * Try to render with a headless browser; fall back to fetch() if unavailable.
 * Returns { html, mode } where mode is "headless" or "fetch".
 */
async function loadHtml(url) {
  // Attempt headless-browser render first (handles JS-heavy pages).
  try {
    const browser = await launchBrowser();
    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1440, height: 900 });
      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
      const html = await page.content();
      return { html, mode: "headless" };
    } finally {
      await browser.close();
    }
  } catch (err) {
    // Headless browser unavailable or failed to launch — fall back.
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; HCDXCapture/1.0; +https://thehcdx.com)",
      },
    });
    if (!res.ok) {
      throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
    }
    const html = await res.text();
    return { html, mode: "fetch" };
  }
}

/**
 * Main entry point. Capture a URL into a self-contained, editable document.
 */
async function capturePage(url) {
  // Validate URL up front with a clear error.
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("That doesn't look like a valid URL. Include https://");
  }
  if (!/^https?:$/.test(parsed.protocol)) {
    throw new Error("Only http and https URLs can be captured.");
  }

  const { html, mode } = await loadHtml(url);

  const $ = cheerio.load(html, { decodeEntities: false });

  absolutizeAssets($, parsed.href);
  sanitizeForEditor($);
  const { editableCount, editableMap } = annotateEditable($);

  // Inject a <base> so any remaining relative refs resolve to the source.
  if ($("base").length === 0) {
    $("head").prepend(`<base href="${parsed.href}">`);
  }

  return {
    sourceUrl: parsed.href,
    capturedAt: new Date().toISOString(),
    captureMode: mode, // "headless" | "fetch"
    editableCount,
    editableMap,
    html: $.html(),
  };
}

module.exports = { capturePage, absolutize, annotateEditable };
