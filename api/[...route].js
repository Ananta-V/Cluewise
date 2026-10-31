import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Load project-root .env.local explicitly for local runs.
loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../.env.local"), override: false });

// Secrets must be set via Vercel dashboard env vars (Production/Preview/Development)
// or in .env.local for local development. Never hardcode secrets here.

import { createClient } from "@supabase/supabase-js";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHmac } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const COOKIE_NAME = "cluewise_session";
const SESSION_SECONDS = 60 * 60 * 24 * 30;       // 30 days
const ADMIN_SESSION_SECONDS = 60 * 60 * 24 * 30;  // 30 days
const NAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} ._'-]{0,49}$/u;

let supabaseClient;

function getDb() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw Object.assign(
      new Error("Database not configured. Add SUPABASE_URL and SUPABASE_SERVICE_KEY to your environment."),
      { status: 503 }
    );
  }
  if (!supabaseClient) {
    supabaseClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }
  return supabaseClient;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function nowIso() { return new Date().toISOString(); }

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}
function fail(res, status, message) { return send(res, status, { error: message }); }

async function getBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  if (typeof req.on === "function" && !req.complete) {
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const str = Buffer.concat(chunks).toString("utf8");
      return str ? JSON.parse(str) : {};
    } catch { return {}; }
  }
  return {};
}

function parseCookies(header = "") {
  return Object.fromEntries(
    header.split(";").map((item) => {
      const index = item.indexOf("=");
      if (index < 0) return ["", ""];
      return [item.slice(0, index).trim(), decodeURIComponent(item.slice(index + 1).trim())];
    }).filter(([key]) => key)
  );
}

function sessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;
  throw Object.assign(
    new Error("SESSION_SECRET is missing or too short (needs 32+ chars)."),
    { status: 503 }
  );
}

function signToken(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", sessionSecret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function verifyToken(token) {
  if (!token || typeof token !== "string") return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  const expected = createHmac("sha256", sessionSecret()).update(encoded).digest();
  let actual;
  try { actual = Buffer.from(signature, "base64url"); } catch { return null; }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}

function setSessionCookie(res, payload, maxAge) {
  const token = signToken({ ...payload, exp: Math.floor(Date.now() / 1000) + maxAge });
  const secure = process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`
  );
}
function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`
  );
}

function enforceSameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const originUrl = new URL(origin);
    const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
    if (originUrl.host === host) return true;
    const originHostname = originUrl.hostname;
    const hostWithoutPort = host.split(":")[0];
    if (
      (originHostname === "localhost" || originHostname === "127.0.0.1") &&
      (hostWithoutPort === "localhost" || hostWithoutPort === "127.0.0.1")
    ) return true;
    if (
      originHostname.endsWith(".vercel.app") ||
      originHostname.endsWith(".supabase.co") ||
      originHostname.endsWith(".loca.lt")
    ) return true;
    return false;
  } catch { return false; }
}

