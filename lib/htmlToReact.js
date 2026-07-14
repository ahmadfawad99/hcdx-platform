/**
 * lib/htmlToReact.js
 * ----------------------------------------------------------------------------
 * HTML prototype  →  genuine React (JSX) source.
 *
 * This is the conversion tool at the center of the Phase-3 direction: take an
 * HCDX HTML prototype and emit a REAL React component — actual JSX elements,
 * `class` → `className`, inline styles as objects, void tags self-closed,
 * scripts and inline handlers dropped — not an HTML blob shoved through
 * dangerouslySetInnerHTML.
 *
 * As it walks, it also tags editable regions so the `?edit` runtime can make
 * the converted page editable without any per-site configuration:
 *   - text      headings, paragraphs, links, buttons, list items, cells …
 *   - image     <img>
 *   - icon      icon-font glyphs (<i class="bi …">, Font Awesome, etc.)
 *   - video     <iframe> embeds (YouTube/Vimeo/…) and <video>
 *   - background inline background-image
 * and marks repeating sibling groups (Bootstrap cards, member rows, event
 * lists) so items can be added / duplicated / removed.
 *
 * Exports:
 *   htmlToReact(html, opts) -> { jsx, headLinks, editableCount, listCount, byType }
 * ----------------------------------------------------------------------------
 */

const cheerio = require("cheerio");
const { absolutize } = require("./capture");

/**
 * Rewrite relative asset references (src, href, srcset, inline style url())
 * to absolute URLs against baseUrl — the same step the URL-capture path does
 * implicitly. Without this, pasted HTML with relative paths renders unstyled
 * and with broken images because the browser can't resolve them.
 */
