"use client";

/**
 * app/convert/page.js
 * ----------------------------------------------------------------------------
 * The conversion tool UI.
 *
 *   [ paste HTML ]   →   [ generated React (JSX) code ]
 *                        [ live, editable preview      ]
 *
 * This is the "custom-made conversion tool" made visible: paste any HTML
 * prototype, get real React back, and preview it editable — all in one screen.
 * ----------------------------------------------------------------------------
 */

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";

const CodeEditor = dynamic(() => import("./CodeEditor"), {
  ssr: false,
  loading: () => <div style={{ padding: 16, color: "#8a97a3", fontFamily: "ui-monospace, monospace", fontSize: 12 }}>Loading editor…</div>,
});

const C = {
  navy: "#0E2A47", green: "#1B7A43", amber: "#D97706",
  amberBar: "#FEF3C7", amberLine: "#FCD34D",
  bg: "#F4F6F5", card: "#FFFFFF", border: "#DDE3DF",
  ink: "#16212E", muted: "#5C6B7A", code: "#0E1B2A",
};
const FONT = "'Inter', system-ui, -apple-system, sans-serif";
const MONO = "ui-monospace, 'SF Mono', Consolas, monospace";

// Edit runtime injected into the preview iframe (text / image / icon / video
// + duplicate / remove) — same behavior as the /demo-react proof.
const PREVIEW_RUNTIME = `
(function(){
  var AMBER="#D97706";
  var ICONS=["bi-star-fill","bi-heart-fill","bi-check-circle-fill","bi-people-fill","bi-calendar-event","bi-geo-alt-fill","bi-envelope-fill","bi-telephone-fill","bi-building","bi-trophy-fill","bi-lightbulb-fill","bi-briefcase-fill"];
  var undoStack=[], redoStack=[], ctl=null, cur=null;

  function pickFile(cb){var i=document.createElement("input");i.type="file";i.accept="image/*";i.onchange=function(){var f=i.files&&i.files[0];if(!f)return;var r=new FileReader();r.onload=function(){cb(r.result)};r.readAsDataURL(f)};i.click();}
  function closePops(){document.querySelectorAll(".hp").forEach(function(p){p.remove()})}
  function shell(el){var r=el.getBoundingClientRect();var p=document.createElement("div");p.className="hp";p.style.cssText="position:fixed;z-index:99999;background:#fff;border:1px solid #d0d5dd;border-radius:10px;padding:12px;box-shadow:0 10px 30px rgba(0,0,0,.2);font-family:system-ui";p.style.top=Math.min(innerHeight-190,r.bottom+6)+"px";p.style.left=Math.min(innerWidth-300,Math.max(6,r.left))+"px";setTimeout(function(){function off(e){if(!p.contains(e.target)){closePops();document.removeEventListener("mousedown",off)}}document.addEventListener("mousedown",off)},0);return p;}
  function iconPicker(el){closePops();var p=shell(el);p.innerHTML='<div style="font-weight:700;margin-bottom:8px;font-size:13px">Pick an icon</div><div style="display:grid;grid-template-columns:repeat(6,1fr);gap:6px"></div>';var g=p.querySelector("div:last-child");ICONS.forEach(function(c){var b=document.createElement("button");b.className="bi "+c;b.style.cssText="font-size:20px;padding:6px;border:1px solid #ddd;border-radius:6px;background:#fff;cursor:pointer";b.onclick=function(){snapshot();var kept=(el.getAttribute("class")||"").split(/\\s+/).filter(function(x){return x&&x!=="bi"&&x.indexOf("bi-")!==0});el.setAttribute("class",["bi",c].concat(kept).join(" "));closePops();};g.appendChild(b);});document.body.appendChild(p);}
  function videoPicker(el){closePops();var p=shell(el);var v=el.getAttribute("src")||"";p.innerHTML='<div style="font-weight:700;margin-bottom:8px;font-size:13px">Replace video</div><input type="text" style="width:260px;padding:6px;border:1px solid #ccc;border-radius:6px;font-size:12px"/><button style="margin-top:8px;width:100%;padding:6px;border:none;border-radius:6px;background:#1B7A43;color:#fff;cursor:pointer">Update</button>';var inp=p.querySelector("input");inp.value=v;p.querySelector("button").onclick=function(){snapshot();el.setAttribute("src",inp.value.trim());closePops();};document.body.appendChild(p);}
  function isColor(v){v=(v||"").trim().toLowerCase();if(!v||v==="transparent"||v==="none")return false;return v[0]==="#"||v.indexOf("rgb")===0||v.indexOf("hsl")===0;}
  function toHex(v){v=(v||"").trim();if(v[0]==="#"){if(v.length===4)return "#"+v[1]+v[1]+v[2]+v[2]+v[3]+v[3];return v.slice(0,7);}var s=v.indexOf("("),e=v.indexOf(")");if(s<0||e<0)return "#000000";var pr=v.slice(s+1,e).split(",").map(function(n){return parseFloat(n)});function h(n){n=Math.max(0,Math.min(255,Math.round(n||0)));var x=n.toString(16);return x.length===1?"0"+x:x;}return "#"+h(pr[0])+h(pr[1])+h(pr[2]);}
  function stylePopover(el){closePops();var snapped=false;function snap(){if(!snapped){snapped=true;snapshot();}}var cs=getComputedStyle(el);var bg=isColor(cs.backgroundColor)?toHex(cs.backgroundColor):"#ffffff";var fg=isColor(cs.color)?toHex(cs.color):"#000000";var hasImg=cs.backgroundImage&&cs.backgroundImage!=="none";var p=shell(el);p.innerHTML='<div style="font-weight:700;margin-bottom:10px;font-size:13px">Style this element</div><label style="display:flex;justify-content:space-between;align-items:center;gap:14px;margin-bottom:8px;font-size:12.5px">Background <input type="color" data-r="bg" value="'+bg+'"></label><label style="display:flex;justify-content:space-between;align-items:center;gap:14px;margin-bottom:8px;font-size:12.5px">Text color <input type="color" data-r="fg" value="'+fg+'"></label>'+(hasImg?'<button data-r="clr" style="width:100%;margin-bottom:8px;padding:6px;border:1px solid #ddd;border-radius:6px;background:#f8f8f8;cursor:pointer;font-size:12px">Remove background image</button>':'')+'<button data-r="done" style="width:100%;padding:6px;border:none;border-radius:6px;background:#0E2A47;color:#fff;cursor:pointer;font-size:12px">Done</button>';p.querySelector("[data-r=bg]").addEventListener("input",function(e){snap();el.style.backgroundColor=e.target.value;});p.querySelector("[data-r=fg]").addEventListener("input",function(e){snap();el.style.color=e.target.value;});var clr=p.querySelector("[data-r=clr]");if(clr)clr.onclick=function(){snap();el.style.backgroundImage="none";closePops();};p.querySelector("[data-r=done]").onclick=function(){closePops();};document.body.appendChild(p);}

  // ---- undo / redo history ----
  function pageHtml(){var c=document.body.cloneNode(true);c.querySelectorAll("#hcdx-ctl,.hp").forEach(function(n){n.remove()});return c.innerHTML;}
  function notify(){parent.postMessage({type:"hcdx-history",canUndo:undoStack.length>0,canRedo:redoStack.length>0},"*");}
  function snapshot(){undoStack.push(pageHtml());if(undoStack.length>60)undoStack.shift();redoStack=[];notify();}
  function restore(html){closePops();if(ctl){ctl.remove();ctl=null;}cur=null;document.body.innerHTML=html;bindAll();notify();}
  function undo(){if(!undoStack.length)return;redoStack.push(pageHtml());restore(undoStack.pop());}
  function redo(){if(!redoStack.length)return;undoStack.push(pageHtml());restore(redoStack.pop());}

  function ensureCtl(){
    if(ctl&&document.body.contains(ctl))return;
    ctl=document.createElement("div");ctl.id="hcdx-ctl";ctl.style.cssText="position:fixed;z-index:99998;display:none;gap:6px;background:#0E2A47;padding:4px;border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,.3)";
    ctl.innerHTML='<button data-a="dup" style="border:none;background:#fff;color:#0E2A47;border-radius:5px;padding:4px 9px;font:600 12px system-ui;cursor:pointer">+ Duplicate</button><button data-a="del" style="border:none;background:#fff;color:#0E2A47;border-radius:5px;padding:4px 9px;font:600 12px system-ui;cursor:pointer">✕ Remove</button>';
    document.body.appendChild(ctl);
    ctl.querySelector('[data-a="dup"]').onclick=function(){if(!cur)return;snapshot();var cl=cur.cloneNode(true);cur.after(cl);bindAll();};
    ctl.querySelector('[data-a="del"]').onclick=function(){if(!cur)return;snapshot();cur.remove();cur=null;ctl.style.display="none";};
  }

  function bindAll(){
    ensureCtl();
    document.querySelectorAll("[data-edit-id]").forEach(function(el){
      if(el.__hcdxBound)return; el.__hcdxBound=true;
      var t=el.getAttribute("data-edit-type");
      el.style.outline="1px dashed "+AMBER;el.style.outlineOffset="2px";el.style.cursor=t==="text"?"text":"pointer";
      if(t==="text"){el.setAttribute("contenteditable","true");var edited=false;el.addEventListener("focus",function(){edited=false;});el.addEventListener("input",function(){if(!edited){edited=true;snapshot();}});}
      else if(t==="image"||t==="background"){el.addEventListener("mousedown",function(e){e.preventDefault();pickFile(function(u){snapshot();if(t==="image")el.setAttribute("src",u);else el.style.backgroundImage="url("+u+")";});});}
      else if(t==="icon"){el.addEventListener("mousedown",function(e){e.preventDefault();iconPicker(el);});}
      else if(t==="video"){el.addEventListener("mousedown",function(e){e.preventDefault();videoPicker(el);});}
    });
    document.querySelectorAll("a[href]").forEach(function(a){if(a.__hcdxNav)return;a.__hcdxNav=true;a.addEventListener("click",function(e){e.preventDefault()});});
    document.querySelectorAll("[data-edit-item]").forEach(function(it){if(it.__hcdxItem)return;it.__hcdxItem=true;it.addEventListener("mouseenter",function(){cur=it;var r=it.getBoundingClientRect();ctl.style.display="flex";ctl.style.top=Math.max(6,r.top+6)+"px";ctl.style.left=Math.max(6,r.right-168)+"px";});});
  }

  document.addEventListener("contextmenu",function(e){e.preventDefault();stylePopover(e.target);});
  document.addEventListener("keydown",function(e){var k=e.key.toLowerCase();if((e.ctrlKey||e.metaKey)&&k==="z"&&!e.shiftKey){e.preventDefault();undo();}else if((e.ctrlKey||e.metaKey)&&(k==="y"||(k==="z"&&e.shiftKey))){e.preventDefault();redo();}});
  window.addEventListener("message",function(e){if(!e.data)return;if(e.data.type==="hcdx-undo")undo();if(e.data.type==="hcdx-redo")redo();});

  bindAll();
  notify();
})();
`;

