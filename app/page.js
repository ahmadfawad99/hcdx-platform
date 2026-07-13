"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

/* Design tokens — carried over from the CMC prototype for visual continuity */
const C = {
  navy: "#0E2A47",
  navyDeep: "#081A2E",
  green: "#1B7A43",
  greenDark: "#155F35",
  paleBlue: "#E6F2FA",
  mint: "#E6F1E9",
  bg: "#F4F6F5",
  card: "#FFFFFF",
  border: "#DDE3DF",
  textDark: "#16212E",
  textMuted: "#5C6B7A",
  white: "#FFFFFF",
  danger: "#B91C1C",
};
const FONT = "'Inter', system-ui, -apple-system, sans-serif";

export default function Dashboard() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [email, setEmail] = useState("admin@hcdx.com");
  const [password, setPassword] = useState("demo1234");
  const [loginError, setLoginError] = useState("");

  const [url, setUrl] = useState("");
  const [capturing, setCapturing] = useState(false);
  const [captureError, setCaptureError] = useState("");
  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null); // project pending deletion
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (authed) loadProjects();
  }, [authed]);

  async function loadProjects() {
    setLoadingProjects(true);
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      setProjects(data.projects || []);
    } catch {
      /* leave list empty on error */
    } finally {
      setLoadingProjects(false);
    }
  }

  async function doDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects?id=${confirmDelete.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
      setProjects((prev) => prev.filter((p) => p.id !== confirmDelete.id));
      setConfirmDelete(null);
    } catch {
      /* keep dialog open on failure */
    } finally {
      setDeleting(false);
    }
  }

  function handleLogin(e) {
    e.preventDefault();
    if (email.trim().toLowerCase() === "admin@hcdx.com" && password === "demo1234") {
      setLoginError("");
      setAuthed(true);
    } else {
      setLoginError("Incorrect email or password.");
    }
  }

  async function handleCapture(e) {
    e.preventDefault();
    setCaptureError("");
    const trimmed = url.trim();
    if (!trimmed) {
      setCaptureError("Enter a URL to capture.");
      return;
    }
    setCapturing(true);
    try {
      const res = await fetch("/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Capture failed.");
      // Straight into the editor for the freshly captured page.
      router.push(`/editor?id=${data.id}`);
    } catch (err) {
      setCaptureError(err.message);
      setCapturing(false);
    }
  }

  /* ---------- Login gate ---------- */
  if (!authed) {
    return (
      <div style={{ fontFamily: FONT, minHeight: "100vh", background: C.navy, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <form onSubmit={handleLogin} style={{ background: C.white, borderRadius: 14, padding: "40px 34px", width: "100%", maxWidth: 380, boxShadow: "0 24px 60px rgba(0,0,0,0.3)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <LogoMark size={34} />
            <div style={{ fontWeight: 700, fontSize: 19, color: C.navy }}>HCDX Platform</div>
          </div>
          <p style={{ fontSize: 13.5, color: C.textMuted, marginBottom: 26 }}>Sign in to capture and manage client pages.</p>

          <label style={labelStyle}>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />

          <label style={labelStyle}>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ ...inputStyle, marginBottom: loginError ? 8 : 20 }} />

          {loginError && <p style={{ color: C.danger, fontSize: 13, marginBottom: 14 }}>{loginError}</p>}

          <button type="submit" style={{ width: "100%", background: C.green, color: C.white, border: "none", borderRadius: 8, padding: "12px 0", fontWeight: 600, fontSize: 15, cursor: "pointer" }}>
            Sign in
          </button>
        </form>
      </div>
    );
  }

  /* ---------- Dashboard ---------- */
  return (
    <div style={{ fontFamily: FONT, minHeight: "100vh", background: C.bg, color: C.textDark }}>
      {/* Top bar */}
      <div style={{ background: C.navy, color: C.white, padding: "14px 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <LogoMark size={30} />
          <span style={{ fontWeight: 700, fontSize: 16 }}>HCDX Platform</span>
        </div>
        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>admin@hcdx.com</span>
      </div>

      <div style={{ maxWidth: 880, margin: "0 auto", padding: "40px 24px" }}>
        {/* New React project card (primary flow) */}
        <div style={{ background: C.navy, borderRadius: 14, padding: "28px 28px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: 21, fontWeight: 700, color: C.white, margin: "0 0 6px" }}>New project</h1>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.8)", margin: 0 }}>
              Paste an HTML prototype, convert it to a real React page, and edit it inline.
            </p>
          </div>
          <button
            onClick={() => router.push("/convert")}
            style={{ background: C.green, color: C.white, border: "none", borderRadius: 8, padding: "12px 22px", fontWeight: 600, fontSize: 14.5, cursor: "pointer", whiteSpace: "nowrap" }}
          >
            ＋ Create project
          </button>
        </div>

        {/* Capture card (secondary) */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "30px 28px", marginBottom: 34 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: C.navy, margin: "0 0 6px" }}>Or capture a live URL</h1>
          <p style={{ fontSize: 14, color: C.textMuted, margin: "0 0 20px" }}>
            Paste the URL of any live page. We&apos;ll capture it, store a copy, and open it ready to edit.
          </p>

          <form onSubmit={handleCapture} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://thehcdx.com/cmc/"
              disabled={capturing}
              style={{ flex: 1, minWidth: 260, padding: "12px 14px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 14.5, fontFamily: FONT }}
            />
            <button
              type="submit"
              disabled={capturing}
              style={{ background: capturing ? C.textMuted : C.green, color: C.white, border: "none", borderRadius: 8, padding: "12px 24px", fontWeight: 600, fontSize: 14.5, cursor: capturing ? "default" : "pointer", whiteSpace: "nowrap" }}
            >
              {capturing ? "Capturing…" : "Capture page"}
            </button>
          </form>

          {capturing && (
            <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 10, color: C.textMuted, fontSize: 13.5 }}>
              <Spinner /> Fetching the page and preparing it for editing…
            </div>
          )}
          {captureError && (
            <div style={{ marginTop: 16, background: "#FEECEC", border: "1px solid #F5C2C2", color: C.danger, borderRadius: 8, padding: "10px 14px", fontSize: 13.5 }}>
              {captureError}
            </div>
          )}
        </div>

        {/* Projects list */}
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: C.navy, margin: 0 }}>Your captured pages</h2>
          <button onClick={loadProjects} style={{ background: "transparent", border: "none", color: C.green, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            Refresh
          </button>
        </div>

        {loadingProjects ? (
          <p style={{ color: C.textMuted, fontSize: 14 }}>Loading…</p>
        ) : projects.length === 0 ? (
          <div style={{ background: C.card, border: `1px dashed ${C.border}`, borderRadius: 12, padding: "36px 24px", textAlign: "center", color: C.textMuted, fontSize: 14 }}>
            No pages captured yet. Paste a URL above to get started.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {projects.map((p) => (
              <div key={p.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14.5, color: C.navy, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.sourceUrl}</div>
                  <div style={{ fontSize: 12.5, color: C.textMuted, marginTop: 3 }}>
                    {p.captureMode === "react" ? "React project" : "Captured page"} · {p.editableCount} editable elements · {new Date(p.capturedAt).toLocaleDateString()}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                  <StatusPill status={p.status} />
                  <a href={p.captureMode === "react" ? `/convert?id=${p.id}` : `/editor?id=${p.id}`} style={{ background: C.navy, color: C.white, textDecoration: "none", borderRadius: 7, padding: "8px 16px", fontWeight: 600, fontSize: 13 }}>
                    Edit
                  </a>
                  {p.status === "published" && (
                    <a href={`/published/${p.id}`} target="_blank" rel="noreferrer" style={{ color: C.green, textDecoration: "none", fontWeight: 600, fontSize: 13 }}>
                      View live ↗
                    </a>
                  )}
                  <button onClick={() => setConfirmDelete(p)} title="Delete project"
                    style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.danger, borderRadius: 7, padding: "8px 12px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {confirmDelete && (
        <div onClick={() => !deleting && setConfirmDelete(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(14,42,71,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 500, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: C.white, borderRadius: 14, padding: "26px 26px", width: "100%", maxWidth: 380, boxShadow: "0 24px 60px rgba(0,0,0,0.3)" }}>
            <div style={{ fontWeight: 700, fontSize: 17, color: C.navy, marginBottom: 6 }}>Delete this project?</div>
            <p style={{ fontSize: 13.5, color: C.textMuted, margin: "0 0 6px", wordBreak: "break-all" }}>{confirmDelete.sourceUrl}</p>
            <p style={{ fontSize: 13, color: C.danger, margin: "0 0 20px" }}>This can&apos;t be undone.</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmDelete(null)} disabled={deleting} style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.textDark, borderRadius: 8, padding: "9px 16px", fontWeight: 600, fontSize: 13.5, cursor: "pointer" }}>Cancel</button>
              <button onClick={doDelete} disabled={deleting} style={{ background: C.danger, color: C.white, border: "none", borderRadius: 8, padding: "9px 16px", fontWeight: 600, fontSize: 13.5, cursor: "pointer" }}>{deleting ? "Deleting…" : "Delete"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Small helpers ---------- */
const labelStyle = { fontSize: 12.5, fontWeight: 600, color: "#16212E", display: "block", marginBottom: 5 };
const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #DDE3DF", marginBottom: 16, fontSize: 14, fontFamily: FONT, boxSizing: "border-box" };

function StatusPill({ status }) {
  const published = status === "published";
  return (
    <span style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: published ? "#E6F1E9" : "#FEF3E0", color: published ? "#155F35" : "#8A6D1E" }}>
      {published ? "Published" : "Draft"}
    </span>
  );
}

function Spinner() {
  return (
    <span
      style={{ width: 15, height: 15, border: "2px solid #C8D2CC", borderTopColor: "#1B7A43", borderRadius: "50%", display: "inline-block", animation: "hcdxspin 0.7s linear infinite" }}
    >
      <style>{`@keyframes hcdxspin{to{transform:rotate(360deg)}}`}</style>
    </span>
  );
}

function LogoMark({ size = 34 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40">
      <path d="M20 20 L20 2 A18 18 0 0 1 35.6 28.5 Z" fill="#33506E" />
      <path d="M20 20 L35.6 28.5 A18 18 0 0 1 4.4 28.5 Z" fill="#1B7A43" />
      <path d="M20 20 L4.4 28.5 A18 18 0 0 1 20 2 Z" fill="#0E2A47" />
      <circle cx="20" cy="20" r="3.4" fill="#081A2E" />
    </svg>
  );
}