function absolutizeAssets($, baseUrl) {
  $("[src]").each((_, el) => {
    const $el = $(el);
    $el.attr("src", absolutize($el.attr("src"), baseUrl));
  });
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
  $("[style]").each((_, el) => {
    const $el = $(el);
    const style = $el.attr("style") || "";
    if (style.includes("url(")) {
      $el.attr("style", style.replace(
        /url\((['"]?)([^'")]+)\1\)/g,
        (_m, q, u) => `url(${q}${absolutize(u, baseUrl)}${q})`
      ));
    }
  });
  $("a[href]").each((_, el) => {
    const $el = $(el);
    $el.attr("href", absolutize($el.attr("href"), baseUrl));
  });
  return $;
}

const VOID_ELEMENTS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr",
]);

// Tags whose content we never turn into editable text (structural / non-visual).
const SKIP_TEXT_TAGS = new Set([
  "script", "style", "noscript", "svg", "canvas", "iframe",
  "template", "head", "meta", "link", "title", "video", "audio",
]);

const EDITABLE_TEXT_TAGS = new Set([
  "h1", "h2", "h3", "h4", "h5", "h6",
  "p", "span", "a", "button", "li",
  "blockquote", "figcaption", "label", "strong", "em", "small",
  "td", "th", "dt", "dd", "summary",
]);

const INLINE_TEXT_TAGS = new Set([
  "a", "span", "strong", "em", "small", "b", "i", "u",
  "sub", "sup", "br", "mark", "code",
]);

// HTML attribute name -> JSX prop name. data-* and aria-* pass through as-is.
const ATTR_RENAME = {
  class: "className", for: "htmlFor", tabindex: "tabIndex",
  colspan: "colSpan", rowspan: "rowSpan", maxlength: "maxLength",
  minlength: "minLength", readonly: "readOnly", autocomplete: "autoComplete",
  autofocus: "autoFocus", crossorigin: "crossOrigin", srcset: "srcSet",
  enctype: "encType", novalidate: "noValidate", allowfullscreen: "allowFullScreen",
  frameborder: "frameBorder", marginwidth: "marginWidth", marginheight: "marginHeight",
  cellpadding: "cellPadding", cellspacing: "cellSpacing", usemap: "useMap",
  accesskey: "accessKey", contenteditable: "contentEditable", spellcheck: "spellCheck",
  srclang: "srcLang", referrerpolicy: "referrerPolicy", autoplay: "autoPlay",
};

const BOOLEAN_ATTRS = new Set([
  "disabled", "checked", "selected", "readonly", "required", "autofocus",
  "multiple", "controls", "loop", "muted", "autoplay", "hidden",
  "allowfullscreen", "novalidate", "default", "open", "reversed",
]);

const ICON_CLASS_RE = /(^|\s)(bi|fa|fas|far|fal|fab|fad|material-icons|material-symbols-outlined|glyphicon|icon)(-[\w-]+)?(\s|$)/;

function camelCaseStyleProp(prop) {
  prop = prop.trim();
  if (!prop) return prop;
  // Vendor prefixes: -webkit-x -> WebkitX ; -ms-x -> msX (React quirk: ms stays lowercase)
  if (prop.startsWith("-ms-")) prop = "ms-" + prop.slice(4);
  else if (prop.startsWith("-")) prop = prop.slice(1);
  return prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

function styleStringToObjectLiteral(style) {
  const parts = style
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  const pairs = [];
  for (const part of parts) {
    const idx = part.indexOf(":");
    if (idx === -1) continue;
    const prop = camelCaseStyleProp(part.slice(0, idx));
    const value = part.slice(idx + 1).trim();
    if (!prop) continue;
    pairs.push(`${JSON.stringify(prop)}: ${JSON.stringify(value)}`);
  }
  return pairs.length ? `{{ ${pairs.join(", ")} }}` : null;
}

function isIconEl(tag, className) {
  if (!className) return false;
  if (tag === "i" || tag === "span") return ICON_CLASS_RE.test(className);
  return false;
}

function isVideoEl(tag, attribs) {
  if (tag === "video") return true;
  if (tag === "iframe") {
    const src = (attribs.src || "").toLowerCase();
    return /youtube|youtu\.be|vimeo|player|embed|dailymotion|wistia/.test(src);
  }
  return false;
}

/**
 * Pre-pass: find repeating sibling groups and tag them so the editor can
 * add / duplicate / remove items. A group is 2+ consecutive element siblings
 * with the same tag + same class that contain some editable content.
 */
function markRepeatables($) {
  let listCounter = 0;
  $("*").each((_, parent) => {
    const $parent = $(parent);
    const children = $parent.children().toArray();
    if (children.length < 2) return;

    let i = 0;
    while (i < children.length) {
      const a = children[i];
      const key = (a.tagName || "") + "|" + ($(a).attr("class") || "");
      let j = i + 1;
      while (
        j < children.length &&
        (children[j].tagName || "") + "|" + ($(children[j]).attr("class") || "") === key
      ) {
        j++;
      }
      const groupSize = j - i;
      const hasText = key.split("|")[0] && $(a).text().trim().length > 0;
      if (groupSize >= 2 && hasText && !$parent.attr("data-edit-list")) {
        $parent.attr("data-edit-list", "list-" + listCounter++);
        for (let k = i; k < j; k++) $(children[k]).attr("data-edit-item", "");
      }
      i = j;
    }
  });
  return listCounter;
}

function escapeJsxText(text) {
  // Collapse runs of whitespace (incl. newlines) to single spaces.
  const collapsed = text.replace(/\s+/g, " ");
  if (!collapsed.trim()) {
    // Pure whitespace between elements: preserve a single space for inline flow.
    return collapsed.length ? '{" "}' : "";
  }
  // Keep a leading/trailing space if the original had one (inline spacing).
  const lead = /^\s/.test(text) ? " " : "";
  const trail = /\s$/.test(text) ? " " : "";
  const body = collapsed.trim();
  // JSX text can't contain < > { } literally — wrap those cases in an expr.
  if (/[<>{}]/.test(body)) {
    return `${lead ? '{" "}' : ""}{${JSON.stringify(body)}}${trail ? '{" "}' : ""}`;
  }
  return `${lead}${body}${trail}`;
}

function buildAttrs($el, el, editInfo) {
  const attribs = el.attribs || {};
  const out = [];

  for (const rawName of Object.keys(attribs)) {
    const lower = rawName.toLowerCase();
    if (/^on/.test(lower)) continue; // drop event handlers
    if (lower === "style") {
      const objLit = styleStringToObjectLiteral(attribs[rawName] || "");
      if (objLit) out.push(`style=${objLit}`);
      continue;
    }
    const name = ATTR_RENAME[lower] || rawName;
    const value = attribs[rawName];
    if (BOOLEAN_ATTRS.has(lower) && (value === "" || value === lower || value === "true")) {
      out.push(`${name}={true}`);
    } else if (value === "") {
      out.push(`${name}=""`);
    } else if (value.includes('"')) {
      out.push(`${name}={${JSON.stringify(value)}}`);
    } else {
      out.push(`${name}="${value}"`);
    }
  }

  // Editable tagging attributes appended so they survive into the artifact.
  if (editInfo) {
    out.push(`data-edit-id="${editInfo.id}"`);
    out.push(`data-edit-type="${editInfo.type}"`);
  }
  return out.length ? " " + out.join(" ") : "";
}

async function htmlToReact(html, opts = {}) {
  const componentName = opts.componentName || "CapturedPage";
  const $ = cheerio.load(html, { decodeEntities: false });

  // Idempotent: strip any prior edit tags so re-converting stored (already
  // tagged) HTML regenerates cleanly instead of double-tagging.
  $("[data-edit-id]").removeAttr("data-edit-id").removeAttr("data-edit-type");
  $("[data-edit-list]").removeAttr("data-edit-list");
  $("[data-edit-item]").removeAttr("data-edit-item");

  // If a source URL is known, resolve relative asset paths against it first —
  // this is what makes a pasted page render with its real CSS, images, and
  // fonts (matching the fidelity of the URL-capture path).
  let baseUrl = null;
  if (opts.baseUrl) {
    try { baseUrl = new URL(opts.baseUrl).href; } catch { baseUrl = null; }
  }
  if (baseUrl) {
    absolutizeAssets($, baseUrl);
    if ($("base").length === 0) $("head").prepend(`<base href="${baseUrl}">`);
  }

  // Collect stylesheet <link>s + font links from <head> so the render keeps styling.
  const headLinks = [];
  $("head link[rel='stylesheet'], head link[rel='preconnect'], head link[href*='fonts.googleapis']").each((_, el) => {
    const href = $(el).attr("href");
    if (href) headLinks.push(href);
  });

  // Body-only paste rescue: if we have a baseUrl but zero stylesheet links,
  // fetch the source page's <head> and inherit its CSS. Otherwise a pasted
  // fragment renders unstyled because Bootstrap/etc. never load.
  const hasStylesheet = $("head link[rel='stylesheet'], head style").length > 0;
  if (baseUrl && !hasStylesheet) {
    try {
      const res = await fetch(baseUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; HCDXConverter/1.0)" },
      });
      if (res.ok) {
        const sourceHtml = await res.text();
        const $source = cheerio.load(sourceHtml, { decodeEntities: false });
        const inherited = [];
        $source("head link[rel='stylesheet']").each((_, el) => {
          const href = $source(el).attr("href");
          if (!href) return;
          const abs = absolutize(href, baseUrl);
          $("head").append(`<link rel="stylesheet" href="${abs}">`);
          inherited.push(abs);
        });
        $source("head style").each((_, el) => {
          $("head").append(`<style>${$source(el).html() || ""}</style>`);
        });
        // Meta viewport rescues responsive layout for body-only pastes.
        const viewport = $source("head meta[name='viewport']").attr("content");
        if (viewport && !$("head meta[name='viewport']").length) {
          $("head").append(`<meta name="viewport" content="${viewport}">`);
        }
        headLinks.push(...inherited);
      }
    } catch (err) {
      // Non-fatal: preview will render unstyled, source URL might be down.
      console.warn("Style rescue fetch failed:", err.message);
    }
  }

  const listCount = markRepeatables($);

  let counter = 0;
  const byType = { text: 0, image: 0, icon: 0, video: 0, background: 0 };

  function nextEdit(type) {
    byType[type] = (byType[type] || 0) + 1;
    return { id: `edit-${counter++}`, type };
  }

  function classifyEditable($el, el) {
    const tag = (el.tagName || "").toLowerCase();
    const className = $el.attr("class") || "";
    const style = $el.attr("style") || "";

    if (tag === "img") return "image";
    if (isVideoEl(tag, el.attribs || {})) return "video";
    if (isIconEl(tag, className)) return "icon";
    if (style.includes("background") && /url\(/.test(style)) return "background";

    // Text — mirror the validated capture.js rules.
    if (EDITABLE_TEXT_TAGS.has(tag)) {
      if ($el.parents("[data-edit-type='text']").length > 0) return null;
      const totalText = $el.text().trim();
      if (!totalText) return null;
      const hasBlockEditableChild =
        $el.children().filter((_, c) => {
          const ct = (c.tagName || "").toLowerCase();
          return EDITABLE_TEXT_TAGS.has(ct) && !INLINE_TEXT_TAGS.has(ct);
        }).length > 0;
      if (hasBlockEditableChild) return null;
      const directText = $el
        .contents()
        .filter((_, n) => n.type === "text")
        .text()
        .trim();
      const onlyInline =
        $el.children().filter((_, c) =>
          !INLINE_TEXT_TAGS.has((c.tagName || "").toLowerCase())
        ).length === 0;
      if (directText.length > 0 || onlyInline) return "text";
    }
    return null;
  }

  function walk(node, depth) {
    const pad = "  ".repeat(depth);

    if (node.type === "text") {
      const t = escapeJsxText(node.data || "");
      return t ? pad + t : "";
    }
    if (node.type === "comment") return ""; // drop comments
    if (node.type !== "tag" && node.type !== "root") return "";

    const tag = (node.tagName || "").toLowerCase();
    if (!tag) return "";
    if (tag === "script" || tag === "noscript") return ""; // never emit scripts
    if (tag === "html" || tag === "head") {
      // Only descend into <body> for the component tree.
      return $(node)
        .children()
        .toArray()
        .map((c) => walk(c, depth))
        .join("\n")
        .replace(/^\n+|\n+$/g, "");
    }
    if (tag === "body") {
      const inner = $(node)
        .contents()
        .toArray()
        .map((c) => walk(c, depth + 1))
        .filter(Boolean)
        .join("\n");
      return `${pad}<div className="captured-root">\n${inner}\n${pad}</div>`;
    }

    const $el = $(node);
    const editType = SKIP_TEXT_TAGS.has(tag) && !["iframe", "video"].includes(tag)
      ? null
      : classifyEditable($el, node);
    let editInfo = null;
    if (editType) {
      editInfo = nextEdit(editType);
      // Tag the live DOM too, so we can serialize a matching tagged-HTML
      // artifact for a live preview (same ids as the JSX).
      $el.attr("data-edit-id", editInfo.id);
      $el.attr("data-edit-type", editInfo.type);
      editInfo = null; // attrs now live on the node; let buildAttrs emit them
    }
    const attrs = buildAttrs($el, node, editInfo);

    if (VOID_ELEMENTS.has(tag)) {
      return `${pad}<${tag}${attrs} />`;
    }

    const childNodes = $el.contents().toArray();
    const childStr = childNodes
      .map((c) => walk(c, depth + 1))
      .filter(Boolean)
      .join("\n");

    if (!childStr) {
      return `${pad}<${tag}${attrs}></${tag}>`;
    }
    return `${pad}<${tag}${attrs}>\n${childStr}\n${pad}</${tag}>`;
  }

  const bodyEl = $("body").get(0) || $.root().get(0);
  const tree = walk(bodyEl, 2);

  const jsx = `// Auto-generated from an HTML prototype by lib/htmlToReact.js
// Real React component — edit or extend freely.
export default function ${componentName}() {
  return (
${tree}
  );
}
`;

  // Tagged HTML artifact (same data-edit-ids as the JSX), scripts removed —
  // used to render a live, editable preview of the converted page.
  $("script, noscript").remove();
  $("*").each((_, el) => {
    const attribs = el.attribs || {};
    Object.keys(attribs).forEach((name) => {
      if (/^on/i.test(name)) $(el).removeAttr(name);
    });
  });
  const taggedHtml = $.html();

  return { jsx, taggedHtml, headLinks, editableCount: counter, listCount, byType };
}

module.exports = { htmlToReact };
