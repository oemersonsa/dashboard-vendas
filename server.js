const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");

loadEnvFile(path.join(__dirname, ".env"));

const PORT = Number(process.env.PORT || 3000);
const APP_ORIGIN = String(process.env.APP_ORIGIN || `http://localhost:${PORT}`).replace(/\/$/, "");
const GOOGLE_CLIENT_ID = String(process.env.GOOGLE_CLIENT_ID || "").trim();
const GOOGLE_CLIENT_SECRET = String(process.env.GOOGLE_CLIENT_SECRET || "").trim();
const GOOGLE_REDIRECT_URI = String(process.env.GOOGLE_REDIRECT_URI || `${APP_ORIGIN}/api/google-drive/oauth/callback`).trim();
const GOOGLE_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata";
const GOOGLE_DRIVE_FILE_NAME = "dashboard-vendas-state.json";
const TOKEN_STORE_FILE = path.join(__dirname, ".data", "google-drive-connections.json");
const SESSION_STORE_FILE = path.join(__dirname, ".data", "sessions.json");
const USER_STORE_FILE = path.join(__dirname, ".data", "users.json");
const CALLBACK_HTML_TITLE = "Google Drive conectado";
const FETCH_TIMEOUT_MS = 15_000;

// ─── Rate limiting ────────────────────────────────────────────────────────────
// Max requests per window per IP on /api/* routes
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;
const rateLimitMap = new Map(); // ip -> { count, windowStart }

// ─── Static file map ──────────────────────────────────────────────────────────
const STATIC_FILES = new Map([
  ["/", "index.html"],
  ["/index.html", "index.html"],
  ["/app.js", "app.js"],
  ["/styles.css", "styles.css"],
  ["/google-config.js", "google-config.js"],
  ["/favicon.svg", "favicon.svg"],
]);

// ─── In-memory state ─────────────────────────────────────────────────────────
const pendingOAuthStates = new Map(); // state -> { username, createdAt }
let tokenStoreLock = false;
let tokenStoreLockQueue = [];
let userStoreLock = false;
let userStoreLockQueue = [];

// ─── Logger ───────────────────────────────────────────────────────────────────
const logger = {
  _fmt(level, msg, meta) {
    const ts = new Date().toISOString();
    const metaStr = meta ? " " + JSON.stringify(meta) : "";
    return `[${ts}] [${level}] ${msg}${metaStr}`;
  },
  info(msg, meta) { console.log(this._fmt("INFO ", msg, meta)); },
  warn(msg, meta) { console.warn(this._fmt("WARN ", msg, meta)); },
  error(msg, meta) { console.error(this._fmt("ERROR", msg, meta)); },
};

// ─── .env loader ─────────────────────────────────────────────────────────────
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8");
  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const sep = trimmed.indexOf("=");
    if (sep <= 0) return;
    const key = trimmed.slice(0, sep).trim();
    let value = trimmed.slice(sep + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function isGoogleBackendConfigured() {
  return Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_REDIRECT_URI);
}

