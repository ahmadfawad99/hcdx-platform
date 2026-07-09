/**
 * app/api/projects/route.js
 * GET            -> list all projects (summaries)
 * GET ?id=...    -> full project (including draft HTML) for the editor
 */

import { NextResponse } from "next/server";
const { listProjects, getProject } = require("@/lib/store");

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
