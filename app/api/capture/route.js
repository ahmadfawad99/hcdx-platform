/**
 * app/api/capture/route.js
 * POST { url } -> captures the page, stores it, returns the new project id.
 *
 * This is the endpoint the URL-capture screen calls. It runs on the server,
 * which is what allows it to fetch a page from another domain (a browser
 * cannot, due to the same-origin policy).
 */

import { NextResponse } from "next/server";
const { capturePage } = require("@/lib/capture");
const { createProject } = require("@/lib/store");

// Capture can take a while (headless render); allow up to 60s.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Send a JSON body with a url field." },
      { status: 400 }
    );
  }

  const url = (body.url || "").trim();
  if (!url) {
    return NextResponse.json(
      { error: "Enter a URL to capture." },
      { status: 400 }
    );
  }

  try {
    const capture = await capturePage(url);
    const project = await createProject(capture);
    return NextResponse.json({
      id: project.id,
      sourceUrl: project.sourceUrl,
      editableCount: project.editableCount,
      captureMode: project.captureMode,
    });
  } catch (err) {
    // Surface a clean, user-facing message; log the detail server-side.
    console.error("Capture failed:", err);
    return NextResponse.json(
      { error: err.message || "Couldn't capture that page." },
      { status: 502 }
    );
  }
}