function ensureDataDir() {
  fs.mkdirSync(path.dirname(TOKEN_STORE_FILE), { recursive: true });
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function acquireUserStoreLock() {
  return new Promise((resolve) => {
    if (!userStoreLock) {
      userStoreLock = true;
      resolve();
    } else {
      userStoreLockQueue.push(resolve);
    }
  });
}

function releaseUserStoreLock() {
  if (userStoreLockQueue.length > 0) {
    const next = userStoreLockQueue.shift();
    next();
  } else {
    userStoreLock = false;
  }
}

// ─── Token store with mutex ───────────────────────────────────────────────────
function acquireTokenStoreLock() {
  return new Promise((resolve) => {
    if (!tokenStoreLock) {
      tokenStoreLock = true;
      resolve();
    } else {
      tokenStoreLockQueue.push(resolve);
    }
  });
}

function releaseTokenStoreLock() {
  if (tokenStoreLockQueue.length > 0) {
    const next = tokenStoreLockQueue.shift();
    next();
  } else {
    tokenStoreLock = false;
  }
}

function readTokenStore() {
  ensureDataDir();
  if (!fs.existsSync(TOKEN_STORE_FILE)) return { users: {} };
  try {
    return JSON.parse(fs.readFileSync(TOKEN_STORE_FILE, "utf8"));
  } catch {
    return { users: {} };
  }
}

function writeTokenStore(store) {
  ensureDataDir();
  fs.writeFileSync(TOKEN_STORE_FILE, JSON.stringify(store, null, 2));
}

function getUserConnection(username) {
  if (!username) return null;
  const store = readTokenStore();
  return store.users?.[username] || null;
}

async function saveUserConnection(username, connection) {
  await acquireTokenStoreLock();
  try {
    const store = readTokenStore();
    if (!store.users) store.users = {};
    store.users[username] = connection;
    writeTokenStore(store);
  } finally {
    releaseTokenStoreLock();
  }
}

function readUserStore() {
  ensureDataDir();
  if (!fs.existsSync(USER_STORE_FILE)) return { users: {} };
  try {
    return JSON.parse(fs.readFileSync(USER_STORE_FILE, "utf8"));
  } catch {
    return { users: {} };
  }
}

function writeUserStore(store) {
  ensureDataDir();
  fs.writeFileSync(USER_STORE_FILE, JSON.stringify(store, null, 2));
}

function getUserRecord(username) {
  if (!username) return null;
  const store = readUserStore();
  return store.users?.[username] || null;
}

async function saveUserRecord(username, userRecord) {
  await acquireUserStoreLock();
  try {
    const store = readUserStore();
    if (!store.users) store.users = {};
    store.users[username] = userRecord;
    writeUserStore(store);
  } finally {
    releaseUserStoreLock();
  }
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(String(password || ""), salt, 64).toString("hex");
  return `scrypt:${salt}:${derived}`;
}

function verifyPassword(password, passwordHash) {
  const [scheme, salt, storedHash] = String(passwordHash || "").split(":");
  if (scheme !== "scrypt" || !salt || !storedHash) return false;
  const candidate = crypto.scryptSync(String(password || ""), salt, 64);
  const expected = Buffer.from(storedHash, "hex");
  if (candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
}

function isValidGoogleIssuer(value) {
  return value === "accounts.google.com" || value === "https://accounts.google.com";
}

// ─── Session store ────────────────────────────────────────────────────────────
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function readSessionStore() {
  ensureDataDir();
  if (!fs.existsSync(SESSION_STORE_FILE)) return { sessions: {} };
  try {
    return JSON.parse(fs.readFileSync(SESSION_STORE_FILE, "utf8"));
  } catch {
    return { sessions: {} };
  }
}

function writeSessionStore(store) {
  ensureDataDir();
  fs.writeFileSync(SESSION_STORE_FILE, JSON.stringify(store, null, 2));
}

function createSession(username) {
  const token = crypto.randomBytes(32).toString("hex");
  const store = readSessionStore();
  if (!store.sessions) store.sessions = {};
  store.sessions[token] = { username, createdAt: Date.now() };
  writeSessionStore(store);
  return token;
}

function validateSession(token) {
  if (!token) return null;
  const store = readSessionStore();
  const session = store.sessions?.[String(token)];
  if (!session) return null;
  if (Date.now() - session.createdAt > SESSION_TTL_MS) {
    delete store.sessions[token];
    writeSessionStore(store);
    return null;
  }
  return session.username;
}

function deleteSession(token) {
  if (!token) return;
  const store = readSessionStore();
  if (store.sessions?.[token]) {
    delete store.sessions[token];
    writeSessionStore(store);
  }
}

function cleanupExpiredSessions() {
  const store = readSessionStore();
  const now = Date.now();
  let changed = false;
  for (const [token, session] of Object.entries(store.sessions || {})) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      delete store.sessions[token];
      changed = true;
    }
  }
  if (changed) writeSessionStore(store);
}