// Hand-edited JSX is stashed in the saved HTML as a comment so reopening
// restores it without a DB schema change. Unicode-safe base64.
const JSX_MARK = "HCDX_JSX_B64:";
function embedJsx(html, jsx) {
  if (!jsx) return html;
  try {
    const b64 = btoa(unescape(encodeURIComponent(jsx)));
    return html + `\n<!--${JSX_MARK}${b64}-->`;
  } catch { return html; }
}
function extractStoredJsx(html) {
  const m = (html || "").match(new RegExp("<!--" + JSX_MARK + "([A-Za-z0-9+/=]+)-->"));
  if (!m) return null;
  try { return decodeURIComponent(escape(atob(m[1]))); } catch { return null; }
}
function stripStoredJsx(html) {
  return (html || "").replace(new RegExp("\\n?<!--" + JSX_MARK + "[A-Za-z0-9+/=]+-->"), "");
}

const SAMPLE = `<!doctype html>
<html>
<head>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.13.1/font/bootstrap-icons.min.css" rel="stylesheet">
</head>
<body>
  <section class="py-5 text-center" style="background:#0E2A47;color:#fff">
    <div class="container">
      <h1 class="fw-bold">Welcome to Our Chamber</h1>
      <p class="lead">Connecting local businesses since 1985.</p>
      <a href="#join" class="btn btn-success btn-lg">Join Now <i class="bi bi-arrow-right"></i></a>
    </div>
  </section>
  <section class="py-5">
    <div class="container">
      <div class="row">
        <div class="col-md-4 text-center"><i class="bi bi-people-fill" style="font-size:2rem"></i><h5>400+ Members</h5><p>A thriving community.</p></div>
        <div class="col-md-4 text-center"><i class="bi bi-calendar-event" style="font-size:2rem"></i><h5>Monthly Events</h5><p>Networking all year.</p></div>
        <div class="col-md-4 text-center"><i class="bi bi-trophy-fill" style="font-size:2rem"></i><h5>Award Winning</h5><p>Recognized regionally.</p></div>
      </div>
    </div>
  </section>
</body>
</html>`;

function ConvertInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectIdParam = searchParams.get("id");

  const [html, setHtml] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [leftTab, setLeftTab] = useState("input"); // "input" | "code"
  const [copied, setCopied] = useState(false);
  const [editPreview, setEditPreview] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [leftPct, setLeftPct] = useState(46);
  const [projectId, setProjectId] = useState(projectIdParam || null);
  const [dirty, setDirty] = useState(false);
  const [loadingProject, setLoadingProject] = useState(!!projectIdParam);
  const [modal, setModal] = useState(null); // { status:'loading'|'success'|'error', message, action }
  const [editableJsx, setEditableJsx] = useState("");
  const [codeError, setCodeError] = useState("");
  const [applying, setApplying] = useState(false);
  // Chooser shows for new projects only: paste code vs. upload a file.
  const [chooser, setChooser] = useState(!projectIdParam);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const iframeRef = useRef(null);
  const splitRef = useRef(null);
  const fileInputRef = useRef(null);
  // On reopen, holds the hand-edited JSX recovered from storage so the sync
  // effect restores it instead of the freshly-regenerated code.
  const pendingJsxRef = useRef(null);

  function handleFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      setHtml(text);
      setChooser(false);
      setLeftTab("input");
      convert(text); // read file → convert straight away
    };
    reader.readAsText(file);
  }

  // Demo-safe path: fetch the HCDX CMC prototype via the backend capture
  // endpoint (which handles the cross-domain fetch + absolutizes assets),
  // then hand it straight to the converter. Guarantees a working preview
  // for demos even if paste/upload has an asset-path issue.
  async function loadCmcDemo() {
    setChooser(false);
    setLeftTab("input");
    setBaseUrl("https://thehcdx.com/cmc/");
    setModal({ status: "loading", message: "Loading the CMC demo page…" });
    try {
      // Use the same capture endpoint the original URL-capture flow uses.
      const cap = await fetch("/api/capture", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://thehcdx.com/cmc/" }),
      });
      const capData = await cap.json();
      if (!cap.ok) throw new Error(capData.error || "Capture failed.");
      // capture stores it as a project; pull the tagged HTML back out.
      const proj = await (await fetch(`/api/projects?id=${capData.id}`)).json();
      const demoHtml = proj.draftHtml || "";
      setHtml(demoHtml);
      setModal(null);
      convert(demoHtml);
    } catch (err) {
      setModal({ status: "error", message: err.message });
    }
  }

  // Listen for undo/redo availability from the preview runtime.
  useEffect(() => {
    function onMsg(e) {
      if (e.data && e.data.type === "hcdx-history") {
        setCanUndo(!!e.data.canUndo);
        setCanRedo(!!e.data.canRedo);
        if (e.data.canUndo) setDirty(true);
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  function postToPreview(type) {
    iframeRef.current?.contentWindow?.postMessage({ type }, "*");
  }

  // Keep the editable code box in sync when a new conversion/result arrives —
  // unless we're reopening a project with hand-edited JSX to restore.
  useEffect(() => {
    if (result && result.jsx) {
      setEditableJsx(pendingJsxRef.current || result.jsx);
      pendingJsxRef.current = null;
      setCodeError("");
    }
  }, [result]);

  // Load an existing project into the tool.
  useEffect(() => {
    if (!projectIdParam) return;
    (async () => {
      try {
        const p = await (await fetch(`/api/projects?id=${projectIdParam}`)).json();
        if (p.error) throw new Error(p.error);
        const storedJsx = extractStoredJsx(p.draftHtml || "");
        const cleanHtml = stripStoredJsx(p.draftHtml || "");
        if (storedJsx) pendingJsxRef.current = storedJsx; // restore code edits
        setHtml(cleanHtml);
        setBaseUrl(p.sourceUrl && p.sourceUrl.startsWith("http") ? p.sourceUrl : "");
        // Regenerate the React view from the stored HTML (idempotent convert).
        const conv = await (await fetch("/api/convert", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ html: cleanHtml, baseUrl: p.sourceUrl }),
        })).json();
        if (!conv.error) { setResult(conv); setTimeout(() => renderPreview(conv, false), 80); }
      } catch (err) {
        setError(err.message || "Couldn't load that project.");
      } finally {
        setLoadingProject(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectIdParam]);

  async function convert(overrideHtml) {
    const source = (typeof overrideHtml === "string" ? overrideHtml : html).trim();
    if (!source) return;
    setModal({ status: "loading", message: "Converting your HTML to React…" });
    setError("");
    try {
      const res = await fetch("/api/convert", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: source, baseUrl: baseUrl.trim() || null }),
      });
      const raw = await res.text();
      let data;
      try { data = raw ? JSON.parse(raw) : {}; }
      catch { throw new Error("The server didn't finish responding — please try again."); }
      if (!res.ok) throw new Error(data.error || "Conversion failed.");
      setResult(data);
      setLeftTab("code");
      setDirty(true);
      setModal(null);
      setTimeout(() => renderPreview(data, editPreview), 60);
    } catch (err) {
      setModal({ status: "error", message: err.message });
    }
  }

  function renderPreview(res, withEditing) {
    const iframe = iframeRef.current;
    const r = res || result;
    if (!iframe || !r) return;
    const doc = iframe.contentDocument;
    doc.open();
    doc.write(r.taggedHtml);
    doc.close();
    if (withEditing) {
      const s = doc.createElement("script");
      s.textContent = PREVIEW_RUNTIME;
      doc.body.appendChild(s);
    }
  }

  // Compile the edited JSX in-browser and re-render the preview from it.
  async function applyCode() {
    setApplying(true);
    setCodeError("");
    try {
      const babelMod = await import("@babel/standalone");
      const Babel = babelMod.transform ? babelMod : babelMod.default;
      const reactMod = await import("react");
      const React = reactMod.default || reactMod;
      const server = await import("react-dom/server.browser");

      const src = editableJsx.replace(/export\s+default\s+/, "");
      const nameMatch = src.match(/function\s+([A-Za-z0-9_$]+)/);
      if (!nameMatch) throw new Error("Couldn't find a component function (expected `function ComponentName() { … }`).");
      const name = nameMatch[1];

      // Classic runtime → compiles JSX to React.createElement calls, which run
      // inside new Function(). The default (automatic) runtime injects an
      // `import "react/jsx-runtime"` statement that a script context can't use.
      const compiled = Babel.transform(src, { presets: [["react", { runtime: "classic" }]] }).code;
      // eslint-disable-next-line no-new-func
      const factory = new Function("React", compiled + "\nreturn " + name + ";");
      const Comp = factory(React);
      const markup = server.renderToStaticMarkup(React.createElement(Comp));

      const links = (result?.headLinks || []).map((h) => `<link rel="stylesheet" href="${h}">`).join("");
      const base = baseUrl.trim() ? `<base href="${baseUrl.trim()}">` : "";
      const doc = `<!doctype html><html><head><meta charset="utf-8">${links}${base}</head><body>${markup}</body></html>`;

      const nextResult = { ...result, jsx: editableJsx, taggedHtml: doc };
      setResult(nextResult);
      setDirty(true);
      setTimeout(() => renderPreview(nextResult, editPreview), 40);
    } catch (err) {
      setCodeError((err && err.message) || String(err));
    } finally {
      setApplying(false);
    }
  }

  function toggleEditPreview() {
    const next = !editPreview;
    setEditPreview(next);
    if (next) setDirty(true);
    setTimeout(() => renderPreview(result, next), 20);
  }

  // Serialize the current preview DOM (with edits), stripping editor-only bits.
  function serializePreview() {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return result ? result.taggedHtml : html;
    const clone = doc.documentElement.cloneNode(true);
    clone.querySelectorAll("#hcdx-ctl, .hp, script").forEach((n) => n.remove());
    clone.querySelectorAll("[data-edit-id]").forEach((el) => {
      el.style.outline = ""; el.style.outlineOffset = ""; el.style.cursor = "";
      el.removeAttribute("contenteditable");
    });
    return "<!doctype html>\n" + clone.outerHTML;
  }

  async function saveChanges() {
    const currentHtml = embedJsx(editPreview ? serializePreview() : (result ? result.taggedHtml : html), editableJsx);
    setModal({ status: "loading", message: projectId ? "Saving your changes…" : "Creating your project…" });
    try {
      let res, data;
      if (!projectId) {
        res = await fetch("/api/projects", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ html: currentHtml, baseUrl: baseUrl.trim() || null, editableCount: result?.editableCount || 0 }),
        });
      } else {
        res = await fetch("/api/publish", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: projectId, action: "save", html: currentHtml }),
        });
      }
      const raw = await res.text();
      try { data = raw ? JSON.parse(raw) : {}; }
      catch { throw new Error("The server didn't finish responding — please try again."); }
      if (!res.ok) throw new Error(data.error || "Save failed.");
      if (!projectId && data.id) {
        setProjectId(data.id);
        window.history.replaceState(null, "", `/convert?id=${data.id}`);
      }
      setDirty(false);
      setModal({ status: "success", message: "Saved.", action: "save" });
    } catch (err) {
      setModal({ status: "error", message: err.message });
    }
  }

  async function publishChanges() {
    const currentHtml = embedJsx(editPreview ? serializePreview() : (result ? result.taggedHtml : html), editableJsx);
    setModal({ status: "loading", message: "Publishing your page…" });
    try {
      let id = projectId;
      // Publishing always needs a project row — create one first if this is
      // still an unsaved conversion.
      if (!id) {
        const createRes = await fetch("/api/projects", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ html: currentHtml, baseUrl: baseUrl.trim() || null, editableCount: result?.editableCount || 0 }),
        });
        const createRaw = await createRes.text();
        let createData;
        try { createData = createRaw ? JSON.parse(createRaw) : {}; }
        catch { throw new Error("The server didn't finish responding — please try again."); }
        if (!createRes.ok) throw new Error(createData.error || "Couldn't create the project.");
        id = createData.id;
        setProjectId(id);
        window.history.replaceState(null, "", `/convert?id=${id}`);
      }
      const res = await fetch("/api/publish", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "publish", html: currentHtml }),
      });
      const raw = await res.text();
      let data;
      try { data = raw ? JSON.parse(raw) : {}; }
      catch { throw new Error("The server didn't finish responding — please try again."); }
      if (!res.ok) throw new Error(data.error || "Publish failed.");
      setDirty(false);
      setModal({ status: "success", message: "Published! Your page is live.", action: "publish", publishedUrl: data.publishedUrl || `/published/${id}` });
    } catch (err) {
      setModal({ status: "error", message: err.message });
    }
  }

  function openInNewWindow() {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.open();
    w.document.write(editPreview ? serializePreview() : (result ? result.taggedHtml : ""));
    w.document.close();
  }

  function copyCode() {
    if (!result) return;
    navigator.clipboard.writeText(result.jsx).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 1600);
    });
  }

  // Resizable divider.
  function startDrag(e) {
    e.preventDefault();
    const move = (ev) => {
      const rect = splitRef.current.getBoundingClientRect();
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      setLeftPct(Math.min(75, Math.max(25, pct)));
    };
    const up = () => { document.removeEventListener("mousemove", move); document.removeEventListener("mouseup", up); document.body.style.userSelect = ""; };
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  }

  if (loadingProject) return <Center>Loading project…</Center>;

  return (
    <div style={{ fontFamily: FONT, height: "100vh", background: C.bg, color: C.ink, display: "flex", flexDirection: "column" }}>
      {/* hidden file input, shared by the chooser and the upload button */}
      <input ref={fileInputRef} type="file" accept=".html,.htm,text/html" style={{ display: "none" }}
        onChange={(e) => { handleFile(e.target.files && e.target.files[0]); e.target.value = ""; }} />

      {chooser && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(14,42,71,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 800, padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: "34px 32px", width: "100%", maxWidth: 560, boxShadow: "0 24px 60px rgba(0,0,0,0.3)" }}>
            <div style={{ fontWeight: 700, fontSize: 20, color: C.navy }}>Start a new project</div>
            <p style={{ fontSize: 14, color: C.muted, margin: "6px 0 24px" }}>How would you like to bring in your HTML?</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <button onClick={() => { setChooser(false); setLeftTab("input"); }}
                style={chooserCard}>
                <div style={{ fontSize: 26 }}>📝</div>
                <div style={{ fontWeight: 700, fontSize: 15, color: C.navy, marginTop: 8 }}>Paste HTML code</div>
                <div style={{ fontSize: 12.5, color: C.muted, marginTop: 4 }}>Paste markup straight into the editor.</div>
              </button>
              <button onClick={() => fileInputRef.current && fileInputRef.current.click()}
                style={chooserCard}>
                <div style={{ fontSize: 26 }}>📄</div>
                <div style={{ fontWeight: 700, fontSize: 15, color: C.navy, marginTop: 8 }}>Upload HTML file</div>
                <div style={{ fontSize: 12.5, color: C.muted, marginTop: 4 }}>Choose a .html file — we read and convert it.</div>
              </button>
            </div>
            <button onClick={loadCmcDemo}
              style={{ ...chooserCard, marginTop: 14, width: "100%", flexDirection: "row", alignItems: "center", gap: 14, background: "#F1F7F3", border: "1px solid #C6DFCE" }}>
              <div style={{ fontSize: 24 }}>✨</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14.5, color: C.navy }}>Load the HCDX CMC demo</div>
                <div style={{ fontSize: 12.5, color: C.muted, marginTop: 2 }}>Grabs <span style={{ fontFamily: MONO }}>thehcdx.com/cmc/</span> live — guaranteed to render with its real styling.</div>
              </div>
              <div style={{ fontSize: 12, color: C.green, fontWeight: 700 }}>DEMO →</div>
            </button>
            <div style={{ marginTop: 20, textAlign: "center" }}>
              <button onClick={() => router.push("/")} style={{ background: "transparent", border: "none", color: C.muted, fontSize: 13, cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* header */}
      <div style={{ background: C.navy, color: "#fff", padding: "12px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
          <button onClick={() => router.push("/")} style={btn("ghost")}>← Dashboard</button>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15.5 }}>{projectId ? "Edit project" : "New project"} <span style={{ fontWeight: 400, opacity: 0.6, fontSize: 13 }}>· HTML → React</span></div>
            <div style={{ fontSize: 12, color: dirty ? "#FCD34D" : "rgba(255,255,255,0.6)" }}>{dirty ? "● Unsaved changes" : projectId ? "All changes saved" : "Not saved yet"}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => fileInputRef.current && fileInputRef.current.click()} style={btn("ghost")}>⬆ Upload file</button>
          <button onClick={() => { setHtml(SAMPLE); setError(""); }} style={btn("ghost")}>Load sample</button>
          <button onClick={() => convert()} disabled={!html.trim()} style={btn("light", !html.trim())}>Convert to React →</button>
          <button onClick={saveChanges} disabled={!result} style={btn("light", !result)}>Save changes</button>
          <button onClick={publishChanges} disabled={!result} style={btn("primary", !result)}>Publish</button>
        </div>
      </div>

      {result && (
        <div style={{ background: "#fff", borderBottom: `1px solid ${C.border}`, padding: "8px 22px", display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12.5, color: C.muted, flexShrink: 0 }}>
          <span><b style={{ color: C.ink }}>{result.editableCount}</b> editable</span>
          <span><b style={{ color: C.ink }}>{result.byType.text}</b> text</span>
          <span><b style={{ color: C.ink }}>{result.byType.image}</b> images</span>
          <span><b style={{ color: C.ink }}>{result.byType.icon}</b> icons</span>
          <span><b style={{ color: C.ink }}>{result.byType.video}</b> videos</span>
          <span><b style={{ color: C.ink }}>{result.listCount}</b> repeatable sections</span>
        </div>
      )}

      {/* split */}
      <div ref={splitRef} style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* left: code side */}
        <div style={{ width: `${leftPct}%`, background: "#fff", display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div style={{ ...paneHead, display: "flex", alignItems: "center", gap: 4 }}>
            <button onClick={() => setLeftTab("input")} style={tabBtn(leftTab === "input")}>HTML input</button>
            <button onClick={() => setLeftTab("code")} style={tabBtn(leftTab === "code")} disabled={!result}>React code</button>
            {leftTab === "code" && result && (
              <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                <button onClick={copyCode} style={btn("mini")}>{copied ? "Copied ✓" : "Copy"}</button>
                <button onClick={applyCode} disabled={applying} style={btn("apply", applying)}>{applying ? "Applying…" : "Apply → preview"}</button>
              </div>
            )}
          </div>
          {leftTab === "input" ? (
            <>
              <div style={{ padding: "10px 16px", borderBottom: `1px solid ${C.border}`, background: "#FBFAF8" }}>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: C.muted, display: "block", marginBottom: 4 }}>
                  Source URL <span style={{ fontWeight: 400 }}>(optional — lets the page load its real CSS &amp; images)</span>
                </label>
                <input type="text" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://thehcdx.com/cmc/" spellCheck={false}
                  style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: `1px solid ${C.border}`, fontFamily: MONO, fontSize: 12, boxSizing: "border-box" }} />
              </div>
              <textarea value={html} onChange={(e) => setHtml(e.target.value)} placeholder="Paste the HTML of a page here…" spellCheck={false}
                style={{ flex: 1, border: "none", outline: "none", resize: "none", padding: "14px 16px", fontFamily: MONO, fontSize: 12.5, lineHeight: 1.55, color: C.ink }} />
            </>
          ) : (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
              <div style={{ flex: 1, minHeight: 0, overflow: "hidden", background: "#282c34" }}>
                <CodeEditor value={editableJsx} onChange={setEditableJsx} />
              </div>
              {codeError && (
                <div style={{ background: "#3a1414", color: "#ffb4ae", borderTop: "1px solid #612", padding: "8px 14px", fontFamily: MONO, fontSize: 11.5, whiteSpace: "pre-wrap", maxHeight: 120, overflow: "auto" }}>
                  {codeError}
                </div>
              )}
              <div style={{ borderTop: `1px solid ${C.border}`, padding: "6px 14px", fontSize: 11.5, color: C.muted, background: "#FBFAF8" }}>
                Edit the JSX, then press <b>Apply → preview</b>. Your changes render live and are kept when you Save.
              </div>
            </div>
          )}
        </div>

        {/* draggable divider */}
        <div onMouseDown={startDrag} title="Drag to resize"
          style={{ width: 8, cursor: "col-resize", background: C.border, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 2, height: 34, background: "#B9C2CC", borderRadius: 2 }} />
        </div>

        {/* right: preview */}
        <div style={fullscreen
          ? { position: "fixed", inset: 0, zIndex: 500, background: "#fff", display: "flex", flexDirection: "column" }
          : { flex: 1, background: "#fff", display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div style={{ ...paneHead, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span>Live preview</span>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {editPreview && (
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={() => postToPreview("hcdx-undo")} disabled={!canUndo} style={btn("mini", !canUndo)} title="Undo (Ctrl+Z)">↶ Undo</button>
                  <button onClick={() => postToPreview("hcdx-redo")} disabled={!canRedo} style={btn("mini", !canRedo)} title="Redo (Ctrl+Y)">↷ Redo</button>
                </div>
              )}
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: C.muted, cursor: result ? "pointer" : "default", opacity: result ? 1 : 0.5 }}>
                <input type="checkbox" checked={editPreview} disabled={!result} onChange={toggleEditPreview} /> Edit mode
              </label>
              <button onClick={() => setFullscreen((f) => !f)} disabled={!result} style={btn("mini", !result)}>{fullscreen ? "Exit full screen" : "⛶ Full screen"}</button>
              <button onClick={openInNewWindow} disabled={!result} style={btn("mini", !result)}>New window ↗</button>
            </div>
          </div>
          {editPreview && (
            <div style={{ background: C.amberBar, borderBottom: `1px solid ${C.amberLine}`, color: "#92400E", padding: "6px 16px", fontSize: 12, lineHeight: 1.4 }}>
              Click text to edit · click an image / icon / video to swap it · <b>right-click anything to change its colors</b> · hover a card to duplicate or remove
            </div>
          )}
          <div style={{ flex: 1, position: "relative", background: "#fff" }}>
            {!result && (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted, fontSize: 13.5, textAlign: "center", padding: 24 }}>
                Convert some HTML to see the live, editable preview here.
              </div>
            )}
            <iframe ref={iframeRef} title="Converted preview" style={{ width: "100%", height: "100%", border: "none", background: "#fff", display: result ? "block" : "none" }} />
          </div>
        </div>
      </div>

      {modal && <ActionModal modal={modal} onClose={() => setModal(null)} projectId={projectId} router={router} />}
      {error && !modal && (
        <div style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", background: "#FEECEC", border: "1px solid #F5C2C2", color: "#B91C1C", padding: "10px 18px", borderRadius: 8, fontSize: 13.5, boxShadow: "0 8px 24px rgba(0,0,0,0.15)", zIndex: 600 }}>
          {error}
        </div>
      )}
    </div>
  );
}

