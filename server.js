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
const CALLBACK_HTML_TITLE = "Google Drive conectado";
const STATIC_FILES = new Map([
  ["/", "index.html"],
  ["/index.html", "index.html"],
  ["/app.js", "app.js"],
  ["/styles.css", "styles.css"],
  ["/google-config.js", "google-config.js"],
  ["/favicon.svg", "favicon.svg"],
  ["/dashboard-vendas%20(1).html", "dashboard-vendas (1).html"]
]);

const pendingOAuthStates = new Map();

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8");
  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) return;
    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  });
}

function isGoogleBackendConfigured() {
  return Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_REDIRECT_URI);
}

function ensureTokenStoreDir() {
  fs.mkdirSync(path.dirname(TOKEN_STORE_FILE), { recursive: true });
}

function readTokenStore() {
  ensureTokenStoreDir();
  if (!fs.existsSync(TOKEN_STORE_FILE)) {
    return { users: {} };
  }
  try {
    return JSON.parse(fs.readFileSync(TOKEN_STORE_FILE, "utf8"));
  } catch (error) {
    return { users: {} };
  }
}

function writeTokenStore(store) {
  ensureTokenStoreDir();
  fs.writeFileSync(TOKEN_STORE_FILE, JSON.stringify(store, null, 2));
}

function getUserConnection(username) {
  if (!username) return null;
  const store = readTokenStore();
  return store.users?.[username] || null;
}

function saveUserConnection(username, connection) {
  const store = readTokenStore();
  if (!store.users) store.users = {};
  store.users[username] = connection;
  writeTokenStore(store);
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function sendHtml(res, statusCode, html) {
  res.writeHead(statusCode, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(html);
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(text);
}

async function readJsonBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > 10 * 1024 * 1024) {
      throw new Error("request_too_large");
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildPopupResponse({ success, username = "", error = "" }) {
  const payload = JSON.stringify({
    type: "google-drive-connected",
    success,
    username,
    error
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
    <p>${success ? "Voce ja pode voltar para o dashboard. Esta janela sera fechada automaticamente." : escapeHtml(error || "Nao foi possivel concluir a autorizacao.")}</p>
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

function decodeJwtPayload(token) {
  try {
    const [, payload] = String(token || "").split(".");
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  } catch (error) {
    return null;
  }
}

async function exchangeAuthorizationCode(code) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_REDIRECT_URI,
      grant_type: "authorization_code"
    })
  });

  if (!response.ok) {
    throw new Error(`google_token_exchange_failed_${response.status}`);
  }

  return response.json();
}

async function refreshAccessToken(refreshToken) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token"
    })
  });

  if (!response.ok) {
    throw new Error(`google_refresh_failed_${response.status}`);
  }

  return response.json();
}

async function fetchDriveJson(accessToken, url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`${options.errorCode || "google_drive_request_failed"}_${response.status}:${details}`);
  }

  return response.json();
}

async function getDriveAccessTokenForUser(username) {
  if (!isGoogleBackendConfigured()) {
    throw new Error("google_drive_backend_not_configured");
  }
  const connection = getUserConnection(username);
  if (!connection?.refreshToken) {
    throw new Error("google_drive_not_connected");
  }

  const refreshed = await refreshAccessToken(connection.refreshToken);
  return {
    accessToken: String(refreshed.access_token || ""),
    connection
  };
}

async function findDriveFile(accessToken) {
  const query = encodeURIComponent(`name='${GOOGLE_DRIVE_FILE_NAME}' and 'appDataFolder' in parents and trashed=false`);
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

  const response = await fetch(endpoint, {
    method: metadata?.id ? "PATCH" : "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`
    },
    body: multipartBody
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`google_drive_upload_failed_${response.status}:${details}`);
  }

  const result = await response.json();
  const nextConnection = {
    ...connection,
    fileId: String(result.id || ""),
    modifiedTime: String(result.modifiedTime || new Date().toISOString()),
    updatedAt: new Date().toISOString()
  };
  saveUserConnection(username, nextConnection);

  return {
    action: metadata?.id ? "updated" : "created",
    fileId: nextConnection.fileId,
    modifiedTime: nextConnection.modifiedTime,
    email: nextConnection.email || ""
  };
}