// ─── Access token cache (per username) ───────────────────────────────────────
const accessTokenCache = new Map(); // username -> { token, expiresAt }
const ACCESS_TOKEN_SKEW_MS = 60_000;

function getCachedAccessToken(username) {
  const entry = accessTokenCache.get(username);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt - ACCESS_TOKEN_SKEW_MS) {
    accessTokenCache.delete(username);
    return null;
  }
  return entry.token;
}

function setCachedAccessToken(username, token, expiresInSeconds) {
  accessTokenCache.set(username, {
    token,
    expiresAt: Date.now() + (expiresInSeconds || 3600) * 1000,
  });
}

// ─── Rate limiter ─────────────────────────────────────────────────────────────
function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

function getClientIp(req) {
  return (
    String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────
function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function sendHtml(res, statusCode, html) {
  res.writeHead(statusCode, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(html);
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(text);
}

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", APP_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
}

async function readJsonBody(req) {
  const contentType = req.headers["content-type"] || "";
  if (!contentType.includes("application/json")) {
    throw new Error("invalid_content_type");
  }
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > 10 * 1024 * 1024) throw new Error("request_too_large");
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

// ─── Auth middleware ──────────────────────────────────────────────────────────
function extractSessionToken(req, url = null) {
  // Accept token from Authorization header: "Bearer <token>"
  const auth = String(req.headers["authorization"] || "");
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim();
  if (url) {
    const tokenFromQuery = String(url.searchParams.get("sessionToken") || "").trim();
    if (tokenFromQuery) return tokenFromQuery;
  }
  return null;
}

// ─── OAuth popup HTML ─────────────────────────────────────────────────────────
function buildPopupResponse({ success, username = "", sessionToken = "", error = "" }) {
  const payload = JSON.stringify({
    type: "google-drive-connected",
    success,
    username,
    sessionToken,
    error,
  });
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${CALLBACK_HTML_TITLE}</title>
  <style>
    body{font-family:Arial,sans-serif;padding:24px;background:#f5f5f5;color:#111}
    .card{max-width:420px;margin:40px auto;padding:24px;border-radius:16px;background:#fff;box-shadow:0 12px 32px rgba(0,0,0,.08)}
    h1{font-size:20px;margin:0 0 10px}
    p{margin:0;color:#444;line-height:1.5}
  </style>
</head>
<body>
  <div class="card">
    <h1>${success ? "Google Drive conectado" : "Falha ao conectar o Google Drive"}</h1>
    <p>${success
      ? "Voce ja pode voltar para o dashboard. Esta janela sera fechada automaticamente."
      : escapeHtml(error || "Nao foi possivel concluir a autorizacao.")
    }</p>
  </div>
  <script>
    const payload = ${payload};
    if (window.opener) {
      window.opener.postMessage(payload, ${JSON.stringify(APP_ORIGIN)});
    }
    setTimeout(() => window.close(), 1200);
  </script>
</body>
</html>`;
}

// ─── JWT decoder (id_token) ───────────────────────────────────────────────────
function decodeJwtPayload(token) {
  try {
    const [, payload] = String(token || "").split(".");
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

// ─── Fetch with timeout ───────────────────────────────────────────────────────
async function fetchWithTimeout(url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err.name === "AbortError") throw new Error("external_request_timeout");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Google OAuth ─────────────────────────────────────────────────────────────
async function exchangeAuthorizationCode(code) {
  const response = await fetchWithTimeout("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });
  if (!response.ok) throw new Error("google_token_exchange_failed");
  return response.json();
}

async function refreshAccessToken(refreshToken) {
  const response = await fetchWithTimeout("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok) throw new Error("google_refresh_failed");
  return response.json();
}

// ─── Google Drive helpers ─────────────────────────────────────────────────────
async function fetchDriveJson(accessToken, url, options = {}) {
  const response = await fetchWithTimeout(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    // Don't leak Google's raw error body to the client
    logger.error("Google Drive request failed", { url, status: response.status });
    throw new Error(`${options.errorCode || "google_drive_request_failed"}_${response.status}`);
  }
  return response.json();
}

async function getDriveAccessTokenForUser(username) {
  if (!isGoogleBackendConfigured()) throw new Error("google_drive_backend_not_configured");

  const cached = getCachedAccessToken(username);
  if (cached) {
    const connection = getUserConnection(username);
    return { accessToken: cached, connection };
  }

  const connection = getUserConnection(username);
  if (!connection?.refreshToken) throw new Error("google_drive_not_connected");

  const refreshed = await refreshAccessToken(connection.refreshToken);
  const accessToken = String(refreshed.access_token || "");
  const expiresIn = Number(refreshed.expires_in || 3600);
  setCachedAccessToken(username, accessToken, expiresIn);

  return { accessToken, connection };
}

async function findDriveFile(accessToken) {
  const query = encodeURIComponent(
    `name='${GOOGLE_DRIVE_FILE_NAME}' and 'appDataFolder' in parents and trashed=false`
  );
  const data = await fetchDriveJson(
    accessToken,
    `https://www.googleapis.com/drive/v3/files?q=${query}&spaces=appDataFolder&fields=files(id,name,modifiedTime)&pageSize=1`,
    { errorCode: "google_drive_lookup_failed" }
  );
  return data.files?.[0] || null;
}

async function uploadBackupForUser(username, payload) {
  const { accessToken, connection } = await getDriveAccessTokenForUser(username);
  const metadata = await findDriveFile(accessToken);
  const boundary = `dashboard-vendas-${Date.now()}`;
  const bodyPayload = JSON.stringify(payload, null, 2);
  const fileMetadata = metadata?.id
    ? { name: GOOGLE_DRIVE_FILE_NAME, mimeType: "application/json" }
    : { name: GOOGLE_DRIVE_FILE_NAME, mimeType: "application/json", parents: ["appDataFolder"] };

  const multipartBody =
    `--${boundary}\r\n` +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    `${JSON.stringify(fileMetadata)}\r\n` +
    `--${boundary}\r\n` +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    `${bodyPayload}\r\n` +
    `--${boundary}--`;

  const endpoint = metadata?.id
    ? `https://www.googleapis.com/upload/drive/v3/files/${metadata.id}?uploadType=multipart&fields=id,modifiedTime`
    : "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,modifiedTime";

  const response = await fetchWithTimeout(endpoint, {
    method: metadata?.id ? "PATCH" : "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
  });

  if (!response.ok) {
    logger.error("Google Drive upload failed", { status: response.status, username });
    throw new Error(`google_drive_upload_failed_${response.status}`);
  }

  const result = await response.json();
  const nextConnection = {
    ...connection,
    fileId: String(result.id || ""),
    modifiedTime: String(result.modifiedTime || new Date().toISOString()),
    updatedAt: new Date().toISOString(),
  };
  await saveUserConnection(username, nextConnection);

  return {
    action: metadata?.id ? "updated" : "created",
    fileId: nextConnection.fileId,
    modifiedTime: nextConnection.modifiedTime,
    email: nextConnection.email || "",
  };
}

async function restoreBackupForUser(username) {
  const { accessToken, connection } = await getDriveAccessTokenForUser(username);
  const metadata = await findDriveFile(accessToken);
  if (!metadata?.id) throw new Error("google_drive_file_not_found");

  const response = await fetchWithTimeout(
    `https://www.googleapis.com/drive/v3/files/${metadata.id}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!response.ok) {
    logger.error("Google Drive download failed", { status: response.status, username });
    throw new Error(`google_drive_download_failed_${response.status}`);
  }

  const payload = await response.json();
  const nextConnection = {
    ...connection,
    fileId: String(metadata.id || ""),
    modifiedTime: String(metadata.modifiedTime || ""),
    updatedAt: new Date().toISOString(),
  };
  await saveUserConnection(username, nextConnection);

  return {
    payload,
    fileId: nextConnection.fileId,
    modifiedTime: nextConnection.modifiedTime,
    email: nextConnection.email || "",
  };
}

// ─── Route handlers ───────────────────────────────────────────────────────────

// POST /api/auth/login  { username, password }  → { sessionToken }
async function handleAuthLogin(req, res) {
  const body = await readJsonBody(req);
  const username = String(body?.username || "").trim();
  const password = String(body?.password || "");
  if (!username || !password) {
    sendJson(res, 400, { error: "username_and_password_required" });
    return;
  }
  const user = getUserRecord(username);
  if (!user || user.provider !== "local" || !verifyPassword(password, user.passwordHash)) {
    sendJson(res, 401, { error: "invalid_credentials" });
    return;
  }
  const token = createSession(username);
  logger.info("Session created", { username });
  sendJson(res, 200, { sessionToken: token });
}

// POST /api/auth/register  { username, password }  → { sessionToken }
async function handleAuthRegister(req, res) {
  const body = await readJsonBody(req);
  const username = String(body?.username || "").trim();
  const password = String(body?.password || "");
  if (!username || !password) {
    sendJson(res, 400, { error: "username_and_password_required" });
    return;
  }
  if (password.length < 4) {
    sendJson(res, 400, { error: "password_too_short" });
    return;
  }
  if (getUserRecord(username)) {
    sendJson(res, 409, { error: "user_already_exists" });
    return;
  }

  await saveUserRecord(username, {
    provider: "local",
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const token = createSession(username);
  logger.info("Local user created", { username });
  sendJson(res, 201, { sessionToken: token });
}

// POST /api/auth/migrate-local  { username, password }  → { ok }
async function handleAuthMigrateLocal(req, res) {
  const body = await readJsonBody(req);
  const username = String(body?.username || "").trim();
  const password = String(body?.password || "");
  if (!username || !password) {
    sendJson(res, 400, { error: "username_and_password_required" });
    return;
  }
  const existing = getUserRecord(username);
  if (!existing) {
    await saveUserRecord(username, {
      provider: "local",
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    logger.info("Legacy local auth migrated", { username });
    sendJson(res, 200, { ok: true, migrated: true });
    return;
  }
  if (existing.provider !== "local") {
    sendJson(res, 409, { error: "provider_mismatch" });
    return;
  }
  if (!verifyPassword(password, existing.passwordHash)) {
    sendJson(res, 409, { error: "migration_password_mismatch" });
    return;
  }
  sendJson(res, 200, { ok: true, migrated: false });
}

// POST /api/auth/google-login  { credential }  → { sessionToken, username }
async function handleGoogleAuthLogin(req, res) {
  const body = await readJsonBody(req);
  const credential = String(body?.credential || "").trim();
  if (!credential) {
    sendJson(res, 400, { error: "credential_required" });
    return;
  }

  const payload = decodeJwtPayload(credential);
  const username = String(payload?.email || "").trim();
  const googleSub = String(payload?.sub || "").trim();
  const audience = String(payload?.aud || "").trim();
  const issuer = String(payload?.iss || "").trim();
  const expiresAt = Number(payload?.exp || 0) * 1000;

  if (!username || !googleSub || payload?.email_verified === false) {
    sendJson(res, 401, { error: "invalid_google_credential" });
    return;
  }
  if (!isValidGoogleIssuer(issuer)) {
    sendJson(res, 401, { error: "invalid_google_issuer" });
    return;
  }
  if (GOOGLE_CLIENT_ID && audience !== GOOGLE_CLIENT_ID) {
    sendJson(res, 401, { error: "invalid_google_audience" });
    return;
  }
  if (!expiresAt || Date.now() >= expiresAt) {
    sendJson(res, 401, { error: "expired_google_credential" });
    return;
  }

  const existing = getUserRecord(username);
  if (existing && existing.provider !== "google") {
    sendJson(res, 409, { error: "provider_mismatch" });
    return;
  }
  if (existing?.googleSub && existing.googleSub !== googleSub) {
    sendJson(res, 403, { error: "google_account_mismatch" });
    return;
  }

  await saveUserRecord(username, {
    provider: "google",
    googleSub,
    googleEmail: username,
    googleName: String(payload?.name || existing?.googleName || username),
    googlePicture: String(payload?.picture || existing?.googlePicture || ""),
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const token = createSession(username);
  logger.info("Google user session created", { username });
  sendJson(res, 200, { sessionToken: token, username });
}

// POST /api/auth/logout
async function handleAuthLogout(req, res) {
  const token = extractSessionToken(req);
  if (token) deleteSession(token);
  sendJson(res, 200, { ok: true });
}

// POST /api/auth/change-password  { username, currentPassword, newPassword }
async function handleAuthChangePassword(req, res, authenticatedUser) {
  const body = await readJsonBody(req);
  const username = String(body?.username || "").trim();
  const currentPassword = String(body?.currentPassword || "");
  const newPassword = String(body?.newPassword || "");

  if (!username || !currentPassword || !newPassword) {
    sendJson(res, 400, { error: "username_current_and_new_password_required" });
    return;
  }
  if (authenticatedUser !== username) {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }
  if (newPassword.length < 4) {
    sendJson(res, 400, { error: "password_too_short" });
    return;
  }

  const user = getUserRecord(username);
  if (!user || user.provider !== "local") {
    sendJson(res, 404, { error: "local_user_not_found" });
    return;
  }
  if (!verifyPassword(currentPassword, user.passwordHash)) {
    sendJson(res, 401, { error: "invalid_current_password" });
    return;
  }

  await saveUserRecord(username, {
    ...user,
    passwordHash: hashPassword(newPassword),
    updatedAt: new Date().toISOString(),
  });
  sendJson(res, 200, { ok: true });
}

// GET /api/google-drive/status?username=
async function handleGoogleDriveStatus(req, res, url) {
  const username = String(url.searchParams.get("username") || "").trim();
  const connection = username ? getUserConnection(username) : null;
  sendJson(res, 200, {
    available: true,
    configured: isGoogleBackendConfigured(),
    connected: Boolean(isGoogleBackendConfigured() && connection?.refreshToken),
    email: connection?.email || "",
    fileId: connection?.fileId || "",
    modifiedTime: connection?.modifiedTime || "",
  });
}

// GET /api/google-drive/connect?username=  (requires session)
async function handleGoogleDriveConnect(req, res, url, authenticatedUser) {
  if (!isGoogleBackendConfigured()) {
    sendJson(res, 503, { error: "google_drive_backend_not_configured" });
    return;
  }

  const username = String(url.searchParams.get("username") || "").trim();
  if (!username) {
    sendJson(res, 400, { error: "username_required" });
    return;
  }

  // Ensure the session user matches the requested username
  if (authenticatedUser !== username) {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }

  const state = crypto.randomBytes(24).toString("hex");
  pendingOAuthStates.set(state, { username, createdAt: Date.now() });

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", GOOGLE_REDIRECT_URI);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", GOOGLE_DRIVE_SCOPE);
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("include_granted_scopes", "true");
  authUrl.searchParams.set("state", state);

  res.writeHead(302, { Location: authUrl.toString() });
  res.end();
}

// GET /api/google-drive/oauth/callback
async function handleGoogleDriveOauthCallback(req, res, url) {
  const code = String(url.searchParams.get("code") || "").trim();
  const state = String(url.searchParams.get("state") || "").trim();
  const error = String(url.searchParams.get("error") || "").trim();

  if (error) {
    sendHtml(res, 400, buildPopupResponse({ success: false, error }));
    return;
  }

  const pending = pendingOAuthStates.get(state);
  pendingOAuthStates.delete(state);

  if (!pending || Date.now() - pending.createdAt > 10 * 60_000) {
    sendHtml(res, 400, buildPopupResponse({
      success: false,
      error: "Estado de autorizacao invalido ou expirado.",
    }));
    return;
  }

  try {
    const tokenPayload = await exchangeAuthorizationCode(code);
    const existing = getUserConnection(pending.username) || {};
    const idTokenPayload = decodeJwtPayload(tokenPayload.id_token || "");
    const refreshToken = String(tokenPayload.refresh_token || existing.refreshToken || "");

    if (!refreshToken) throw new Error("google_refresh_token_missing");

    await saveUserConnection(pending.username, {
      ...existing,
      refreshToken,
      email: String(idTokenPayload?.email || existing.email || ""),
      googleSub: String(idTokenPayload?.sub || existing.googleSub || ""),
      updatedAt: new Date().toISOString(),
      createdAt: existing.createdAt || new Date().toISOString(),
      fileId: String(existing.fileId || ""),
      modifiedTime: String(existing.modifiedTime || ""),
    });

    logger.info("Google Drive connected", { username: pending.username });

    sendHtml(res, 200, buildPopupResponse({
      success: true,
      username: pending.username,
    }));
  } catch (err) {
    logger.error("OAuth callback error", { error: err.message });
    sendHtml(res, 500, buildPopupResponse({
      success: false,
      username: pending.username,
      error: "Falha ao concluir a autorizacao.",
    }));
  }
}

// POST /api/google-drive/sync  (requires session)
async function handleGoogleDriveSync(req, res, authenticatedUser) {
  const body = await readJsonBody(req);
  const username = String(body?.username || "").trim();

  if (!username || !body?.payload) {
    sendJson(res, 400, { error: "username_and_payload_required" });
    return;
  }
  if (authenticatedUser !== username) {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }

  const result = await uploadBackupForUser(username, body.payload);
  logger.info("Sync completed", { username });
  sendJson(res, 200, result);
}

// POST /api/google-drive/restore  (requires session)
async function handleGoogleDriveRestore(req, res, authenticatedUser) {
  const body = await readJsonBody(req);
  const username = String(body?.username || "").trim();

  if (!username) {
    sendJson(res, 400, { error: "username_required" });
    return;
  }
  if (authenticatedUser !== username) {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }

  const result = await restoreBackupForUser(username);
  logger.info("Restore completed", { username });
  sendJson(res, 200, result);
}

// ─── Static file server ───────────────────────────────────────────────────────
function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".svg": "image/svg+xml",
    ".json": "application/json; charset=utf-8",
  };
  return types[ext] || "application/octet-stream";
}

function buildGoogleConfigScript() {
  const config = {
    clientId: GOOGLE_CLIENT_ID,
    backendBaseUrl: "",
  };
  return `window.DASHBOARD_GOOGLE_CONFIG = Object.assign({}, window.DASHBOARD_GOOGLE_CONFIG || {}, ${JSON.stringify(config, null, 2)});\n`;
}

function serveStatic(req, res, url) {
  const mapped = STATIC_FILES.get(url.pathname);
  if (!mapped) {
    sendText(res, 404, "Not found");
    return;
  }
  if (url.pathname === "/google-config.js") {
    res.writeHead(200, {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(buildGoogleConfigScript());
    return;
  }
  const filePath = path.join(__dirname, mapped);
  if (!fs.existsSync(filePath)) {
    sendText(res, 404, "Not found");
    return;
  }
  res.writeHead(200, {
    "Content-Type": getContentType(filePath),
    "Cache-Control": "public, max-age=60",
  });
  fs.createReadStream(filePath).pipe(res);
}

// ─── Periodic cleanup (replace per-request cleanup) ──────────────────────────
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of pendingOAuthStates) {
    if (now - value.createdAt > 10 * 60_000) pendingOAuthStates.delete(key);
  }
  // Clean rate limit map entries from old windows
  for (const [ip, entry] of rateLimitMap) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS * 2) rateLimitMap.delete(ip);
  }
}, 5 * 60_000);

setInterval(cleanupExpiredSessions, 60 * 60_000);

// ─── HTTP server ──────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const ip = getClientIp(req);
  const url = new URL(req.url, APP_ORIGIN);

  setCorsHeaders(res);

  // Handle preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  logger.info("Request", { method: req.method, path: url.pathname, ip });

  // Rate limit API routes
  if (url.pathname.startsWith("/api/")) {
    if (!checkRateLimit(ip)) {
      logger.warn("Rate limit hit", { ip, path: url.pathname });
      sendJson(res, 429, { error: "too_many_requests" });
      return;
    }
  }

  try {
    // ── Auth routes (no session required) ──────────────────────────────────
    if (req.method === "POST" && url.pathname === "/api/auth/register") {
      await handleAuthRegister(req, res);
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/auth/login") {
      await handleAuthLogin(req, res);
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/auth/migrate-local") {
      await handleAuthMigrateLocal(req, res);
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/auth/google-login") {
      await handleGoogleAuthLogin(req, res);
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/auth/logout") {
      await handleAuthLogout(req, res);
      return;
    }

    // ── Google Drive status (public, just reports connectivity) ────────────
    if (req.method === "GET" && url.pathname === "/api/google-drive/status") {
      await handleGoogleDriveStatus(req, res, url);
      return;
    }

    // ── OAuth callback (public, validated by state param) ──────────────────
    if (req.method === "GET" && url.pathname === "/api/google-drive/oauth/callback") {
      await handleGoogleDriveOauthCallback(req, res, url);
      return;
    }

    // ── Protected routes: validate session ─────────────────────────────────
    const sessionToken = extractSessionToken(req, url);
    const authenticatedUser = validateSession(sessionToken);

    if (req.method === "POST" && url.pathname === "/api/auth/change-password") {
      if (!authenticatedUser) { sendJson(res, 401, { error: "unauthorized" }); return; }
      await handleAuthChangePassword(req, res, authenticatedUser);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/google-drive/connect") {
      if (!authenticatedUser) { sendJson(res, 401, { error: "unauthorized" }); return; }
      await handleGoogleDriveConnect(req, res, url, authenticatedUser);
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/google-drive/sync") {
      if (!authenticatedUser) { sendJson(res, 401, { error: "unauthorized" }); return; }
      await handleGoogleDriveSync(req, res, authenticatedUser);
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/google-drive/restore") {
      if (!authenticatedUser) { sendJson(res, 401, { error: "unauthorized" }); return; }
      await handleGoogleDriveRestore(req, res, authenticatedUser);
      return;
    }

    // ── Static files ───────────────────────────────────────────────────────
    if (req.method === "GET") {
      serveStatic(req, res, url);
      return;
    }

    sendText(res, 404, "Not found");
  } catch (error) {
    const message = error?.message || "internal_server_error";
    logger.error("Unhandled error", { message, path: url.pathname });

    const statusCode =
      message.includes("not_connected")       ? 409 :
      message.includes("not_configured")      ? 503 :
      message.includes("file_not_found")      ? 404 :
      message.includes("request_too_large")   ? 413 :
      message.includes("invalid_content_type")? 415 :
      message.includes("unauthorized")        ? 401 :
      message.includes("forbidden")           ? 403 :
      500;

    // Never leak internal error details to the client
    const safeMessage = statusCode === 500 ? "internal_server_error" : message;
    sendJson(res, statusCode, { error: safeMessage });
  }
});

server.listen(PORT, () => {
  logger.info("Server started", { origin: APP_ORIGIN });
  logger.info("OAuth callback", { uri: GOOGLE_REDIRECT_URI });
  logger.info("Google backend configured", { configured: isGoogleBackendConfigured() });
});
