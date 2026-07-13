/**
 * app/api/projects/route.js
 * GET            -> list all projects (summaries)
 * GET ?id=...    -> full project (including draft HTML) for the editor
 * POST { html, baseUrl, editableCount } -> create a React-converted project
 */

import { NextResponse } from "next/server";
const { listProjects, getProject, createProject, deleteProject } = require("@/lib/store");

export const dynamic = "force-dynamic";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (id) {
    const project = await getProject(id);
    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }
    return NextResponse.json(project);
  }

  return NextResponse.json({ projects: await listProjects() });
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
  }

  const html = (body.html || "").trim();
  if (!html) {
    return NextResponse.json({ error: "Nothing to save yet — convert some HTML first." }, { status: 400 });
  }

  try {
    const project = await createProject({
      sourceUrl: body.baseUrl || "(pasted HTML)",
      capturedAt: new Date().toISOString(),
      captureMode: "react",
      editableCount: body.editableCount || 0,
      html,
    });
    return NextResponse.json({ id: project.id, status: project.status, updatedAt: project.updatedAt });
  } catch (err) {
    console.error("Create project failed:", err);
    return NextResponse.json({ error: err.message || "Couldn't save the project." }, { status: 500 });
  }
}

export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing project id." }, { status: 400 });
  }
  try {
    await deleteProject(id);
    return NextResponse.json({ id, deleted: true });
  } catch (err) {
    console.error("Delete project failed:", err);
    return NextResponse.json({ error: err.message || "Couldn't delete the project." }, { status: 500 });
  }
}
