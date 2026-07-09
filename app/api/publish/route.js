/**
 * app/api/publish/route.js
 * POST { id, action, html }
 *   action = "save"    -> store draft HTML
 *   action = "reset"   -> restore to originally captured HTML
 *   action = "publish" -> mark live; served at /published/:id
 *
 * Kept in one route so the editor has a single save/reset/publish endpoint,
 * mirroring the original POC's flow.
 */

import { NextResponse } from "next/server";
const { saveDraft, resetDraft, publishProject } = require("@/lib/store");

export const dynamic = "force-dynamic";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { id, action, html } = body;
  if (!id || !action) {
    return NextResponse.json(
      { error: "id and action are required." },
      { status: 400 }
    );
  }

  let project = null;
  switch (action) {
    case "save":
      project = await saveDraft(id, html);
      break;
    case "reset":
      project = await resetDraft(id);
      break;
    case "publish":
      project = await publishProject(id, html);
      break;
    default:
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  return NextResponse.json({
    id: project.id,
    status: project.status,
    updatedAt: project.updatedAt,
    publishedUrl: action === "publish" ? `/published/${project.id}` : undefined,
  });
}
