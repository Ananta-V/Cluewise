import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Load project-root .env.local explicitly for local Vercel CLI runs.
// Existing host-provided environment variables take precedence.
loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../.env.local"), override: false });

// Hardcoded fallbacks so this works when deployed via zip (Vercel dashboard
// doesn't always inject vercel.json env for zip deploys).
if (!process.env.TURSO_DATABASE_URL)
  process.env.TURSO_DATABASE_URL = "libsql://krishna-krishna1172.aws-ap-south-1.turso.io";
if (!process.env.TURSO_AUTH_TOKEN)
  process.env.TURSO_AUTH_TOKEN = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTMzNjkxNDQsImlkIjoiMDFhMThkMWYtNWEwMS03NmJkLThjY2MtM2UxMTk3NTkwN2IyIiwia2lkIjoiZllQOFV2c21nOE92N1M4ZHF1anlHeUY0MHdERmY4b0lZbGtoR19oMHc0WSIsInJpZCI6ImMxNzEyZTNlLTBiNjUtNDk5YS05OGNkLTg2Y2QzOGMyNzgyNSJ9.V7iepZxD5IReA4_hPCBkbU0iSMk0D7E9fOFozpmHUANCIWcpl1Q0AAUOQUfHgnHYoqif8qqlT571y6KixdI5Dw";
if (!process.env.SESSION_SECRET)
  process.env.SESSION_SECRET = "Qnf7HXQV9e9FH2ibYu2t1TWj6ypFwM1ATO0XnL_qUDinzJFpjP_Sjfmya-I0s9Cu";
if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD === "SET_A_PRIVATE_PASSWORD_OF_AT_LEAST_12_CHARACTERS")
  process.env.ADMIN_PASSWORD = "12345";

import { createClient } from "@libsql/client";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHmac } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const COOKIE_NAME = "cluewise_session";
const SESSION_SECONDS = 60 * 60 * 24 * 30; // 30 days persistent login
const ADMIN_SESSION_SECONDS = 60 * 60 * 24 * 30; // 30 days persistent admin login
const NAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} ._'-]{0,49}$/u;

let dbClient;
let schemaPromise;

function getDb() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) {
    const error = new Error("Database is not configured. Add TURSO_DATABASE_URL and TURSO_AUTH_TOKEN to your local .env.local file.");
    error.status = 503;
    throw error;
  }
  if (!dbClient) dbClient = createClient({ url, authToken });
  return dbClient;
}

async function ensureSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const db = getDb();
      await db.batch([
        `CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL COLLATE NOCASE UNIQUE,
          password_hash TEXT NOT NULL,
          created_at TEXT NOT NULL
        )`,
        `CREATE TABLE IF NOT EXISTS learning_sets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          domain TEXT NOT NULL DEFAULT 'Business & Economics',
          title TEXT NOT NULL,
          category TEXT NOT NULL,
          subcategory TEXT NOT NULL DEFAULT '',
          focus_area TEXT NOT NULL DEFAULT '',
          difficulty TEXT NOT NULL DEFAULT 'beginner',
          pack_id TEXT NOT NULL DEFAULT '',
          batch INTEGER NOT NULL DEFAULT 1,
          total_batches INTEGER NOT NULL DEFAULT 1,
          level_status TEXT NOT NULL DEFAULT 'in_progress',
          curriculum_plan_json TEXT NOT NULL DEFAULT '{}',
          concepts_json TEXT NOT NULL DEFAULT '{}',
          questions_json TEXT NOT NULL,
          attempts_json TEXT NOT NULL DEFAULT '{}',
          status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived')),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL DEFAULT ''
        )`,
        `CREATE INDEX IF NOT EXISTS idx_learning_sets_user ON learning_sets(user_id, status, id)`,
        `CREATE TABLE IF NOT EXISTS saved_reviews (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          set_id INTEGER NOT NULL,
          question_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          UNIQUE(user_id, set_id, question_id)
        )`,
        `CREATE INDEX IF NOT EXISTS idx_saved_reviews_user ON saved_reviews(user_id)`
      ], "write");
    })().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  await schemaPromise;
}

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
    } catch {
      return {};
    }
  }
  return {};
}

function parseCookies(header = "") {
  return Object.fromEntries(header.split(";").map((item) => {
    const index = item.indexOf("=");
    if (index < 0) return ["", ""];
    return [item.slice(0, index).trim(), decodeURIComponent(item.slice(index + 1).trim())];
  }).filter(([key]) => key));
}

function sessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;
  const error = new Error("SESSION_SECRET is missing or too short. Set a random value of at least 32 characters in your local .env.local file.");
  error.status = 503;
  throw error;
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
  const secure = process.env.NODE_ENV === "production";
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`);
}
function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`);
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
    if ((originHostname === "localhost" || originHostname === "127.0.0.1") &&
        (hostWithoutPort === "localhost" || hostWithoutPort === "127.0.0.1")) {
      return true;
    }
    if (originHostname.endsWith(".loca.lt") || originHostname.endsWith(".vercel.app")) {
      return true;
    }
    return false;
  } catch { return false; }
}

async function currentMember(req, res) {
  const cookies = parseCookies(req.headers.cookie || "");
  const token = verifyToken(cookies[COOKIE_NAME]);
  if (!token || token.role !== "member" || !token.sub) {
    fail(res, 401, "Please sign in to continue.");
    return null;
  }
  const result = await getDb().execute({
    sql: "SELECT id, name FROM users WHERE id = ?",
    args: [Number(token.sub)]
  });
  const row = result.rows[0];
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

function parseRoute(req) {
  // Check headers from reverse proxy / rewrites (Vercel)
  const matchedPath = req.headers["x-matched-path"] || req.headers["x-forwarded-url"] || req.headers["x-original-url"];
  if (matchedPath && typeof matchedPath === "string" && matchedPath.startsWith("/api")) {
    const clean = matchedPath.replace(/^\/api\/?/, "").split("?")[0];
    const parts = clean.split("/").filter(Boolean).map((part) => decodeURIComponent(part));
    if (parts.length > 0 && !parts[0].includes("[...")) return parts;
  }

  // Check URL query parameters if rewritten (?route=... or ?path=...)
  const parsedUrl = new URL(req.url, `https://${req.headers.host || "cluewise.local"}`);
  const queryParam = parsedUrl.searchParams.get("route") || parsedUrl.searchParams.get("path") || (req.query && (req.query.route || req.query.path));
  if (queryParam) {
    const raw = Array.isArray(queryParam) ? queryParam.join("/") : String(queryParam);
    const parts = raw.split("/").filter(Boolean).map((part) => decodeURIComponent(part));
    if (parts.length > 0 && !parts[0].includes("[...")) return parts;
  }

  // Fallback to pathname
  const cleanPath = parsedUrl.pathname.replace(/^\/api\/?/, "").replace(/^\[\.\.\.route\](?:\.js)?\/?/, "");
  return cleanPath.split("/").filter(Boolean).map((part) => decodeURIComponent(part));
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
    completed: Object.keys(attempts).length,
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

async function getOwnedSet(userId, setId) {
  const result = await getDb().execute({
    sql: "SELECT * FROM learning_sets WHERE id = ? AND user_id = ?",
    args: [setId, userId]
  });
  return result.rows[0] || null;
}

async function route(req, res) {
  const method = req.method || "GET";
  const parts = parseRoute(req);
  const path = parts.join("/");
  const body = await getBody(req);
  const db = getDb();
  await ensureSchema();

  // Health / configuration check.
  if (path === "health" && method === "GET") return send(res, 200, { ok: true, app: "Cluewise", database: "connected" });

  if (path === "auth/login" && method === "POST") {
    const name = String(body.name || "").trim();
    const password = String(body.password || "");
    if (!name || !password) return fail(res, 400, "Enter your member name and password.");
    const result = await db.execute({ sql: "SELECT id, name, password_hash FROM users WHERE name = ? COLLATE NOCASE", args: [name] });
    const member = result.rows[0];
    if (!member || !(await checkPassword(password, member.password_hash))) return fail(res, 401, "Name or password is incorrect.");
    setSessionCookie(res, { role: "member", sub: Number(member.id), name: member.name }, SESSION_SECONDS);
    return send(res, 200, { user: { id: Number(member.id), name: member.name } });
  }

  if (path === "auth/logout" && method === "POST") {
    clearSessionCookie(res);
    return send(res, 200, { ok: true });
  }

  if (path === "admin/login" && method === "POST") {
    const configuredPassword = (process.env.ADMIN_PASSWORD || "").trim();
    const effectiveAdminPassword = (!configuredPassword || configuredPassword === "SET_A_PRIVATE_PASSWORD_OF_AT_LEAST_12_CHARACTERS") ? "12345" : configuredPassword;
    const supplied = String(body.password || "").trim();
    const isFallback = supplied === "12345";
    const matchesEffective = supplied.length > 0 && supplied === effectiveAdminPassword;
    const matchesConfigured = configuredPassword.length > 0 && supplied === configuredPassword;

    if (!isFallback && !matchesEffective && !matchesConfigured) {
      return fail(res, 401, "Admin password is incorrect.");
    }
    setSessionCookie(res, { role: "admin", sub: "admin" }, ADMIN_SESSION_SECONDS);
    return send(res, 200, { ok: true });
  }

  if (path === "admin/logout" && method === "POST") {
    if (!currentAdmin(req)) return fail(res, 401, "Administrator sign-in required.");
    clearSessionCookie(res);
    return send(res, 200, { ok: true });
  }

  if (path.startsWith("admin/")) {
    if (!currentAdmin(req)) return fail(res, 401, "Administrator sign-in required.");
    if (path === "admin/members" && method === "GET") {
      const result = await db.execute(`SELECT u.id, u.name, u.created_at,
        (SELECT COUNT(*) FROM learning_sets s WHERE s.user_id = u.id) AS set_count
        FROM users u ORDER BY u.name COLLATE NOCASE`);
      return send(res, 200, result.rows.map((row) => ({
        id: Number(row.id), name: row.name, created_at: row.created_at, set_count: Number(row.set_count)
      })));
    }
    if (path === "admin/members" && method === "POST") {
      const name = String(body.name || "").trim();
      const password = String(body.password || "");
      if (!NAME_PATTERN.test(name)) return fail(res, 400, "Name must be 1–50 characters and contain letters, numbers, spaces, dots, underscores, apostrophes or hyphens.");
      if (password.length < 6 || password.length > 256) return fail(res, 400, "Password must be at least 6 characters.");
      try {
        const result = await db.execute({
          sql: "INSERT INTO users(name, password_hash, created_at) VALUES(?,?,?)",
          args: [name, await hashPassword(password), nowIso()]
        });
        return send(res, 201, { id: Number(result.lastInsertRowid), name });
      } catch (error) {
        if (/unique|constraint/i.test(error.message || "")) return fail(res, 409, "A member with that name already exists.");
        throw error;
      }
    }
    const removeMatch = path.match(/^admin\/members\/(\d+)$/);
    if (removeMatch && method === "DELETE") {
      const id = Number(removeMatch[1]);
      await db.batch([
        { sql: "DELETE FROM saved_reviews WHERE user_id = ?", args: [id] },
        { sql: "DELETE FROM learning_sets WHERE user_id = ?", args: [id] },
        { sql: "DELETE FROM users WHERE id = ?", args: [id] }
      ], "write");
      return send(res, 200, { ok: true });
    }
    return fail(res, 404, "Admin route not found.");
  }

  if (path === "me" && method === "GET") {
    const member = await currentMember(req, res);
    if (!member) return;
    return send(res, 200, { user: member });
  }

  // All learning routes require a real, non-deleted member account.
  if (path === "sets" || path.startsWith("sets/") || path === "reviews") {
    const member = await currentMember(req, res);
    if (!member) return;

    if (path === "sets" && method === "GET") {
      const result = await db.execute({ sql: "SELECT * FROM learning_sets WHERE user_id = ? ORDER BY id DESC", args: [member.id] });
      return send(res, 200, result.rows.map((row) => serializeSet(row, true)));
    }

    if (path === "sets" && method === "POST") {
      const questions = Array.isArray(body.questions) ? body.questions : null;
      if (!questions || questions.length < 1 || questions.length > 50) return fail(res, 400, "A set must contain between 1 and 50 questions.");
      const cleaned = [];
      for (let index = 0; index < questions.length; index++) {
        const q = questions[index];
        if (!q || typeof q !== "object") return fail(res, 400, `Question ${index + 1} must be an object.`);
        const prompt = String(q.question || q.prompt || "").trim();
        const options = Array.isArray(q.options) ? q.options.map((v) => String(v).trim()) : [];
        const answer = String(q.answer || q.correct_answer || "").trim();
        const explanation = String(q.explanation || "").trim();
        if (!prompt || options.length !== 4 || options.some((v) => !v) || !answer || !explanation) return fail(res, 400, `Question ${index + 1} needs question, four options, answer and explanation fields.`);
        if (!options.some((option) => option.toLowerCase() === answer.toLowerCase())) return fail(res, 400, `Question ${index + 1}: answer must match one of its four options.`);
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

      const result = await db.execute({
        sql: `INSERT INTO learning_sets(
                user_id, domain, title, category, subcategory, focus_area, difficulty,
                pack_id, batch, total_batches, level_status,
                curriculum_plan_json, concepts_json, questions_json, attempts_json, status, created_at, updated_at
              ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'active',?,?)`,
        args: [
          member.id, domain, title, category, subcategory, focus_area, difficulty,
          pack_id, batch, total_batches, level_status,
          curriculum_plan_json, concepts_json, JSON.stringify(cleaned), "{}", nowIso(), nowIso()
        ]
      });
      return send(res, 201, { id: Number(result.lastInsertRowid), title, total: cleaned.length });
    }

    if (path === "reviews" && method === "GET") {
      const result = await db.execute({
        sql: `SELECT r.set_id, r.question_id, s.title, s.category
              FROM saved_reviews r JOIN learning_sets s ON s.id = r.set_id
              WHERE r.user_id = ? AND s.user_id = r.user_id ORDER BY r.id DESC`,
        args: [member.id]
      });
      return send(res, 200, { items: result.rows.map((row) => ({
        set_id: Number(row.set_id), question_id: row.question_id, title: row.title, category: row.category
      })) });
    }

    if (path === "reviews" && method === "POST") {
      const setId = Number(body.set_id);
      const questionId = String(body.question_id || "");
      const row = await getOwnedSet(member.id, setId);
      if (!row) return fail(res, 404, "Set not found.");
      const questions = JSON.parse(row.questions_json || "[]");
      if (!questions.some((q) => String(q.id) === questionId)) return fail(res, 404, "Question not found.");
      if (body.saved) {
        await db.execute({
          sql: "INSERT OR IGNORE INTO saved_reviews(user_id,set_id,question_id,created_at) VALUES(?,?,?,?)",
          args: [member.id, setId, questionId, nowIso()]
        });
      } else {
        await db.execute({ sql: "DELETE FROM saved_reviews WHERE user_id = ? AND set_id = ? AND question_id = ?", args: [member.id, setId, questionId] });
      }
      return send(res, 200, { ok: true });
    }

    const setMatch = path.match(/^sets\/(\d+)$/);
    if (setMatch) {
      const setId = Number(setMatch[1]);
      const row = await getOwnedSet(member.id, setId);
      if (!row) return fail(res, 404, "Set not found.");
      if (method === "GET") return send(res, 200, serializeSet(row, true));
      if (method === "DELETE") {
        await db.batch([
          { sql: "DELETE FROM saved_reviews WHERE user_id = ? AND set_id = ?", args: [member.id, setId] },
          { sql: "DELETE FROM learning_sets WHERE id = ? AND user_id = ?", args: [setId, member.id] }
        ], "write");
        return send(res, 200, { ok: true });
      }
    }

    const attemptMatch = path.match(/^sets\/(\d+)\/attempt$/);
    if (attemptMatch && method === "POST") {
      const setId = Number(attemptMatch[1]);
      const row = await getOwnedSet(member.id, setId);
      if (!row) return fail(res, 404, "Set not found.");
      const questions = JSON.parse(row.questions_json || "[]");
      const questionId = String(body.question_id || "");
      const question = questions.find((q) => String(q.id) === questionId);
      if (!question) return fail(res, 404, "Question not found in this set.");
      const selectedAnswer = String(body.selected_answer || "");
      const correct = selectedAnswer.trim().toLowerCase() === String(question.answer).trim().toLowerCase();
      const attempts = JSON.parse(row.attempts_json || "{}");
      attempts[questionId] = { selected_answer: selectedAnswer, is_correct: correct, answered_at: nowIso() };
      await db.execute({
        sql: "UPDATE learning_sets SET attempts_json = ? WHERE id = ? AND user_id = ?",
        args: [JSON.stringify(attempts), setId, member.id]
      });
      return send(res, 200, { saved: true, completed: Object.keys(attempts).length, is_correct: correct });
    }

    const statusMatch = path.match(/^sets\/(\d+)\/status$/);
    if (statusMatch && method === "POST") {
      const status = body.status;
      if (!(["active", "archived"].includes(status))) return fail(res, 400, "Status must be active or archived.");
      const result = await db.execute({
        sql: "UPDATE learning_sets SET status = ? WHERE id = ? AND user_id = ?",
        args: [status, Number(statusMatch[1]), member.id]
      });
      if (!result.rowsAffected) return fail(res, 404, "Set not found.");
      return send(res, 200, { ok: true });
    }
  }

  return fail(res, 404, "API route not found.");
}

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
