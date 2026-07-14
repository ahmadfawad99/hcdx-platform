/**
 * app/api/convert/route.js
 * POST { html } -> { jsx, taggedHtml, editableCount, listCount, byType, headLinks }
 *
 * Runs the HTML → React conversion server-side (cheerio isn't meant for the
 * client bundle). Powers the two-pane converter UI at /convert.
 */

import { NextResponse } from "next/server";
const { htmlToReact } = require("@/lib/htmlToReact");

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a JSON body with an html field." }, { status: 400 });
  }

  const html = (body.html || "").trim();
  if (!html) {
    return NextResponse.json({ error: "Paste some HTML to convert." }, { status: 400 });
  }

  try {
    const result = await htmlToReact(html, {
      componentName: body.componentName || "CapturedPage",
      baseUrl: body.baseUrl || null,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("Convert failed:", err);
    return NextResponse.json(
      { error: err.message || "Couldn't convert that HTML." },
      { status: 500 }
    );
  }
}
