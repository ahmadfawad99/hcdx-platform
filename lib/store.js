/**
 * lib/store.js
 * ----------------------------------------------------------------------------
 * Persistence layer for captured pages and their edited/published versions.
 *
 * Backed by Supabase (Postgres) so data survives serverless deploys, where
 * the local filesystem is ephemeral. Requires two env vars:
 *
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   (server-only key — never expose to the client)
 *
 * See supabase/migrations/0001_create_projects.sql for the table schema, and
 * .env.example for where these values go locally / in Netlify.
 *
 * A "project" row (camelCase in JS, snake_case in Postgres):
 *   {
 *     id, sourceUrl, capturedAt, captureMode, editableCount,
 *     originalHtml,        // as captured (the reset baseline)
 *     draftHtml,           // work in progress
 *     publishedHtml,       // live version (null until first publish)
 *     status,              // "draft" | "published"
 *     updatedAt
 *   }
 * ----------------------------------------------------------------------------
 */

const { createClient } = require("@supabase/supabase-js");

const TABLE = "projects";

let cachedClient = null;

function client() {
  if (cachedClient) return cachedClient;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY " +
        "(see .env.example)."
    );
  }
  cachedClient = createClient(url, key, { auth: { persistSession: false } });
  return cachedClient;
}

function newId() {
  return (
    "proj_" +
    Date.now().toString(36) +
    "_" +
    Math.random().toString(36).slice(2, 8)
  );
}

// Postgres is snake_case; the rest of the app speaks camelCase.
function fromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    sourceUrl: row.source_url,
    capturedAt: row.captured_at,
    captureMode: row.capture_mode,
    editableCount: row.editable_count,
    originalHtml: row.original_html,
    draftHtml: row.draft_html,
    publishedHtml: row.published_html,
    status: row.status,
    updatedAt: row.updated_at,
  };
}

async function createProject(capture) {
  const now = new Date().toISOString();
  const row = {
    id: newId(),
    source_url: capture.sourceUrl,
    captured_at: capture.capturedAt,
    capture_mode: capture.captureMode,
    editable_count: capture.editableCount,
    original_html: capture.html,
    draft_html: capture.html,
    published_html: null,
    status: "draft",
    updated_at: now,
  };
  const { data, error } = await client().from(TABLE).insert(row).select().single();
  if (error) throw new Error(`Supabase insert failed: ${error.message}`);
  return fromRow(data);
}

async function getProject(id) {
  const { data, error } = await client()
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Supabase select failed: ${error.message}`);
  return fromRow(data);
}

async function listProjects() {
  const { data, error } = await client()
    .from(TABLE)
    .select("id, source_url, captured_at, editable_count, status, updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`Supabase select failed: ${error.message}`);
  // Return a lightweight summary — never the full HTML in a list view.
  return (data || []).map((row) => ({
    id: row.id,
    sourceUrl: row.source_url,
    capturedAt: row.captured_at,
    editableCount: row.editable_count,
    status: row.status,
    updatedAt: row.updated_at,
  }));
}

async function saveDraft(id, draftHtml) {
  const { data, error } = await client()
    .from(TABLE)
    .update({ draft_html: draftHtml, status: "draft", updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) throw new Error(`Supabase update failed: ${error.message}`);
  return fromRow(data);
}

async function resetDraft(id) {
  const project = await getProject(id);
  if (!project) return null;
  const { data, error } = await client()
    .from(TABLE)
    .update({ draft_html: project.originalHtml, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) throw new Error(`Supabase update failed: ${error.message}`);
  return fromRow(data);
}

async function publishProject(id, publishedHtml) {
  const { data, error } = await client()
    .from(TABLE)
    .update({
      published_html: publishedHtml,
      draft_html: publishedHtml,
      status: "published",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) throw new Error(`Supabase update failed: ${error.message}`);
  return fromRow(data);
}

module.exports = {
  createProject,
  getProject,
  listProjects,
  saveDraft,
  resetDraft,
  publishProject,
};