function ActionModal({ modal, onClose, projectId, router }) {
  return (
    <div onClick={() => modal.status !== "loading" && onClose()}
      style={{ position: "fixed", inset: 0, background: "rgba(14,42,71,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 700 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, padding: "30px 28px", width: "100%", maxWidth: 340, textAlign: "center", boxShadow: "0 24px 60px rgba(0,0,0,0.3)" }}>
        {modal.status === "loading" && (<>
          <Spinner /><div style={{ marginTop: 16, fontWeight: 600, color: C.navy }}>{modal.message}</div>
          <div style={{ marginTop: 6, fontSize: 13, color: C.muted }}>This can take a moment for larger pages.</div>
        </>)}
        {modal.status === "success" && (<>
          <div style={okCircle}>✓</div>
          <div style={{ marginTop: 12, fontWeight: 700, fontSize: 15.5, color: C.navy }}>{modal.message}</div>
          <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 8 }}>
            {modal.publishedUrl && (
              <a href={modal.publishedUrl} target="_blank" rel="noreferrer" style={{ ...btn("primary"), textDecoration: "none", textAlign: "center" }}>
                View live ↗
              </a>
            )}
            <button onClick={() => router.push("/")} style={btn("secondary")}>Go to dashboard</button>
            <button onClick={onClose} style={btn("dark")}>Keep editing</button>
          </div>
        </>)}
        {modal.status === "error" && (<>
          <div style={{ ...okCircle, background: "#FEECEC", color: "#B91C1C" }}>!</div>
          <div style={{ marginTop: 12, fontWeight: 700, color: "#B91C1C" }}>Something went wrong</div>
          <div style={{ marginTop: 6, fontSize: 13.5, color: C.muted }}>{modal.message}</div>
          <div style={{ marginTop: 18 }}><button onClick={onClose} style={btn("dark")}>Dismiss</button></div>
        </>)}
      </div>
    </div>
  );
}