async function restoreBackupForUser(username) {
  const { accessToken, connection } = await getDriveAccessTokenForUser(username);
  const metadata = await findDriveFile(accessToken);
  if (!metadata?.id) {
    throw new Error("google_drive_file_not_found");
  }

  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${metadata.id}?alt=media`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`google_drive_download_failed_${response.status}:${details}`);
  }

  const payload = await response.json();
  const nextConnection = {
    ...connection,
    fileId: String(metadata.id || ""),
    modifiedTime: String(metadata.modifiedTime || ""),
    updatedAt: new Date().toISOString()
  };
  saveUserConnection(username, nextConnection);

  return {
    payload,
    fileId: nextConnection.fileId,
    modifiedTime: nextConnection.modifiedTime,
    email: nextConnection.email || ""
  };
}

async function handleGoogleDriveStatus(req, res, url) {
  const username = String(url.searchParams.get("username") || "").trim();
  const connection = username ? getUserConnection(username) : null;
  sendJson(res, 200, {
    available: true,
    configured: isGoogleBackendConfigured(),
    connected: Boolean(isGoogleBackendConfigured() && connection?.refreshToken),
    email: connection?.email || "",
    fileId: connection?.fileId || "",
    modifiedTime: connection?.modifiedTime || ""
  });
}

async function handleGoogleDriveConnect(req, res, url) {
  if (!isGoogleBackendConfigured()) {
    sendJson(res, 503, { error: "google_drive_backend_not_configured" });
    return;
  }

  const username = String(url.searchParams.get("username") || "").trim();
  if (!username) {
    sendJson(res, 400, { error: "username_required" });
    return;
  }

  const state = crypto.randomBytes(24).toString("hex");
  pendingOAuthStates.set(state, {
    username,
    createdAt: Date.now()
  });

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
  if (!pending || (Date.now() - pending.createdAt) > 10 * 60 * 1000) {
    sendHtml(res, 400, buildPopupResponse({ success: false, error: "Estado de autorizacao invalido ou expirado." }));
    return;
  }

  try {
    const tokenPayload = await exchangeAuthorizationCode(code);
    const existing = getUserConnection(pending.username) || {};
    const idTokenPayload = decodeJwtPayload(tokenPayload.id_token || "");
    const refreshToken = String(tokenPayload.refresh_token || existing.refreshToken || "");
    if (!refreshToken) {
      throw new Error("google_refresh_token_missing");
    }

    saveUserConnection(pending.username, {
      ...existing,
      refreshToken,
      email: String(idTokenPayload?.email || existing.email || ""),
      googleSub: String(idTokenPayload?.sub || existing.googleSub || ""),
      updatedAt: new Date().toISOString(),
      createdAt: existing.createdAt || new Date().toISOString(),
      fileId: String(existing.fileId || ""),
      modifiedTime: String(existing.modifiedTime || "")
    });

    sendHtml(res, 200, buildPopupResponse({
      success: true,
      username: pending.username
    }));
  } catch (callbackError) {
    sendHtml(res, 500, buildPopupResponse({
      success: false,
      username: pending.username,
      error: callbackError.message || "Falha ao concluir a autorizacao."
    }));
  }
}

async function handleGoogleDriveSync(req, res) {
  const body = await readJsonBody(req);
  const username = String(body?.username || "").trim();
  if (!username || !body?.payload) {
    sendJson(res, 400, { error: "username_and_payload_required" });
    return;
  }

  const result = await uploadBackupForUser(username, body.payload);
  sendJson(res, 200, result);
}

async function handleGoogleDriveRestore(req, res) {
  const body = await readJsonBody(req);
  const username = String(body?.username || "").trim();
  if (!username) {
    sendJson(res, 400, { error: "username_required" });
    return;
  }

  const result = await restoreBackupForUser(username);
  sendJson(res, 200, result);
}

function getContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".html") return "text/html; charset=utf-8";
  if (extension === ".js") return "application/javascript; charset=utf-8";
  if (extension === ".css") return "text/css; charset=utf-8";
  if (extension === ".svg") return "image/svg+xml";
  if (extension === ".json") return "application/json; charset=utf-8";
  return "application/octet-stream";
}

function serveStatic(req, res, url) {
  const mapped = STATIC_FILES.get(url.pathname);
  if (!mapped) {
    sendText(res, 404, "Not found");
    return;
  }
  const filePath = path.join(__dirname, mapped);
  if (!fs.existsSync(filePath)) {
    sendText(res, 404, "Not found");
    return;
  }
  res.writeHead(200, {
    "Content-Type": getContentType(filePath)
  });
  fs.createReadStream(filePath).pipe(res);
}

function cleanupPendingStates() {
  const now = Date.now();
  pendingOAuthStates.forEach((value, key) => {
    if ((now - value.createdAt) > 10 * 60 * 1000) pendingOAuthStates.delete(key);
  });
}

const server = http.createServer(async (req, res) => {
  cleanupPendingStates();
  const url = new URL(req.url, APP_ORIGIN);

  try {
    if (req.method === "GET" && url.pathname === "/api/google-drive/status") {
      await handleGoogleDriveStatus(req, res, url);
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/google-drive/connect") {
      await handleGoogleDriveConnect(req, res, url);
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/google-drive/oauth/callback") {
      await handleGoogleDriveOauthCallback(req, res, url);
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/google-drive/sync") {
      await handleGoogleDriveSync(req, res);
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/google-drive/restore") {
      await handleGoogleDriveRestore(req, res);
      return;
    }

    if (req.method === "GET") {
      serveStatic(req, res, url);
      return;
    }

    sendText(res, 404, "Not found");
  } catch (error) {
    const message = error?.message || "internal_server_error";
    const statusCode = message.includes("not_connected")
      ? 409
      : message.includes("not_configured")
        ? 503
        : message.includes("file_not_found")
          ? 404
          : message.includes("request_too_large")
            ? 413
            : 500;
    sendJson(res, statusCode, { error: message });
  }
});

server.listen(PORT, () => {
  console.log(`Dashboard rodando em ${APP_ORIGIN}`);
  console.log(`OAuth callback configurado para ${GOOGLE_REDIRECT_URI}`);
});
