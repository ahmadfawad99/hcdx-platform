/**
 * app/published/[id]/route.js
 * GET -> serves the published HTML for a project as a full HTML document.
 *
 * This is the "live" version a visitor would see. Published pages are served
 * from the platform's own domain, at a platform-controlled URL.
 */

const { getProject } = require("@/lib/store");

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  const { id } = await params;
  const project = await getProject(id);

  if (!project || !project.publishedHtml) {
    return new Response(
      `<!doctype html><meta charset="utf-8">
       <div style="font-family:system-ui;padding:48px;max-width:640px;margin:0 auto">
         <h1 style="color:#0E2A47">Not published yet</h1>
         <p style="color:#555">This page hasn't been published, or the link is incorrect.</p>
       </div>`,
      { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  // Strip the editor's data-edit-* attributes and any embedded editor
  // runtime <script> (older saves, before the editor started excluding it
  // itself) from the published output so the live page is clean and never
  // executes editor-only JS.
  const clean = project.publishedHtml
    .replace(/\sdata-edit-id="[^"]*"/g, "")
    .replace(/\sdata-edit-type="[^"]*"/g, "")
    .replace(/\sdata-edit-list="[^"]*"/g, "")
    .replace(/\sdata-edit-item="[^"]*"/g, "")
    .replace(/<!--HCDX_JSX_B64:[A-Za-z0-9+/=]+-->/g, "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");

  return new Response(clean, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