function Spinner() {
  return <div style={{ width: 38, height: 38, margin: "0 auto", border: "4px solid #E3E8ED", borderTopColor: C.green, borderRadius: "50%", animation: "hcdxSpin .8s linear infinite" }}>
    <style>{`@keyframes hcdxSpin{to{transform:rotate(360deg)}}`}</style>
  </div>;
}
function Center({ children }) {
  return <div style={{ fontFamily: FONT, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: C.muted }}>{children}</div>;
}

export default function ConvertPage() {
  return (
    <Suspense fallback={<Center>Loading…</Center>}>
      <ConvertInner />
    </Suspense>
  );
}

const paneHead = { padding: "9px 16px", fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: C.muted, borderBottom: `1px solid ${C.border}`, background: "#FBFAF8" };

function btn(variant, disabled) {
  const base = { border: "1px solid transparent", borderRadius: 7, padding: "8px 15px", fontSize: 13.5, fontWeight: 600, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1, fontFamily: FONT };
  const v = {
    primary: { background: C.green, color: "#fff" },
    light: { background: "#fff", color: C.navy },
    ghost: { background: "rgba(255,255,255,0.12)", color: "#fff", border: "1px solid rgba(255,255,255,0.3)" },
    dark: { background: C.navy, color: "#fff" },
    secondary: { background: "transparent", color: C.navy, border: `1px solid ${C.navy}` },
    mini: { background: "transparent", color: C.green, padding: "4px 10px", fontSize: 12.5, border: `1px solid ${C.border}` },
    apply: { background: C.green, color: "#fff", padding: "4px 12px", fontSize: 12.5 },
  };
  return { ...base, ...v[variant] };
}

const okCircle = { width: 46, height: 46, margin: "0 auto", borderRadius: "50%", background: "#E6F1E9", color: "#1B7A43", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700 };

const chooserCard = { display: "flex", flexDirection: "column", alignItems: "flex-start", textAlign: "left", padding: "20px 18px", borderRadius: 12, border: "1px solid #DDE3DF", background: "#FBFAF8", cursor: "pointer", fontFamily: FONT };

function tabBtn(active) {
  return { border: "none", background: active ? C.navy : "transparent", color: active ? "#fff" : C.muted, borderRadius: 6, padding: "5px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT };
}