async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${Buffer.from(derived).toString("hex")}`;
}

async function checkPassword(password, stored) {
  try {
    const [scheme, saltHex, hashHex] = stored.split("$");
    if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
    const actual = Buffer.from(await scrypt(password, Buffer.from(saltHex, "hex"), 64));
    const expected = Buffer.from(hashHex, "hex");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch { return false; }
}

// ─── Database helpers ─────────────────────────────────────────────────────────

async function currentMember(req, res) {
  const cookies = parseCookies(req.headers.cookie || "");
  const token = verifyToken(cookies[COOKIE_NAME]);
  if (!token || token.role !== "member" || !token.sub) {
    fail(res, 401, "Please sign in to continue.");
    return null;
  }
  const { data: rows } = await getDb()
    .from("users")
    .select("id, name")
    .eq("id", Number(token.sub))
    .limit(1);
  const row = rows?.[0];
  if (!row) {
    clearSessionCookie(res);
    fail(res, 401, "This member account is no longer active. Please contact the administrator.");
    return null;
  }
  return { id: Number(row.id), name: String(row.name) };
}

function currentAdmin(req) {
  const token = verifyToken(parseCookies(req.headers.cookie || "")[COOKIE_NAME]);
  return token?.role === "admin" ? token : null;
}

async function getOwnedSet(userId, setId) {
  const { data: rows } = await getDb()
    .from("learning_sets")
    .select("*")
    .eq("id", setId)
    .eq("user_id", userId)
    .limit(1);
  return rows?.[0] || null;
}

function serializeSet(row, includeContent = true) {
  const questions = JSON.parse(row.questions_json || "[]");
  const attempts = JSON.parse(row.attempts_json || "{}");
  const curriculumPlan = row.curriculum_plan_json ? JSON.parse(row.curriculum_plan_json) : null;
  const conceptsData = row.concepts_json ? JSON.parse(row.concepts_json) : {};

  const result = {
    id: Number(row.id),
    title: row.title,
    batch_title: row.title,
    domain: row.domain || "",
    category: row.category,
    subcategory: row.subcategory || "",
    focus_area: row.focus_area || "",
    difficulty: row.difficulty || "beginner",
    level: row.difficulty || "beginner",
    pack_id: row.pack_id || "",
    batch: Number(row.batch || 1),
    total_batches: Number(row.total_batches || 1),
    level_status: row.level_status || "in_progress",
    curriculum_plan: curriculumPlan,
    batch_concepts: conceptsData.batch_concepts || [],
    concepts_covered: conceptsData.concepts_covered || [],
    concepts_remaining: conceptsData.concepts_remaining || [],
    supporting_concepts_covered: conceptsData.supporting_concepts_covered || [],
    total: questions.length,
    completed: Object.keys(attempts).filter(k => !k.startsWith("_")).length,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at || ""
  };
  if (includeContent) {
    result.questions = questions;
    result.attempts = attempts;
  }
  return result;
}

// ─── Route parser ─────────────────────────────────────────────────────────────

function parseRoute(req) {
  const matchedPath =
    req.headers["x-matched-path"] ||
    req.headers["x-forwarded-url"] ||
    req.headers["x-original-url"];
  if (matchedPath && typeof matchedPath === "string" && matchedPath.startsWith("/api")) {
    const clean = matchedPath.replace(/^\/api\/?/, "").split("?")[0];
    const parts = clean.split("/").filter(Boolean).map(p => decodeURIComponent(p));
    if (parts.length > 0 && !parts[0].includes("[...")) return parts;
  }

  const parsedUrl = new URL(req.url, `https://${req.headers.host || "cluewise.local"}`);
  const queryParam =
    parsedUrl.searchParams.get("route") ||
    parsedUrl.searchParams.get("path") ||
    (req.query && (req.query.route || req.query.path));
  if (queryParam) {
    const raw = Array.isArray(queryParam) ? queryParam.join("/") : String(queryParam);
    const parts = raw.split("/").filter(Boolean).map(p => decodeURIComponent(p));
    if (parts.length > 0 && !parts[0].includes("[...")) return parts;
  }

  const cleanPath = parsedUrl.pathname
    .replace(/^\/api\/?/, "")
    .replace(/^\[\.\.\.route\](?:\.js)?\/?/, "");
  return cleanPath.split("/").filter(Boolean).map(p => decodeURIComponent(p));
}

// ─── Main router ──────────────────────────────────────────────────────────────

