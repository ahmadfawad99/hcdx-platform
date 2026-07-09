"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

const C = {
  navy: "#0E2A47",
  green: "#1B7A43",
  greenDark: "#155F35",
  amberBar: "#FFFBEB",
  amberBorder: "#FCD34D",
  amberEdge: "#D97706",
  white: "#FFFFFF",
  textMuted: "#5C6B7A",
  danger: "#B91C1C",
};
const FONT = "'Inter', system-ui, -apple-system, sans-serif";

// Defensive: strip any <script> tags before writing stored HTML into the
// iframe. capture.js already strips scripts from freshly captured pages, so
// this only matters for projects saved before the editor started excluding
// its own injected runtime from what gets stored — without this, an old
// embedded runtime copy would execute alongside the freshly injected one,
// double-attaching every event listener.
function stripEmbeddedScripts(html) {
  return (html || "").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
}

/* The script injected INTO the captured page's iframe. It turns every
   data-edit-* element into a live editable control, and reports changes
   back to the parent via postMessage. */
const EDITOR_RUNTIME = `
(function () {
  const AMBER = "#D97706";
  const AMBER_BG = "rgba(254,243,199,0.55)";

  function markEditable() {
    document.querySelectorAll("[data-edit-id]").forEach((el) => {
      const type = el.getAttribute("data-edit-type");
      el.style.outline = "1px dashed " + AMBER;
      el.style.outlineOffset = "2px";
      el.style.cursor = type === "text" ? "text" : "pointer";
      el.style.transition = "background 0.15s ease";

      el.addEventListener("mouseenter", () => { el.style.background = AMBER_BG; });
      el.addEventListener("mouseleave", () => { el.style.background = ""; });

      if (type === "text") {
        el.setAttribute("contenteditable", "true");
        el.addEventListener("blur", () => {
          post();
        });
        el.addEventListener("keydown", (e) => {
          if (e.key === "Enter" && el.tagName !== "DIV") { e.preventDefault(); el.blur(); }
        });
      } else if (type === "image") {
        el.addEventListener("click", (e) => {
          e.preventDefault();
          pickImage((dataUrl) => { el.setAttribute("src", dataUrl); post(); });
        });
      } else if (type === "background") {
        el.addEventListener("click", (e) => {
          e.preventDefault();
          pickImage((dataUrl) => {
            el.style.backgroundImage = "url(" + dataUrl + ")";
            post();
          });
        });
      }
    });

    // Neutralize link navigation while editing.
    document.querySelectorAll("a[href]").forEach((a) => {
      a.addEventListener("click", (e) => e.preventDefault());
    });
  }

  // --- Per-element style popover (right-click ANY element: hero sections,
  // buttons, arbitrary containers — not just tagged text/image elements) ---
  var activePopover = null;

  function closePopover() {
    if (activePopover) { activePopover.remove(); activePopover = null; }
  }

  function isColorValue(v) {
    v = (v || "").trim().toLowerCase();
    if (!v || v === "none" || v === "transparent" || v === "initial" || v === "inherit") return false;
    return v.charAt(0) === "#" || v.indexOf("rgb") === 0 || v.indexOf("hsl") === 0;
  }

  function rgbToHex(v) {
    v = (v || "").trim();
    if (v.charAt(0) === "#") {
      if (v.length === 4) return "#" + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
      return v.slice(0, 7);
    }
    var start = v.indexOf("(");
    var end = v.indexOf(")");
    if (start === -1 || end === -1) return "#000000";
    var parts = v.slice(start + 1, end).split(",").map(function (s) { return parseFloat(s); });
    function toHex(n) {
      n = Math.max(0, Math.min(255, Math.round(n || 0)));
      var h = n.toString(16);
      return h.length === 1 ? "0" + h : h;
    }
    return "#" + toHex(parts[0]) + toHex(parts[1]) + toHex(parts[2]);
  }

  function openStylePopover(el, x, y) {
    var cs = getComputedStyle(el);
    var bg = isColorValue(cs.backgroundColor) ? rgbToHex(cs.backgroundColor) : "#ffffff";
    var fg = isColorValue(cs.color) ? rgbToHex(cs.color) : "#000000";
    var hasImage = cs.backgroundImage && cs.backgroundImage !== "none";

    var box = document.createElement("div");
    box.id = "hcdx-style-popover";
    box.style.cssText = "position:fixed;z-index:999999;background:#fff;border:1px solid #d0d5dd;border-radius:8px;box-shadow:0 10px 30px rgba(0,0,0,0.2);padding:12px;font-family:system-ui,sans-serif;font-size:13px;color:#111;min-width:210px;";
    box.style.left = Math.min(x, window.innerWidth - 230) + "px";
    box.style.top = Math.min(y, window.innerHeight - 180) + "px";
    box.innerHTML =
      '<div style="font-weight:600;margin-bottom:10px;">Style this element</div>' +
      '<label style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;gap:8px;">Background <input type="color" data-role="bg" value="' + bg + '"></label>' +
      '<label style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;gap:8px;">Text color <input type="color" data-role="fg" value="' + fg + '"></label>' +
      (hasImage ? '<button data-role="clear-img" style="width:100%;margin-bottom:8px;padding:6px;border:1px solid #d0d5dd;border-radius:6px;background:#f8f8f8;cursor:pointer;">Remove background image</button>' : "") +
      '<button data-role="close" style="width:100%;padding:6px;border:none;border-radius:6px;background:#0E2A47;color:#fff;cursor:pointer;">Done</button>';

    box.querySelector('[data-role="bg"]').addEventListener("input", function (ev) {
      el.style.backgroundColor = ev.target.value;
      post();
    });
    box.querySelector('[data-role="fg"]').addEventListener("input", function (ev) {
      el.style.color = ev.target.value;
      post();
    });
    var clearBtn = box.querySelector('[data-role="clear-img"]');
    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        el.style.backgroundImage = "none";
        post();
        closePopover();
      });
    }
    box.querySelector('[data-role="close"]').addEventListener("click", closePopover);

    document.body.appendChild(box);
    activePopover = box;
  }

  document.addEventListener("contextmenu", function (e) {
    closePopover();
    e.preventDefault();
    openStylePopover(e.target, e.clientX, e.clientY);
  });
  document.addEventListener("click", function (e) {
    if (activePopover && !activePopover.contains(e.target)) closePopover();
  });

  // --- Best-effort site-wide theme color detection -------------------------
  var COMMON_THEME_VARS = [
    "--primary", "--primary-color", "--secondary", "--secondary-color",
    "--accent", "--accent-color", "--brand", "--brand-color",
    "--theme-color", "--main-color", "--color-primary", "--color-secondary",
    "--color-accent", "--link-color", "--button-color", "--btn-color",
  ];

  function scanThemeVars() {
    var found = {};
    Array.prototype.forEach.call(document.styleSheets, function (sheet) {
      var rules;
      try { rules = sheet.cssRules; } catch (err) { return; } // cross-origin stylesheet — can't introspect
      if (!rules) return;
      Array.prototype.forEach.call(rules, function (rule) {
        if (!rule.style) return;
        var sel = (rule.selectorText || "").toLowerCase();
        if (sel.indexOf(":root") === -1 && sel !== "html") return;
        for (var i = 0; i < rule.style.length; i++) {
          var prop = rule.style[i];
          if (prop.indexOf("--") === 0) found[prop] = true;
        }
      });
    });
    COMMON_THEME_VARS.forEach(function (name) { found[name] = true; });

    var rootStyle = getComputedStyle(document.documentElement);
    var results = [];
    Object.keys(found).forEach(function (name) {
      var val = rootStyle.getPropertyValue(name).trim();
      if (isColorValue(val)) results.push({ name: name, value: rgbToHex(val) });
    });
    return results;
  }

  function pickImage(cb) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files && input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => cb(reader.result);
      reader.readAsDataURL(file);
    };
    input.click();
  }

  function currentHtml() {
    // Clone doc, strip editor-only styling/attрs we added at runtime.
    const clone = document.documentElement.cloneNode(true);
    clone.querySelectorAll("[data-edit-id]").forEach((el) => {
      el.style.outline = "";
      el.style.outlineOffset = "";
      el.style.cursor = "";
      el.style.background = "";
      el.style.transition = "";
      el.removeAttribute("contenteditable");
    });
    const popover = clone.querySelector("#hcdx-style-popover");
    if (popover) popover.remove();
    // capture.js already strips all <script> tags from the source page, so
    // the ONLY scripts that can appear here are ones the editor itself
    // injected — always safe (and necessary) to strip every one, including
    // any baked in by older saves before this exclusion existed.
    clone.querySelectorAll("script").forEach((s) => s.remove());
    return "<!doctype html>\\n" + clone.outerHTML;
  }

  function post() {
    parent.postMessage({ type: "hcdx-dirty", html: currentHtml() }, "*");
  }

  window.addEventListener("message", (e) => {
    if (e.data && e.data.type === "hcdx-request-html") {
      parent.postMessage({ type: "hcdx-html", html: currentHtml(), requestId: e.data.requestId }, "*");
    }
    if (e.data && e.data.type === "hcdx-request-theme-vars") {
      parent.postMessage({ type: "hcdx-theme-vars", vars: scanThemeVars() }, "*");
    }
    if (e.data && e.data.type === "hcdx-set-theme-var") {
      document.documentElement.style.setProperty(e.data.name, e.data.value);
      post();
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", markEditable);
  } else {
    markEditable();
  }
})();
`;

function EditorInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get("id");
  const iframeRef = useRef(null);

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [themeLoading, setThemeLoading] = useState(false);
  const [themeVars, setThemeVars] = useState([]);
  const latestHtmlRef = useRef(null);

  useEffect(() => {
    if (!id) {
      setError("No project specified.");
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/projects?id=${id}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Couldn't load project.");
        setProject(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // Receive change notifications from the iframe.
  useEffect(() => {
    function onMessage(e) {
      if (!e.data) return;
      if (e.data.type === "hcdx-dirty") {
        latestHtmlRef.current = e.data.html;
        setDirty(true);
      }
      if (e.data.type === "hcdx-html" && pendingResolve.current) {
        pendingResolve.current(e.data.html);
        pendingResolve.current = null;
      }
      if (e.data.type === "hcdx-theme-vars" && pendingThemeResolve.current) {
        pendingThemeResolve.current(e.data.vars);
        pendingThemeResolve.current = null;
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const pendingResolve = useRef(null);
  function requestHtmlFromIframe() {
    return new Promise((resolve) => {
      // Prefer the last change we were told about; otherwise ask the iframe.
      if (latestHtmlRef.current) return resolve(latestHtmlRef.current);
      pendingResolve.current = resolve;
      iframeRef.current?.contentWindow?.postMessage({ type: "hcdx-request-html" }, "*");
    });
  }

  const pendingThemeResolve = useRef(null);
  function requestThemeVars() {
    return new Promise((resolve) => {
      pendingThemeResolve.current = resolve;
      iframeRef.current?.contentWindow?.postMessage({ type: "hcdx-request-theme-vars" }, "*");
    });
  }

  async function openThemePanel() {
    setThemeOpen(true);
    setThemeLoading(true);
    const vars = await requestThemeVars();
    setThemeVars(vars || []);
    setThemeLoading(false);
  }

  function setThemeVar(name, value) {
    setThemeVars((prev) => prev.map((v) => (v.name === name ? { ...v, value } : v)));
    iframeRef.current?.contentWindow?.postMessage({ type: "hcdx-set-theme-var", name, value }, "*");
  }

  // Inject the captured HTML + runtime into the iframe once loaded.
  function handleIframeLoad() {
    const iframe = iframeRef.current;
    if (!iframe || !project) return;
    const doc = iframe.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(stripEmbeddedScripts(project.draftHtml));
    doc.close();
    // Inject runtime after the doc is written. Marked with an id so
    // currentHtml() can strip it before anything gets saved/published —
    // this is editor-only and must never leak into the stored/live page.
    const script = doc.createElement("script");
    script.id = "hcdx-editor-runtime";
    script.textContent = EDITOR_RUNTIME;
    doc.body.appendChild(script);
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  }

  async function doAction(action) {
    setBusy(true);
    try {
      let html = null;
      if (action !== "reset") html = await requestHtmlFromIframe();
      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, html }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed.");

      if (action === "save") { setDirty(false); showToast("Draft saved."); }
      if (action === "reset") {
        latestHtmlRef.current = null;
        setDirty(false);
        showToast("Reset to captured version.");
        // Reload project + iframe.
        const p = await (await fetch(`/api/projects?id=${id}`)).json();
        setProject(p);
        // Force iframe rewrite.
        const iframe = iframeRef.current;
        if (iframe) {
          const d = iframe.contentDocument;
          d.open(); d.write(stripEmbeddedScripts(p.draftHtml)); d.close();
          const s = d.createElement("script"); s.id = "hcdx-editor-runtime"; s.textContent = EDITOR_RUNTIME; d.body.appendChild(s);
        }
      }
      if (action === "publish") {
        setDirty(false);
        showToast("Published. Live now.");
      }
    } catch (err) {
      showToast(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <CenterMsg text="Loading editor…" />;
  if (error) return <CenterMsg text={error} isError onBack={() => router.push("/")} />;

  return (
    <div style={{ fontFamily: FONT, height: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Edit-mode bar */}
      <div style={{ background: C.amberBar, borderBottom: `2px solid ${C.amberBorder}`, padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <button onClick={() => router.push("/")} style={backBtn}>← Dashboard</button>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "#92400E", minWidth: 0 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: C.amberEdge, flexShrink: 0 }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              Editing {project.sourceUrl} — click any highlighted element {dirty ? "· unsaved changes" : ""}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button onClick={openThemePanel} disabled={busy} style={btn("secondary")}>🎨 Theme colors</button>
          <button onClick={() => doAction("reset")} disabled={busy} style={btn("secondary")}>Reset</button>
          <button onClick={() => doAction("save")} disabled={busy} style={btn("dark")}>Save draft</button>
          <button onClick={() => doAction("publish")} disabled={busy} style={btn("primary")}>Publish</button>
        </div>
      </div>

      {/* The captured page, live and editable. Right-click any element
          (hero sections, buttons, arbitrary containers) for direct
          background/text color controls. */}
      <iframe
        ref={iframeRef}
        onLoad={handleIframeLoad}
        title="Captured page editor"
        style={{ flex: 1, width: "100%", border: "none", background: C.white }}
      />

      {themeOpen && (
        <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 300, background: C.white, boxShadow: "-8px 0 24px rgba(0,0,0,0.15)", zIndex: 300, padding: 20, overflowY: "auto", fontFamily: FONT }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: C.navy }}>Theme colors</div>
            <button onClick={() => setThemeOpen(false)} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 20, lineHeight: 1, color: C.textMuted }}>×</button>
          </div>
          {themeLoading && <div style={{ fontSize: 13, color: C.textMuted }}>Scanning page for theme colors…</div>}
          {!themeLoading && themeVars.length === 0 && (
            <div style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.5 }}>
              No site-wide theme variables were detected on this page (common when colors come from an external stylesheet we can't inspect). Right-click any element instead — hero section, button, heading — for direct background/text color controls.
            </div>
          )}
          {!themeLoading && themeVars.map((v) => (
            <label key={v.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, fontSize: 13, gap: 10 }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#333" }}>{v.name}</span>
              <input type="color" value={v.value} onChange={(e) => setThemeVar(v.name, e.target.value)} style={{ width: 36, height: 28, border: "1px solid #d0d5dd", borderRadius: 4, cursor: "pointer", flexShrink: 0 }} />
            </label>
          ))}
          {!themeLoading && themeVars.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 12, color: C.textMuted, lineHeight: 1.5, borderTop: "1px solid #eee", paddingTop: 12 }}>
              Tip: right-click any element on the page for direct color controls too, even ones not tied to a theme variable.
            </div>
          )}
        </div>
      )}

      {toast && (
        <div style={{ position: "fixed", bottom: 24, right: 24, background: C.navy, color: C.white, padding: "12px 18px", borderRadius: 8, fontSize: 13.5, fontWeight: 500, boxShadow: "0 10px 30px rgba(0,0,0,0.25)", zIndex: 200 }}>
          {toast}
        </div>
      )}
    </div>
  );
}

export default function EditorPage() {
  return (
    <Suspense fallback={<CenterMsg text="Loading…" />}>
      <EditorInner />
    </Suspense>
  );
}

/* ---------- helpers ---------- */
const backBtn = { background: "transparent", border: "1px solid rgba(0,0,0,0.15)", borderRadius: 6, padding: "6px 12px", fontSize: 13, fontWeight: 600, color: "#5C4A1E", cursor: "pointer" };

function btn(variant) {
  const base = { border: "1px solid transparent", borderRadius: 6, padding: "7px 15px", fontSize: 13, fontWeight: 600, cursor: "pointer" };
  const variants = {
    primary: { background: "#1B7A43", color: "#fff" },
    dark: { background: "#0E2A47", color: "#fff" },
    secondary: { background: "transparent", color: "#0E2A47", border: "1px solid #0E2A47" },
  };
  return { ...base, ...variants[variant] };
}

function CenterMsg({ text, isError, onBack }) {
  return (
    <div style={{ fontFamily: FONT, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, color: isError ? "#B91C1C" : "#5C6B7A", padding: 24, textAlign: "center" }}>
      <div style={{ fontSize: 15 }}>{text}</div>
      {onBack && (
        <button onClick={onBack} style={{ background: "#0E2A47", color: "#fff", border: "none", borderRadius: 7, padding: "9px 18px", fontWeight: 600, fontSize: 13.5, cursor: "pointer" }}>
          Back to dashboard
        </button>
      )}
    </div>
  );
}