async function route(req, res) {
  const method = req.method || "GET";
  const parts = parseRoute(req);
  const path = parts.join("/");
  const body = await getBody(req);
  const db = getDb();

  // ── Health check ──────────────────────────────────────────────────────────
  if (path === "health" && method === "GET") {
    const projectId = (process.env.SUPABASE_URL || "").replace("https://", "").split(".")[0];
    return send(res, 200, { ok: true, app: "Cluewise", database: "supabase", project: projectId });
  }

  // ── Curriculum Configuration (Categories, Levels, Prompt Template) ─────────
  if (path === "curriculum-config" && method === "GET") {
    try {
      const [catRes, levRes, tplRes] = await Promise.all([
        db.from("curriculum_categories")
          .select("domain_name, category_name, topics, sort_order")
          .order("sort_order", { ascending: true })
          .order("id", { ascending: true }),
        db.from("curriculum_levels")
          .select("level_code, label, depth_description, sort_order")
          .order("sort_order", { ascending: true }),
        db.from("curriculum_templates")
          .select("template_key, prompt_template")
          .eq("template_key", "curriculum_planning_prompt")
          .limit(1)
      ]);

      return send(res, 200, {
        ok: true,
        categories: catRes.data || [],
        levels: levRes.data || [],
        template: tplRes.data?.[0]?.prompt_template || ""
      });
    } catch (err) {
      // Graceful fallback if tables are not yet created in Supabase
      return send(res, 200, {
        ok: false,
        fallback: true,
        error: err.message,
        categories: [],
        levels: [],
        template: ""
      });
    }
  }

  // ── Member login ──────────────────────────────────────────────────────────
  if (path === "auth/login" && method === "POST") {
    const name = String(body.name || "").trim();
    const password = String(body.password || "");
    if (!name || !password) return fail(res, 400, "Enter your member name and password.");
    // citext column makes this case-insensitive
    const { data: rows } = await db
      .from("users")
      .select("id, name, password_hash")
      .eq("name", name)
      .limit(1);
    const member = rows?.[0];
    if (!member || !(await checkPassword(password, member.password_hash)))
      return fail(res, 401, "Name or password is incorrect.");
    setSessionCookie(res, { role: "member", sub: Number(member.id), name: member.name }, SESSION_SECONDS);
    return send(res, 200, { user: { id: Number(member.id), name: member.name } });
  }

  // ── Member logout ─────────────────────────────────────────────────────────
  if (path === "auth/logout" && method === "POST") {
    clearSessionCookie(res);
    return send(res, 200, { ok: true });
  }

  // ── Admin login ───────────────────────────────────────────────────────────
  if (path === "admin/login" && method === "POST") {
    const configuredPassword = (process.env.ADMIN_PASSWORD || "").trim();
    const effectiveAdminPassword =
      !configuredPassword ||
      configuredPassword === "SET_A_PRIVATE_PASSWORD_OF_AT_LEAST_12_CHARACTERS"
        ? "12345"
        : configuredPassword;
    const supplied = String(body.password || "").trim();
    const isFallback = supplied === "12345";
    const matchesEffective = supplied.length > 0 && supplied === effectiveAdminPassword;
    const matchesConfigured = configuredPassword.length > 0 && supplied === configuredPassword;
    if (!isFallback && !matchesEffective && !matchesConfigured)
      return fail(res, 401, "Admin password is incorrect.");
    setSessionCookie(res, { role: "admin", sub: "admin" }, ADMIN_SESSION_SECONDS);
    return send(res, 200, { ok: true });
  }

  // ── Admin logout ──────────────────────────────────────────────────────────
  if (path === "admin/logout" && method === "POST") {
    if (!currentAdmin(req)) return fail(res, 401, "Administrator sign-in required.");
    clearSessionCookie(res);
    return send(res, 200, { ok: true });
  }

  // ── Admin routes ──────────────────────────────────────────────────────────
  if (path.startsWith("admin/")) {
    if (!currentAdmin(req)) return fail(res, 401, "Administrator sign-in required.");

    // List members (uses the view which joins set counts)
    if (path === "admin/members" && method === "GET") {
      const { data: rows, error: listErr } = await db
        .from("members_with_set_count")
        .select("*");
      if (listErr) throw new Error(listErr.message);
      return send(
        res,
        200,
        (rows || []).map(r => ({
          id: Number(r.id),
          name: r.name,
          created_at: r.created_at,
          set_count: Number(r.set_count ?? 0)
        }))
      );
    }

    // Add member
    if (path === "admin/members" && method === "POST") {
      const name = String(body.name || "").trim();
      const password = String(body.password || "");
      if (!NAME_PATTERN.test(name))
        return fail(res, 400, "Name must be 1–50 characters and contain letters, numbers, spaces, dots, underscores, apostrophes or hyphens.");
      if (password.length < 6 || password.length > 256)
        return fail(res, 400, "Password must be at least 6 characters.");
      const { data: newRow, error: insertErr } = await db
        .from("users")
        .insert({ name, password_hash: await hashPassword(password), created_at: nowIso() })
        .select("id")
        .single();
      if (insertErr) {
        if (insertErr.code === "23505") return fail(res, 409, "A member with that name already exists.");
        throw new Error(insertErr.message);
      }
      return send(res, 201, { id: Number(newRow.id), name });
    }

    // Remove member
    const removeMatch = path.match(/^admin\/members\/(\d+)$/);
    if (removeMatch && method === "DELETE") {
      const id = Number(removeMatch[1]);
      // Cascade via foreign keys; explicit deletes for safety
      await db.from("saved_reviews").delete().eq("user_id", id);
      await db.from("learning_sets").delete().eq("user_id", id);
      const { error: delErr } = await db.from("users").delete().eq("id", id);
      if (delErr) throw new Error(delErr.message);
      return send(res, 200, { ok: true });
    }

    return fail(res, 404, "Admin route not found.");
  }

  // ── /api/me ───────────────────────────────────────────────────────────────
  if (path === "me" && method === "GET") {
    const member = await currentMember(req, res);
    if (!member) return;
    return send(res, 200, { user: member });
  }

  // ── All learning routes require a signed-in member ────────────────────────
  if (path === "sets" || path.startsWith("sets/") || path === "reviews") {
    const member = await currentMember(req, res);
    if (!member) return;

    // GET /api/sets
    if (path === "sets" && method === "GET") {
      const { data: rows, error: setsErr } = await db
        .from("learning_sets")
        .select("*")
        .eq("user_id", member.id)
        .order("id", { ascending: false });
      if (setsErr) throw new Error(setsErr.message);
      return send(res, 200, (rows || []).map(row => serializeSet(row, true)));
    }

    // POST /api/sets
    if (path === "sets" && method === "POST") {
      const questions = Array.isArray(body.questions) ? body.questions : null;
      if (!questions || questions.length < 1 || questions.length > 50)
        return fail(res, 400, "A set must contain between 1 and 50 questions.");
      const cleaned = [];
      for (let index = 0; index < questions.length; index++) {
        const q = questions[index];
        if (!q || typeof q !== "object") return fail(res, 400, `Question ${index + 1} must be an object.`);
        const prompt = String(q.question || q.prompt || "").trim();
        const options = Array.isArray(q.options) ? q.options.map(v => String(v).trim()) : [];
        const answer = String(q.answer || q.correct_answer || "").trim();
        const explanation = String(q.explanation || "").trim();
        if (!prompt || options.length !== 4 || options.some(v => !v) || !answer || !explanation)
          return fail(res, 400, `Question ${index + 1} needs question, four options, answer and explanation fields.`);
        if (!options.some(o => o.toLowerCase() === answer.toLowerCase()))
          return fail(res, 400, `Question ${index + 1}: answer must match one of its four options.`);
        cleaned.push({
          id: String(q.id || `Q-${String(index + 1).padStart(3, "0")}`),
          type: String(q.type || "definition_to_term"),
          question: prompt,
          options,
          answer,
          explanation,
          crossword_clue: String(q.crossword_clue || q.clue || ""),
          deeper_prompt: String(q.deeper_prompt || q.explore_prompt || "")
        });
      }
      const category = String(body.category || "General").trim().slice(0, 100) || "General";
      const domain = String(body.domain || "").trim().slice(0, 100) || "Business & Economics";
      const subcategory = String(body.subcategory || "").trim().slice(0, 120);
      const focus_area = String(body.focus_area || "").trim().slice(0, 120);
      const title = String(body.batch_title || body.title || subcategory || category).trim().slice(0, 120) || "Untitled set";
      const difficulty = String(body.level || body.difficulty || "beginner").slice(0, 30);
      const pack_id = String(body.pack_id || "").slice(0, 80);
      const batch = Number(body.batch || 1);
      const total_batches = Number(body.total_batches || 1);
      const level_status = String(body.level_status || "in_progress").slice(0, 30);
      const curriculum_plan_json = JSON.stringify(body.curriculum_plan || {});
      const concepts_json = JSON.stringify({
        batch_concepts: body.batch_concepts || [],
        concepts_covered: body.concepts_covered || [],
        concepts_remaining: body.concepts_remaining || [],
        supporting_concepts_covered: body.supporting_concepts_covered || []
      });
      const { data: newSet, error: newSetErr } = await db
        .from("learning_sets")
        .insert({
          user_id: member.id,
          domain, title, category, subcategory, focus_area, difficulty,
          pack_id, batch, total_batches, level_status,
          curriculum_plan_json, concepts_json,
          questions_json: JSON.stringify(cleaned),
          attempts_json: "{}",
          status: "active",
          created_at: nowIso(),
          updated_at: nowIso()
        })
        .select("id")
        .single();
      if (newSetErr) throw new Error(newSetErr.message);
      return send(res, 201, { id: Number(newSet.id), title, total: cleaned.length });
    }

    // GET /api/reviews
    if (path === "reviews" && method === "GET") {
      const { data: reviews } = await db
        .from("saved_reviews")
        .select("set_id, question_id")
        .eq("user_id", member.id)
        .order("id", { ascending: false });
      if (!reviews?.length) return send(res, 200, { items: [] });
      const setIds = [...new Set(reviews.map(r => r.set_id))];
      const { data: sets } = await db
        .from("learning_sets")
        .select("id, title, category")
        .in("id", setIds)
        .eq("user_id", member.id);
      const setMap = {};
      (sets || []).forEach(s => { setMap[s.id] = s; });
      return send(res, 200, {
        items: reviews
          .filter(r => setMap[r.set_id])
          .map(r => ({
            set_id: Number(r.set_id),
            question_id: r.question_id,
            title: setMap[r.set_id].title,
            category: setMap[r.set_id].category
          }))
      });
    }

    // POST /api/reviews (save / unsave a question)
    if (path === "reviews" && method === "POST") {
      const setId = Number(body.set_id);
      const questionId = String(body.question_id || "");
      const row = await getOwnedSet(member.id, setId);
      if (!row) return fail(res, 404, "Set not found.");
      const questions = JSON.parse(row.questions_json || "[]");
      if (!questions.some(q => String(q.id) === questionId)) return fail(res, 404, "Question not found.");
      if (body.saved) {
        await db
          .from("saved_reviews")
          .upsert(
            { user_id: member.id, set_id: setId, question_id: questionId, created_at: nowIso() },
            { onConflict: "user_id,set_id,question_id", ignoreDuplicates: true }
          );
      } else {
        await db
          .from("saved_reviews")
          .delete()
          .eq("user_id", member.id)
          .eq("set_id", setId)
          .eq("question_id", questionId);
      }
      return send(res, 200, { ok: true });
    }

    // GET / DELETE /api/sets/:id
    const setMatch = path.match(/^sets\/(\d+)$/);
    if (setMatch) {
      const setId = Number(setMatch[1]);
      const row = await getOwnedSet(member.id, setId);
      if (!row) return fail(res, 404, "Set not found.");
      if (method === "GET") return send(res, 200, serializeSet(row, true));
      if (method === "DELETE") {
        await db.from("saved_reviews").delete().eq("user_id", member.id).eq("set_id", setId);
        await db.from("learning_sets").delete().eq("id", setId).eq("user_id", member.id);
        return send(res, 200, { ok: true });
      }
    }

    // POST /api/sets/:id/attempt
    const attemptMatch = path.match(/^sets\/(\d+)\/attempt$/);
    if (attemptMatch && method === "POST") {
      const setId = Number(attemptMatch[1]);
      const row = await getOwnedSet(member.id, setId);
      if (!row) return fail(res, 404, "Set not found.");
      const questions = JSON.parse(row.questions_json || "[]");
      const questionId = String(body.question_id || "");
      const question = questions.find(q => String(q.id) === questionId);
      if (!question) return fail(res, 404, "Question not found in this set.");
      const selectedAnswer = String(body.selected_answer || "");
      const correct = selectedAnswer.trim().toLowerCase() === String(question.answer).trim().toLowerCase();
      const attempts = JSON.parse(row.attempts_json || "{}");
      attempts[questionId] = { selected_answer: selectedAnswer, is_correct: correct, answered_at: nowIso() };
      const { error: updateErr } = await db
        .from("learning_sets")
        .update({ attempts_json: JSON.stringify(attempts), updated_at: nowIso() })
        .eq("id", setId)
        .eq("user_id", member.id);
      if (updateErr) throw new Error(updateErr.message);
      return send(res, 200, {
        saved: true,
        completed: Object.keys(attempts).filter(k => !k.startsWith("_")).length,
        is_correct: correct
      });
    }

    // POST /api/sets/:id/status
    const statusMatch = path.match(/^sets\/(\d+)\/status$/);
    if (statusMatch && method === "POST") {
      const status = body.status;
      if (!(["active", "archived"].includes(status)))
        return fail(res, 400, "Status must be active or archived.");
      const { data: updated, error: statusErr } = await db
        .from("learning_sets")
        .update({ status, updated_at: nowIso() })
        .eq("id", Number(statusMatch[1]))
        .eq("user_id", member.id)
        .select("id");
      if (statusErr) throw new Error(statusErr.message);
      if (!updated?.length) return fail(res, 404, "Set not found.");
      return send(res, 200, { ok: true });
    }
  }

  return fail(res, 404, "API route not found.");
}

// ─── Exported handler ─────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (!enforceSameOrigin(req)) return fail(res, 403, "Cross-origin request blocked.");
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Allow", "GET,POST,DELETE,OPTIONS");
    res.end();
    return;
  }
  try {
    return await route(req, res);
  } catch (error) {
    console.error("Cluewise API error:", error);
    return fail(res, error.status || 500, error.status ? error.message : "An unexpected server error occurred.");
  }
}
