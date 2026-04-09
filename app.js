const STORAGE_KEY = "dashboard-vendas-state-v2";
const STORAGE_BACKUP_KEY = "dashboard-vendas-state-v2-backup";
const LAST_SAVED_KEY = "dashboard-vendas-last-saved-v1";
const SESSION_KEY = "dashboard-vendas-session-v1";
const THEME_KEY = "dashboard-vendas-theme-v1";
const GOOGLE_TOKEN_STORAGE_KEY = "dashboard-vendas-google-token-v1";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const GOOGLE_TOKEN_EXPIRY_SKEW_MS = 60 * 1000;
const GOOGLE_DRIVE_FILE_NAME = "dashboard-vendas-state.json";
const GOOGLE_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata";
const GOOGLE_CONFIG = window.DASHBOARD_GOOGLE_CONFIG || {};
const GOOGLE_BACKEND_API_BASE = String(GOOGLE_CONFIG.backendBaseUrl || "").replace(/\/$/, "");

const ALL_MONTHS = [
  "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const SHORT = {
  Janeiro: "Jan",
  Fevereiro: "Fev",
  Marco: "Mar",
  Abril: "Abr",
  Maio: "Mai",
  Junho: "Jun",
  Julho: "Jul",
  Agosto: "Ago",
  Setembro: "Set",
  Outubro: "Out",
  Novembro: "Nov",
  Dezembro: "Dez"
};

const LEGACY_PLATFORM_PRESETS = {
  ml: { name: "Mercado Livre", icon: "ML", color: "#ffe500", iconText: "#1f2937" },
  sh: { name: "Shopee", icon: "SH", color: "#ff5722", iconText: "#ffffff" },
  se: { name: "Shein", icon: "SE", color: "#111111", iconText: "#ffffff" },
  mg: { name: "Magalu", icon: "MG", color: "#0086ff", iconText: "#ffffff" },
  nu: { name: "Nuvem Shop", icon: "NS", color: "#00a86b", iconText: "#ffffff" },
  tk: { name: "TikTok", icon: "TT", color: "#fe2c55", iconText: "#ffffff" },
  kw: { name: "Kwai", icon: "KW", color: "#fb923c", iconText: "#ffffff" }
};

const PLATFORM_FAVICON_DOMAINS = {
  "mercado-livre": "mercadolivre.com.br",
  mercadolivre: "mercadolivre.com.br",
  shopee: "shopee.com.br",
  shein: "br.shein.com",
  magalu: "magazineluiza.com.br",
  "magazine-luiza": "magazineluiza.com.br",
  "nuvem-shop": "nuvemshop.com.br",
  nuvemshop: "nuvemshop.com.br",
  tiktok: "tiktok.com",
  "tiktok-shop": "shop.tiktok.com",
  kwai: "kwai.com",
  amazon: "amazon.com.br",
  "amazon-brasil": "amazon.com.br",
  americanas: "americanas.com.br",
  "loja-integrada": "lojaintegrada.com.br",
  tray: "tray.com.br",
  yampi: "yampi.com.br",
  aliexpress: "aliexpress.com",
  "ali-express": "aliexpress.com",
  "mercado-shops": "mercadoshops.com.br"
};

const BRAND_COLORS = ["#2563eb", "#ff5722", "#14b8a6", "#fb923c", "#e11d48", "#7c3aed", "#0ea5e9", "#16a34a"];
const dash = '<span style="color:var(--muted)">-</span>';
const PRICING_DEFAULTS = {
  productCost: 0,
  packagingCost: 0,
  extraCost: 0,
  shippingSubsidy: 0,
  targetMargin: 20,
  targetProfit: 20,
  mode: "margin",
  profiles: {}
};
const MARKETPLACE_PRICING_PRESETS = {
  "mercado-livre": {
    label: "Mercado Livre",
    commissionRate: 12,
    transactionRate: 0,
    fixedFee: 6.5,
    extraShippingCost: 0,
    sourceType: "official",
    note: "Baseado nas tabelas publicas do Mercado Livre. Ajuste conforme tipo de anuncio, faixa de preco e frete."
  },
  shopee: {
    label: "Shopee",
    commissionRate: 14,
    transactionRate: 0,
    fixedFee: 4,
    extraShippingCost: 0,
    sourceType: "estimated",
    note: "Estimativa editavel. Revise conforme CPF ou CNPJ, frete gratis e campanhas ativas."
  },
  shein: {
    label: "Shein",
    commissionRate: 16,
    transactionRate: 0,
    fixedFee: 0,
    extraShippingCost: 0,
    sourceType: "estimated",
    note: "Estimativa inicial. Confirme a taxa praticada no painel da sua operacao."
  },
  magalu: {
    label: "Magalu",
    commissionRate: 16,
    transactionRate: 0,
    fixedFee: 0,
    extraShippingCost: 0,
    sourceType: "estimated",
    note: "Estimativa inicial. A comissao muda por categoria e contrato."
  },
  "nuvem-shop": {
    label: "Nuvem Shop",
    commissionRate: 0.7,
    transactionRate: 0,
    fixedFee: 0,
    extraShippingCost: 0,
    sourceType: "official",
    note: "Referencia publica do plano Escala com meio de pagamento externo. Se usar Nuvem Pago, a taxa da plataforma pode ser zero."
  },
  tiktok: {
    label: "TikTok",
    commissionRate: 6,
    transactionRate: 0,
    fixedFee: 0,
    extraShippingCost: 0,
    sourceType: "estimated",
    note: "Estimativa editavel. Revise conforme campanha e regras atuais da TikTok Shop."
  },
  kwai: {
    label: "Kwai",
    commissionRate: 8,
    transactionRate: 0,
    fixedFee: 0,
    extraShippingCost: 0,
    sourceType: "estimated",
    note: "Estimativa editavel. Confirme no painel da sua operacao antes de usar em massa."
  }
};

let dailyChart = null;
let donutChart = null;
let newMonthSel = null;
let authMode = "login";
let editingPlatformKey = null;
let pendingImportMode = "merge";
let pendingDeleteMonth = null;
let headerMenuCloseTimer = null;
let googleTokenClient = null;
let googleAccessToken = "";
let googleDriveSyncTimer = null;
let googleSyncInFlight = false;
let googleDriveBootstrapStarted = false;
let googleSignInReady = false;
let googleSignInRenderTimer = null;
let googleDriveBackendStatus = {
  checked: false,
  available: false,
  configured: false,
  connected: false,
  email: "",
  fileId: "",
  modifiedTime: "",
  busy: false
};
let activeAppScreen = "hub";

const state = loadState();
let currentTheme = loadTheme();
let sessionUser = loadSession();
activeAppScreen = state.currentScreen || "hub";

const R = (v) => "R$ " + Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const RS = (v) => {
  const value = Number(v || 0);
  const digits = Number.isInteger(value)
    ? { minimumFractionDigits: 0, maximumFractionDigits: 0 }
    : { minimumFractionDigits: 2, maximumFractionDigits: 2 };
  return "R$ " + value.toLocaleString("pt-BR", digits);
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function hexToRgb(color) {
  const normalized = String(color || "").trim().replace("#", "");
  if (!/^[\da-f]{3}([\da-f]{3})?$/i.test(normalized)) return null;
  const full = normalized.length === 3 ? normalized.split("").map((char) => char + char).join("") : normalized;
  const value = Number.parseInt(full, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  };
}

function alphaColor(color, alpha) {
  const rgb = hexToRgb(color);
  return rgb ? `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})` : color;
}

function getReadablePlatformColor(color) {
  const rgb = hexToRgb(color);
  if (!rgb) return color;
  const brightness = ((rgb.r * 299) + (rgb.g * 587) + (rgb.b * 114)) / 1000;
  if (currentTheme === "dark" && brightness < 72) return "#f3f4f6";
  if (currentTheme === "light" && brightness > 225) return "#111827";
  return color;
}

function getPlatformTone(platform) {
  const base = platform?.color || "#2563eb";
  return {
    base,
    text: getReadablePlatformColor(base),
    softBg: alphaColor(base, currentTheme === "dark" ? 0.18 : 0.12),
    softBorder: alphaColor(base, currentTheme === "dark" ? 0.34 : 0.2)
  };
}

function getPlatformVisualColor(platform, alpha = null) {
  const base = platform?.color || "#2563eb";
  const rgb = hexToRgb(base);
  const brightness = rgb ? ((rgb.r * 299) + (rgb.g * 587) + (rgb.b * 114)) / 1000 : 255;
  const visibleBase = currentTheme === "dark" && brightness < 72 ? "#f3f4f6" : base;
  return alpha === null ? visibleBase : alphaColor(visibleBase, alpha);
}

function normalizeAuth(auth) {
  const provider = auth?.provider === "google" ? "google" : "local";
  const username = provider === "google"
    ? String(auth?.googleEmail || auth?.username || "").trim()
    : String(auth?.username || "").trim();
  if (!username) return null;
  return {
    provider,
    username,
    password: provider === "local" ? String(auth.password || "") : "",
    googleEmail: String(auth?.googleEmail || (provider === "google" ? username : "")),
    googleName: String(auth?.googleName || ""),
    googlePicture: String(auth?.googlePicture || ""),
    googleSub: String(auth?.googleSub || ""),
    googleDriveFileId: String(auth.googleDriveFileId || ""),
    googleDriveModifiedTime: String(auth.googleDriveModifiedTime || ""),
    googleDriveLastAction: String(auth.googleDriveLastAction || ""),
    googleDriveAuthorized: Boolean(auth?.googleDriveAuthorized)
  };
}

function isGoogleConfigured() {
  const clientId = String(GOOGLE_CONFIG.clientId || "").trim();
  return Boolean(clientId && !clientId.includes("SEU_CLIENT_ID"));
}

function isGoogleOriginSupported() {
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  if (protocol === "https:") return true;
  if (protocol === "http:" && /^(localhost|127(?:\.\d{1,3}){3})$/i.test(hostname)) return true;
  return false;
}

function isLocalAuth() {
  return (state.auth?.provider || "local") === "local";
}

function isGoogleAuth() {
  return (state.auth?.provider || "local") === "google";
}

function isSessionActive() {
  if (!sessionUser || !state.auth?.username) return false;
  return sessionUser.username === state.auth.username
    && (sessionUser.provider || "local") === (state.auth?.provider || "local")
    && Boolean(sessionUser.serverSessionToken);
}

function canUseGoogleDrive() {
  return Boolean(state.auth?.username) && isSessionActive();
}

function hasGoogleDriveAccess() {
  if (!canUseGoogleDrive()) return false;
  if (googleDriveBackendStatus.available) return googleDriveBackendStatus.connected;
  return Boolean(getActiveGoogleAccessToken());
}

function getDefaultMonth() {
  return ALL_MONTHS[new Date().getMonth()];
}

function defaultState() {
  return {
    auth: null,
    platforms: [],
    db: {},
    currentMonth: getDefaultMonth(),
    pricing: clone(PRICING_DEFAULTS),
    currentScreen: "hub"
  };
}

function getPlatforms() {
  return Array.isArray(state.platforms) ? state.platforms : [];
}

function getPricingPreset(platform) {
  const candidates = [
    slugifyText(platform?.name),
    slugifyText((platform?.name || "").replace(/\s+/g, "-")),
    slugifyText(platform?.key)
  ];
  return candidates.map((key) => MARKETPLACE_PRICING_PRESETS[key]).find(Boolean) || null;
}

function normalizePricingProfile(platform, profile = {}) {
  const preset = getPricingPreset(platform) || {};
  return {
    commissionRate: Number(profile.commissionRate ?? preset.commissionRate ?? 0),
    transactionRate: Number(profile.transactionRate ?? preset.transactionRate ?? 0),
    fixedFee: Number(profile.fixedFee ?? preset.fixedFee ?? 0),
    extraShippingCost: Number(profile.extraShippingCost ?? preset.extraShippingCost ?? 0),
    sourceType: String(profile.sourceType || preset.sourceType || "custom"),
    note: String(profile.note || preset.note || "Personalize com os custos reais da sua operacao.")
  };
}

function normalizePricing(pricing = {}, platforms = getPlatforms()) {
  const next = {
    productCost: Number(pricing.productCost || 0),
    packagingCost: Number(pricing.packagingCost || 0),
    extraCost: Number(pricing.extraCost || 0),
    shippingSubsidy: Number(pricing.shippingSubsidy || 0),
    targetMargin: Number(pricing.targetMargin || 0),
    targetProfit: Number(pricing.targetProfit || 0),
    mode: pricing.mode === "profit" ? "profit" : "margin",
    profiles: {}
  };
  platforms.forEach((platform) => {
    next.profiles[platform.key] = normalizePricingProfile(platform, pricing.profiles?.[platform.key] || {});
  });
  return next;
}

function slugifyText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeMonthName(month) {
  const normalized = String(month || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/Ã§/g, "c")
    .replace(/Ã/g, "a");
  const matched = ALL_MONTHS.find((item) => item.toLowerCase() === normalized.toLowerCase());
  return matched || normalized || getDefaultMonth();
}

function normalizeMonthName(month) {
  const raw = String(month || "").trim();
  if (!raw) return getDefaultMonth();

  const normalized = raw
    .replace(/MarÃ§o/gi, "Marco")
    .replace(/Marã§o/gi, "Marco")
    .replace(/Ã§/gi, "c")
    .replace(/Ã£/gi, "a")
    .replace(/Ã¡|Ã¢|Ãà|Ãä/gi, "a")
    .replace(/Ã©|Ãê|Ãè|Ãë/gi, "e")
    .replace(/Ãí|Ãì|Ãî|Ãï/gi, "i")
    .replace(/Ã³|Ãò|Ãô|Ãö/gi, "o")
    .replace(/Ãº|Ãù|Ãû|Ãü/gi, "u")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z]/g, "")
    .toLowerCase();

  const matched = ALL_MONTHS.find((item) => item.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() === normalized);
  return matched || raw || getDefaultMonth();
}

function inferPlatformsFromLegacyData(data) {
  const keySet = new Set();
  Object.values(data || {}).forEach((monthData) => {
    (monthData?.days || []).forEach((day) => {
      Object.keys(day || {}).forEach((key) => {
        if (key !== "d") keySet.add(key);
      });
    });
    Object.keys(monthData?.returns || {}).forEach((key) => keySet.add(key));
  });

  return [...keySet].map((key, index) => {
    const preset = LEGACY_PLATFORM_PRESETS[key] || {};
    return normalizePlatform({
      key,
      name: preset.name || key.toUpperCase(),
      icon: preset.icon || key.toUpperCase().slice(0, 2),
      color: preset.color || BRAND_COLORS[index % BRAND_COLORS.length],
      iconText: preset.iconText || "#ffffff"
    }, index);
  });
}

function inferPlatformsFromDb(data) {
  return inferPlatformsFromLegacyData(data);
}

function convertLegacyBackup(payload) {
  const dashboardData = payload?.dashboardData || {};
  const platforms = inferPlatformsFromLegacyData(dashboardData);
  const db = {};
  const normalizedMonths = Object.keys(dashboardData).map((month) => {
    const normalized = normalizeMonthName(month);
    db[normalized] = dashboardData[month];
    return normalized;
  });

  return {
    auth: null,
    platforms,
    db,
    currentMonth: payload?.currentMonth ? normalizeMonthName(payload.currentMonth) : (normalizedMonths[normalizedMonths.length - 1] || getDefaultMonth())
  };
}

function mergeImportedState(restoredState) {
  const existingPlatforms = getPlatforms();
  const mergedPlatforms = [...existingPlatforms];

  restoredState.platforms.forEach((platform) => {
    if (!mergedPlatforms.some((item) => item.key === platform.key)) {
      mergedPlatforms.push(platform);
    }
  });

  state.platforms = mergedPlatforms;

  Object.keys(restoredState.db || {}).forEach((month) => {
    const normalizedMonth = normalizeMonthName(month);
    if (!state.db[normalizedMonth]) {
      state.db[normalizedMonth] = normalizeMonthData(restoredState.db[month]);
      return;
    }

    const currentMonthData = state.db[normalizedMonth];
    const importedMonthData = normalizeMonthData(restoredState.db[month]);
    const daysByDate = new Map(currentMonthData.days.map((day) => [day.d, day]));

    importedMonthData.days.forEach((importedDay) => {
      if (!daysByDate.has(importedDay.d)) {
        currentMonthData.days.push(importedDay);
        return;
      }

      const existingDay = daysByDate.get(importedDay.d);
      state.platforms.forEach((platform) => {
        const currentValue = Number(existingDay[platform.key] || 0);
        const importedValue = Number(importedDay[platform.key] || 0);
        if (currentValue === 0 && importedValue > 0) existingDay[platform.key] = importedValue;
      });
    });

    state.platforms.forEach((platform) => {
      const currentReturn = Number(currentMonthData.returns?.[platform.key] || 0);
      const importedReturn = Number(importedMonthData.returns?.[platform.key] || 0);
      currentMonthData.returns[platform.key] = Math.max(currentReturn, importedReturn);
    });

    currentMonthData.days = sortDays(currentMonthData.days.map((day) => normalizeDay(day)));
  });

  if (restoredState.currentMonth && state.db[restoredState.currentMonth]) {
    state.currentMonth = restoredState.currentMonth;
  } else if (!state.db[state.currentMonth]) {
    state.currentMonth = Object.keys(state.db).pop() || getDefaultMonth();
  }

  ensureMonthData(state.currentMonth);
}

function normalizePlatform(platform = {}, index = 0) {
  const name = String(platform.name || "").trim();
  const short = String(platform.icon || platform.short || name.slice(0, 2) || `P${index + 1}`)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 3);
  const normalizedColor = String(platform.color || "").trim();
  const color = /^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(normalizedColor)
    ? normalizedColor
    : BRAND_COLORS[index % BRAND_COLORS.length];
  return {
    key: String(platform.key || slugifyText(name || `plataforma-${index + 1}`)).slice(0, 20) || `plataforma-${index + 1}`,
    name: name || `Plataforma ${index + 1}`,
    color,
    icon: short || `P${index + 1}`,
    iconText: platform.iconText || "#ffffff"
  };
}

function ensureMonthData(month) {
  if (!state.db[month]) {
    const returns = {};
    getPlatforms().forEach((platform) => {
      returns[platform.key] = 0;
    });
    state.db[month] = { days: [], returns };
  }
  getPlatforms().forEach((platform) => {
    if (state.db[month].returns[platform.key] === undefined) state.db[month].returns[platform.key] = 0;
  });
}

function normalizeDay(day = {}, platforms = getPlatforms()) {
  const normalized = { d: day.d || "" };
  platforms.forEach((platform) => {
    normalized[platform.key] = Number(day[platform.key] || 0);
  });
  return normalized;
}

function sortDays(days) {
  return [...days].sort((a, b) => {
    const [da, ma] = (a.d || "").split("/").map(Number);
    const [db, mb] = (b.d || "").split("/").map(Number);
    if (ma !== mb) return ma - mb;
    return da - db;
  });
}

function normalizeMonthData(monthData = {}, platforms = getPlatforms()) {
  const days = Array.isArray(monthData.days) ? monthData.days.map((day) => normalizeDay(day, platforms)) : [];
  const returns = {};
  platforms.forEach((platform) => {
    returns[platform.key] = Number((monthData.returns || {})[platform.key] || 0);
  });
  return { days: sortDays(days), returns };
}

function ensureStateMonths(targetState) {
  if (!targetState.platforms.length) return;
  const currentMonth = targetState.currentMonth || getDefaultMonth();
  if (!targetState.db[currentMonth]) {
    const returns = {};
    targetState.platforms.forEach((platform) => {
      returns[platform.key] = 0;
    });
    targetState.db[currentMonth] = { days: [], returns };
  }
}

function normalizeState(raw) {
  const base = defaultState();
  const rawDb = raw?.db || {};
  const normalizedPlatforms = Array.isArray(raw?.platforms) && raw.platforms.length
    ? raw.platforms.map((platform, index) => normalizePlatform(platform, index))
    : inferPlatformsFromDb(rawDb);
  const next = {
    auth: normalizeAuth(raw?.auth),
    platforms: normalizedPlatforms,
    db: {},
    currentMonth: raw?.currentMonth || base.currentMonth,
    pricing: clone(PRICING_DEFAULTS),
    currentScreen: raw?.currentScreen === "dashboard" || raw?.currentScreen === "calculator" ? raw.currentScreen : "hub"
  };

  Object.keys(rawDb).forEach((month) => {
    next.db[month] = rawDb[month];
  });

  if (!next.platforms.length && !Object.keys(next.db).length) {
    next.db = {};
    next.currentMonth = base.currentMonth;
  } else {
    Object.keys(next.db).forEach((month) => {
      next.db[month] = normalizeMonthData(next.db[month], next.platforms);
    });
    if (!next.db[next.currentMonth]) {
      const months = Object.keys(next.db);
      next.currentMonth = months[months.length - 1] || base.currentMonth;
    }
    ensureStateMonths(next);
  }

  next.pricing = normalizePricing(raw?.pricing || base.pricing, next.platforms);

  return next;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_BACKUP_KEY);
    if (!raw) return defaultState();
    return normalizeState(JSON.parse(raw));
  } catch (error) {
    try {
      const backupRaw = localStorage.getItem(STORAGE_BACKUP_KEY);
      if (backupRaw) return normalizeState(JSON.parse(backupRaw));
    } catch (backupError) {
      console.error("Falha ao carregar backup local:", backupError);
    }
    console.error("Falha ao carregar estado local:", error);
    return defaultState();
  }
}

function saveState(options = {}) {
  const snapshot = JSON.stringify(normalizeState(clone(state)));
  localStorage.setItem(STORAGE_KEY, snapshot);
  localStorage.setItem(STORAGE_BACKUP_KEY, snapshot);
  const savedAt = new Date().toISOString();
  localStorage.setItem(LAST_SAVED_KEY, savedAt);
  if (state.auth?.username) {
    const baseMessage = getPlatforms().length
      ? `Dados locais de ${state.auth.username}`
      : `Dados locais de ${state.auth.username} · cadastre plataformas em "Plataformas"`;
    const stamp = formatSavedAt(savedAt);
    setStorageStatus(stamp ? `${baseMessage} · salvo em ${stamp}` : baseMessage);
  }
  if (!options.skipGoogleSync) scheduleGoogleDriveSync();
  renderGoogleUi();
}

function loadTheme() {
  return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
}

function saveTheme() {
  localStorage.setItem(THEME_KEY, currentTheme);
}

function formatSavedAt(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function loadLastSavedAt() {
  return localStorage.getItem(LAST_SAVED_KEY) || "";
}

function loadStoredAuth() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_BACKUP_KEY);
    if (!raw) return null;
    const parsed = normalizeState(JSON.parse(raw));
    return parsed.auth?.username ? parsed.auth : null;
  } catch (error) {
    console.error("Falha ao verificar usuario salvo:", error);
    return null;
  }
}

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed?.username || !parsed?.expiresAt) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }

    if (Date.now() > Number(parsed.expiresAt)) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }

    const serverSessionToken = String(parsed.serverSessionToken || "").trim();
    if (!serverSessionToken) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }

    return {
      username: String(parsed.username),
      provider: parsed.provider === "google" ? "google" : "local",
      serverSessionToken
    };
  } catch (error) {
    const legacySession = localStorage.getItem(SESSION_KEY) || "";
    if (!legacySession) return null;
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

function saveSession(username, provider = "local", serverSessionToken = sessionUser?.serverSessionToken || "") {
  const safeToken = String(serverSessionToken || "").trim();
  sessionUser = {
    username,
    provider: provider === "google" ? "google" : "local",
    serverSessionToken: safeToken
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify({
    username,
    provider: sessionUser.provider,
    serverSessionToken: safeToken,
    expiresAt: Date.now() + SESSION_DURATION_MS
  }));
}

function clearSession() {
  sessionUser = null;
  localStorage.removeItem(SESSION_KEY);
}

function getServerSessionToken() {
  return String(sessionUser?.serverSessionToken || "").trim();
}

async function readBackendJson(path, options = {}) {
  const serverSessionToken = getServerSessionToken();
  const extraHeaders = options.requiresAuth === false || !serverSessionToken
    ? {}
    : { Authorization: `Bearer ${serverSessionToken}` };
  const response = await fetch(getGoogleDriveApiUrl(path), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...extraHeaders,
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (error) {
    data = null;
  }
  if (!response.ok) {
    throw new Error(data?.error || `backend_request_failed_${response.status}`);
  }
  return data;
}

async function migrateLegacyLocalAuthIfNeeded() {
  if (!state.auth?.username || !isLocalAuth() || !state.auth?.password) return false;
  try {
    await readBackendJson("/api/auth/migrate-local", {
      method: "POST",
      requiresAuth: false,
      body: JSON.stringify({
        username: state.auth.username,
        password: state.auth.password
      })
    });
    state.auth = normalizeAuth({
      ...state.auth,
      password: ""
    });
    saveState({ skipGoogleSync: true });
    return true;
  } catch (error) {
    console.error("Falha ao migrar acesso local legado:", error);
    return false;
  }
}

function loadCachedGoogleToken() {
  try {
    const raw = sessionStorage.getItem(GOOGLE_TOKEN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const accessToken = String(parsed?.accessToken || "");
    const expiresAt = Number(parsed?.expiresAt || 0);
    if (!accessToken || !expiresAt || (Date.now() + GOOGLE_TOKEN_EXPIRY_SKEW_MS) >= expiresAt) {
      sessionStorage.removeItem(GOOGLE_TOKEN_STORAGE_KEY);
      return null;
    }
    return { accessToken, expiresAt };
  } catch (error) {
    sessionStorage.removeItem(GOOGLE_TOKEN_STORAGE_KEY);
    return null;
  }
}

function persistGoogleToken(accessToken, expiresInSeconds = 0) {
  const safeToken = String(accessToken || "").trim();
  const safeExpiresIn = Number(expiresInSeconds || 0);
  if (!safeToken || !safeExpiresIn) return;
  sessionStorage.setItem(GOOGLE_TOKEN_STORAGE_KEY, JSON.stringify({
    accessToken: safeToken,
    expiresAt: Date.now() + (safeExpiresIn * 1000)
  }));
}

function clearCachedGoogleToken() {
  googleAccessToken = "";
  sessionStorage.removeItem(GOOGLE_TOKEN_STORAGE_KEY);
}

function getActiveGoogleAccessToken() {
  if (googleAccessToken) return googleAccessToken;
  const cached = loadCachedGoogleToken();
  if (!cached?.accessToken) return "";
  googleAccessToken = cached.accessToken;
  return googleAccessToken;
}

function getCurrentYear() {
  return new Date().getFullYear();
}

function getMonthIndexByName(month) {
  return ALL_MONTHS.findIndex((item) => item === month);
}

function toInputDateValue(year, monthIndex, day) {
  const date = new Date(year, monthIndex, day);
  const safeYear = date.getFullYear();
  const safeMonth = String(date.getMonth() + 1).padStart(2, "0");
  const safeDay = String(date.getDate()).padStart(2, "0");
  return `${safeYear}-${safeMonth}-${safeDay}`;
}

function getLocalDateInputValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().split("T")[0];
}

function getSuggestedInputDate(month) {
  const monthIndex = getMonthIndexByName(month);
  if (monthIndex < 0) return getLocalDateInputValue();
  const now = new Date();
  const sameMonth = now.getFullYear() === getCurrentYear() && now.getMonth() === monthIndex;
  return sameMonth ? getLocalDateInputValue() : toInputDateValue(getCurrentYear(), monthIndex, 1);
}

function syncSaleDateWithMonth(force = false) {
  const monthSelect = document.getElementById("inputMonth");
  const dateInput = document.getElementById("inputDate");
  if (!monthSelect || !dateInput) return;

  const selectedMonth = monthSelect.value || state.currentMonth;
  const monthIndex = getMonthIndexByName(selectedMonth);
  if (monthIndex < 0) {
    if (force || !dateInput.value) dateInput.value = getLocalDateInputValue();
    return;
  }

  const desiredValue = getSuggestedInputDate(selectedMonth);
  if (!dateInput.value) {
    dateInput.value = desiredValue;
    return;
  }

  const currentDate = new Date(`${dateInput.value}T00:00:00`);
  const currentMonthMatches = !Number.isNaN(currentDate.getTime()) && currentDate.getMonth() === monthIndex;
  if (force || !currentMonthMatches) dateInput.value = desiredValue;
}

function toast(message) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2500);
}

function setStorageStatus(message) {
  const el = document.getElementById("authStatus");
  if (el) el.textContent = message;
}

function renderCurrentUserBadge() {
  const badge = document.getElementById("currentUserBadge");
  if (!badge) return;
  const providerLabel = isGoogleAuth() ? "Google" : "Local";
  badge.textContent = `Usuario: ${state.auth?.username || "-"} (${providerLabel})`;
}

function setGoogleDriveStatus(message) {
  const el = document.getElementById("googleDriveStatus");
  if (el) el.textContent = message;
}

function getGoogleDriveActionLabel(action) {
  if (action === "created") return "arquivo criado";
  if (action === "created_on_login") return "arquivo criado no login";
  if (action === "updated") return "arquivo atualizado";
  if (action === "restored") return "backup restaurado";
  if (action === "restored_on_login") return "backup restaurado no login";
  return "conectado";
}

function driveDebug(step, details = null) {
  if (details === null || details === undefined) {
    console.log(`[DriveSync] ${step}`);
    return;
  }
  console.log(`[DriveSync] ${step}`, details);
}

function getGoogleDriveApiUrl(path) {
  return `${GOOGLE_BACKEND_API_BASE}${path}`;
}

function resetGoogleDriveBackendStatus() {
  googleDriveBackendStatus = {
    checked: true,
    available: googleDriveBackendStatus.available,
    configured: googleDriveBackendStatus.configured,
    connected: false,
    email: "",
    fileId: "",
    modifiedTime: "",
    busy: false
  };
}

function applyGoogleDriveBackendStatus(status = {}) {
  googleDriveBackendStatus = {
    checked: true,
    available: Boolean(status?.available),
    configured: Boolean(status?.configured),
    connected: Boolean(status?.connected),
    email: String(status?.email || ""),
    fileId: String(status?.fileId || ""),
    modifiedTime: String(status?.modifiedTime || ""),
    busy: false
  };

  if (!state.auth) return;
  if (googleDriveBackendStatus.connected) {
    state.auth.googleDriveAuthorized = true;
    if (googleDriveBackendStatus.fileId) state.auth.googleDriveFileId = googleDriveBackendStatus.fileId;
    if (googleDriveBackendStatus.modifiedTime) state.auth.googleDriveModifiedTime = googleDriveBackendStatus.modifiedTime;
  }
}

async function refreshGoogleDriveBackendStatus({ render = true } = {}) {
  try {
    const username = encodeURIComponent(state.auth?.username || "");
    const response = await fetch(getGoogleDriveApiUrl(`/api/google-drive/status${username ? `?username=${username}` : ""}`), {
      headers: { Accept: "application/json" }
    });
    if (!response.ok) throw new Error(`backend_status_${response.status}`);
    const status = await response.json();
    applyGoogleDriveBackendStatus(status);
    driveDebug("backend:status", status);
  } catch (error) {
    googleDriveBackendStatus = {
      checked: true,
      available: false,
      configured: false,
      connected: false,
      email: "",
      fileId: "",
      modifiedTime: "",
      busy: false
    };
    driveDebug("backend:status unavailable", {
      message: error?.message || String(error)
    });
  } finally {
    if (render) renderGoogleUi();
  }
}

async function readGoogleDriveBackendJson(path, options = {}) {
  return readBackendJson(path, options);
}

function waitForGoogleDrivePopup(popup, expectedUsername) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const popupMonitor = setInterval(() => {
      if (!popup || popup.closed) {
        cleanup();
        reject(new Error("popup_closed"));
      }
    }, 400);

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("popup_timeout"));
    }, 120000);

    const onMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "google-drive-connected") return;
      if (expectedUsername && event.data?.username !== expectedUsername) return;
      cleanup();
      if (event.data?.success) resolve(event.data);
      else reject(new Error(event.data?.error || "google_drive_connect_failed"));
    };

    function cleanup() {
      if (settled) return;
      settled = true;
      clearInterval(popupMonitor);
      clearTimeout(timeout);
      window.removeEventListener("message", onMessage);
    }

    window.addEventListener("message", onMessage);
  });
}

async function ensureGoogleDriveBackendConnection({ interactive = true } = {}) {
  if (!canUseGoogleDrive()) return false;
  if (!googleDriveBackendStatus.checked) await refreshGoogleDriveBackendStatus({ render: false });
  if (!googleDriveBackendStatus.available || !googleDriveBackendStatus.configured) return false;
  if (googleDriveBackendStatus.connected) return true;
  if (!interactive) return false;

  const serverSessionToken = getServerSessionToken();
  if (!serverSessionToken) throw new Error("session_missing");
  const connectUrl = getGoogleDriveApiUrl(`/api/google-drive/connect?username=${encodeURIComponent(state.auth.username)}&sessionToken=${encodeURIComponent(serverSessionToken)}`);
  const popup = window.open(connectUrl, "googleDriveConnect", "popup=yes,width=520,height=720");
  if (!popup) throw new Error("popup_failed_to_open");
  popup.focus();
  await waitForGoogleDrivePopup(popup, state.auth.username);
  await refreshGoogleDriveBackendStatus({ render: false });
  return googleDriveBackendStatus.connected;
}

async function syncGoogleDriveViaBackend() {
  const result = await readGoogleDriveBackendJson("/api/google-drive/sync", {
    method: "POST",
    body: JSON.stringify({
      username: state.auth.username,
      payload: getBackupPayload()
    })
  });

  state.auth.googleDriveFileId = result.fileId || "";
  state.auth.googleDriveModifiedTime = result.modifiedTime || new Date().toISOString();
  state.auth.googleDriveLastAction = result.action || "updated";
  state.auth.googleDriveAuthorized = true;
  applyGoogleDriveBackendStatus({
    available: true,
    configured: true,
    connected: true,
    email: result.email || googleDriveBackendStatus.email,
    fileId: state.auth.googleDriveFileId,
    modifiedTime: state.auth.googleDriveModifiedTime
  });
  return result;
}

async function restoreGoogleDriveViaBackend(preferredMode) {
  const result = await readGoogleDriveBackendJson("/api/google-drive/restore", {
    method: "POST",
    body: JSON.stringify({
      username: state.auth.username
    })
  });

  applyImportedBackup(result.payload, preferredMode);
  state.auth.googleDriveFileId = result.fileId || "";
  state.auth.googleDriveModifiedTime = result.modifiedTime || "";
  state.auth.googleDriveLastAction = "restored";
  state.auth.googleDriveAuthorized = true;
  applyGoogleDriveBackendStatus({
    available: true,
    configured: true,
    connected: true,
    email: result.email || googleDriveBackendStatus.email,
    fileId: state.auth.googleDriveFileId,
    modifiedTime: state.auth.googleDriveModifiedTime
  });
  return result;
}

function renderGoogleUi() {
  const googleHint = document.getElementById("googleAuthHint");
  const syncButton = document.getElementById("syncGoogleDriveButton");
  const restoreButton = document.getElementById("restoreGoogleDriveButton");
  const changePasswordButton = document.getElementById("changePasswordButton");
  const googleReady = isGoogleConfigured();
  const googleOriginReady = isGoogleOriginSupported();
  const backendDriveReady = googleDriveBackendStatus.available && googleDriveBackendStatus.configured;
  const driveReady = backendDriveReady || (googleReady && googleOriginReady);
  const driveAvailable = canUseGoogleDrive();

  if (googleHint) {
    if (backendDriveReady && driveAvailable && !googleDriveBackendStatus.connected) {
      googleHint.textContent = "Use Sincronizar Google Drive para conectar sua conta uma vez. Depois a renovacao fica no backend.";
    } else if (backendDriveReady && driveAvailable) {
      googleHint.textContent = "Backup do Google Drive conectado via backend. As proximas sincronizacoes podem rodar sem popup.";
    } else if (googleDriveBackendStatus.available && !googleDriveBackendStatus.configured) {
      googleHint.textContent = "Configure o arquivo .env do backend com GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET para liberar o Google Drive.";
    } else if (!googleReady) {
      googleHint.textContent = "Edite google-config.js com o Client ID OAuth Web da sua conta Google Cloud para usar login e backup no Google.";
    } else if (!googleOriginReady) {
      googleHint.textContent = "Abra este dashboard em https ou em http://localhost para usar login com Google. O protocolo file:// nao e aceito pelo Google.";
    } else if (driveAvailable) {
      googleHint.textContent = "Use os botoes de sincronizar ou restaurar para conectar o backup com o Google Drive.";
    } else if (isGoogleAuth()) {
      googleHint.textContent = "Entre com a mesma conta Google usada para criar este acesso.";
    } else if (!state.auth?.username) {
      googleHint.textContent = "Voce pode criar o acesso localmente ou entrar com Google.";
    } else {
      googleHint.textContent = "Faca login para liberar o backup com Google Drive. O acesso atual continua local.";
    }
  }

  if (syncButton) syncButton.disabled = !driveReady || !driveAvailable || googleSyncInFlight;
  if (restoreButton) restoreButton.disabled = !driveReady || !driveAvailable || googleSyncInFlight;
  if (changePasswordButton) changePasswordButton.hidden = !isLocalAuth();

  if (backendDriveReady && googleDriveBackendStatus.connected) {
    const stamp = formatSavedAt(state.auth?.googleDriveModifiedTime || googleDriveBackendStatus.modifiedTime || "");
    const actionLabel = getGoogleDriveActionLabel(state.auth?.googleDriveLastAction || "");
    const accountLabel = googleDriveBackendStatus.email ? ` (${googleDriveBackendStatus.email})` : "";
    setGoogleDriveStatus(stamp
      ? `Google Drive${accountLabel} ${actionLabel} · ultima sync em ${stamp}`
      : `Google Drive${accountLabel} conectado via backend`);
  } else if (backendDriveReady && driveAvailable) {
    setGoogleDriveStatus("Google Drive aguardando conexao com o backend");
  } else if (googleDriveBackendStatus.available && !googleDriveBackendStatus.configured) {
    setGoogleDriveStatus("Google Drive indisponivel: configure o backend (.env).");
  } else if (!googleReady) {
    setGoogleDriveStatus("Google Drive indisponivel: configure o Client ID.");
  } else if (!googleOriginReady) {
    setGoogleDriveStatus("Google indisponivel neste modo de abertura. Use localhost ou https.");
  } else if (hasGoogleDriveAccess()) {
    const stamp = formatSavedAt(state.auth?.googleDriveModifiedTime || "");
    const actionLabel = getGoogleDriveActionLabel(state.auth?.googleDriveLastAction || "");
    setGoogleDriveStatus(stamp ? `Google Drive ${actionLabel} · ultima sync em ${stamp}` : `Google Drive ${actionLabel}`);
  } else if (driveAvailable) {
    setGoogleDriveStatus("Google Drive pronto para conectar");
  } else {
    setGoogleDriveStatus("Google Drive desconectado");
  }
}

function decodeJwtPayload(token) {
  try {
    const [, payload] = String(token || "").split(".");
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
    return JSON.parse(atob(padded));
  } catch (error) {
    console.error("Falha ao ler credencial Google:", error);
    return null;
  }
}

function ensureGoogleSignInClient() {
  if (!isGoogleConfigured()) {
    throw new Error("google_not_configured");
  }
  if (!isGoogleOriginSupported()) {
    throw new Error("google_origin_not_supported");
  }
  if (!window.google?.accounts?.id) {
    throw new Error("google_sign_in_not_ready");
  }
  if (!googleSignInReady) {
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CONFIG.clientId,
      callback: handleGoogleCredentialResponse,
      auto_select: false,
      cancel_on_tap_outside: true
    });
    googleSignInReady = true;
  }
}

function renderGoogleSignInButton() {
  const slot = document.getElementById("googleSignInSlot");
  const divider = document.getElementById("authGoogleDivider");
  if (!slot) return;

  clearTimeout(googleSignInRenderTimer);
  const canOfferGoogleLogin = isGoogleConfigured() && isGoogleOriginSupported() && (!state.auth?.username || isGoogleAuth());
  slot.hidden = !canOfferGoogleLogin;
  if (divider) divider.hidden = !canOfferGoogleLogin;
  if (!canOfferGoogleLogin) {
    slot.innerHTML = "";
    return;
  }

  try {
    ensureGoogleSignInClient();
    slot.innerHTML = "";
    window.google.accounts.id.renderButton(slot, {
      type: "standard",
      theme: currentTheme === "light" ? "outline" : "filled_black",
      text: state.auth?.username ? "signin_with" : "continue_with",
      shape: "pill",
      size: "large",
      width: 360,
      logo_alignment: "left"
    });
  } catch (error) {
    slot.textContent = "Carregando login Google...";
    googleSignInRenderTimer = setTimeout(() => {
      renderGoogleSignInButton();
    }, 600);
  }
}

function buildGoogleProfile(credentialResponse) {
  const payload = decodeJwtPayload(credentialResponse?.credential || "");
  if (!payload?.email || !payload?.sub) return null;
  if (payload.email_verified === false) return null;
  return {
    provider: "google",
    username: String(payload.email).trim(),
    googleEmail: String(payload.email).trim(),
    googleName: String(payload.name || payload.email).trim(),
    googlePicture: String(payload.picture || ""),
    googleSub: String(payload.sub).trim(),
    googleDriveFileId: state.auth?.googleDriveFileId || "",
    googleDriveModifiedTime: state.auth?.googleDriveModifiedTime || ""
  };
}

async function finalizeGoogleLogin({ isFirstAccess = false } = {}) {
  saveState({ skipGoogleSync: true });
  await refreshGoogleDriveBackendStatus({ render: false });
  renderScreen();

  const restored = await restoreFromGoogleDrive({
    silent: false,
    preferredMode: "replace",
    showSuccessToast: false,
    showMissingToast: false
  });

  if (restored) {
    state.auth.googleDriveLastAction = "restored_on_login";
    saveState({ skipGoogleSync: true });
    renderGoogleUi();
    toast("Backup do Google Drive carregado apos o login");
    return;
  }

  const syncAction = await syncGoogleDriveNow({
    silent: false,
    showSuccessToast: false,
    showPromptToast: false
  });

  if (syncAction) {
    state.auth.googleDriveLastAction = syncAction === "created" ? "created_on_login" : "updated";
    saveState({ skipGoogleSync: true });
    renderGoogleUi();
    toast(syncAction === "created"
      ? "Nenhum backup foi encontrado. Criamos um novo no Google Drive com os dados atuais."
      : "Os dados atuais foram sincronizados com o Google Drive apos o login.");
    return;
  }

  if (isFirstAccess) {
    toast("Login com Google configurado com sucesso");
    return;
  }

  toast("Login com Google realizado");
}

async function handleGoogleCredentialResponse(credentialResponse) {
  const googleProfile = buildGoogleProfile(credentialResponse);
  if (!googleProfile) {
    toast("Nao foi possivel validar o login com Google");
    return;
  }

  if (!state.auth?.username) {
    let authResult = null;
    try {
      authResult = await readBackendJson("/api/auth/google-login", {
        method: "POST",
        requiresAuth: false,
        body: JSON.stringify({
          credential: String(credentialResponse?.credential || "")
        })
      });
    } catch (error) {
      toast("Nao foi possivel autenticar sua conta Google no backend");
      return;
    }
    state.auth = normalizeAuth(googleProfile);
    saveSession(googleProfile.username, "google", authResult?.sessionToken || "");
    setActiveAppScreen("hub");
    await finalizeGoogleLogin({ isFirstAccess: true });
    return;
  }

  if (!isGoogleAuth()) {
    toast("Este dashboard ainda usa acesso local. Entre com usuario e senha para continuar.");
    return;
  }

  const sameGoogleAccount = state.auth.googleSub
    ? state.auth.googleSub === googleProfile.googleSub
    : state.auth.username === googleProfile.username;

  if (!sameGoogleAccount) {
    toast("Use a mesma conta Google vinculada a este dashboard");
    return;
  }

  let authResult = null;
  try {
    authResult = await readBackendJson("/api/auth/google-login", {
      method: "POST",
      requiresAuth: false,
      body: JSON.stringify({
        credential: String(credentialResponse?.credential || "")
      })
    });
  } catch (error) {
    toast("Nao foi possivel autenticar sua conta Google no backend");
    return;
  }

  state.auth = normalizeAuth({
    ...state.auth,
    ...googleProfile,
    googleDriveFileId: state.auth.googleDriveFileId || googleProfile.googleDriveFileId,
    googleDriveModifiedTime: state.auth.googleDriveModifiedTime || googleProfile.googleDriveModifiedTime
  });
  saveSession(state.auth.username, "google", authResult?.sessionToken || "");
  setActiveAppScreen("hub");
  await finalizeGoogleLogin();
}

function ensureGoogleIdentityClient() {
  if (!isGoogleConfigured()) {
    throw new Error("google_not_configured");
  }
  if (!isGoogleOriginSupported()) {
    throw new Error("google_origin_not_supported");
  }
  if (!window.google?.accounts?.oauth2) {
    throw new Error("google_identity_not_ready");
  }
  if (!googleTokenClient) {
    googleTokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CONFIG.clientId,
      scope: GOOGLE_DRIVE_SCOPE,
      callback: () => {},
      error_callback: () => {}
    });
  }
  return googleTokenClient;
}

function requestGoogleAccessToken(prompt = "", { interactive = true } = {}) {
  return new Promise((resolve, reject) => {
    try {
      const activeToken = getActiveGoogleAccessToken();
      driveDebug("request token:start", {
        interactive,
        hasToken: Boolean(activeToken),
        prompt
      });
      if (activeToken) {
        driveDebug("request token:reuse existing token");
        resolve({
          access_token: activeToken,
          reused: true
        });
        return;
      }
      const tokenClient = ensureGoogleIdentityClient();
      tokenClient.callback = (response) => {
        if (response?.error) {
          driveDebug("request token:error response", response);
          reject(new Error(response.error));
          return;
        }
        googleAccessToken = response.access_token || googleAccessToken;
        persistGoogleToken(googleAccessToken, response?.expires_in || 0);
        if (state.auth && !state.auth.googleDriveAuthorized) {
          state.auth.googleDriveAuthorized = true;
          saveState({ skipGoogleSync: true });
        }
        driveDebug("request token:success", {
          hasAccessToken: Boolean(googleAccessToken),
          scope: response?.scope || "",
          expiresIn: response?.expires_in || null
        });
        resolve(response);
      };
      tokenClient.error_callback = (error) => {
        driveDebug("request token:error callback", error);
        reject(new Error(error?.type || error?.message || "google_token_error"));
      };
      const hasSavedDriveAuthorization = Boolean(state.auth?.googleDriveAuthorized);
      const nextPrompt = interactive
        ? (prompt || (hasSavedDriveAuthorization ? "" : "consent"))
        : "none";
      driveDebug("request token:dispatch", { prompt: nextPrompt });
      tokenClient.requestAccessToken({ prompt: nextPrompt });
    } catch (error) {
      driveDebug("request token:exception", error);
      reject(error);
    }
  });
}

async function googleApiFetch(url, options = {}) {
  driveDebug("fetch:start", {
    url,
    method: options.method || "GET",
    hasToken: Boolean(getActiveGoogleAccessToken())
  });
  if (!getActiveGoogleAccessToken()) await requestGoogleAccessToken("");
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${googleAccessToken}`
    }
  });
  driveDebug("fetch:response", {
    url,
    method: options.method || "GET",
    status: response.status,
    ok: response.ok
  });

  if (response.status === 401) {
    clearCachedGoogleToken();
    driveDebug("fetch:retry after 401", { url });
    await requestGoogleAccessToken("");
    const retryResponse = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${googleAccessToken}`
      }
    });
    driveDebug("fetch:retry response", {
      url,
      method: options.method || "GET",
      status: retryResponse.status,
      ok: retryResponse.ok
    });
    return retryResponse;
  }

  return response;
}

async function getGoogleDriveFileMetadata() {
  const query = encodeURIComponent(`name='${GOOGLE_DRIVE_FILE_NAME}' and 'appDataFolder' in parents and trashed=false`);
  driveDebug("metadata:lookup", { fileName: GOOGLE_DRIVE_FILE_NAME });
  const response = await googleApiFetch(`https://www.googleapis.com/drive/v3/files?q=${query}&spaces=appDataFolder&fields=files(id,name,modifiedTime)&pageSize=1`);
  if (!response.ok) throw await createGoogleApiError("google_drive_lookup_failed", response);
  const data = await response.json();
  driveDebug("metadata:result", data.files?.[0] || null);
  return data.files?.[0] || null;
}

async function createGoogleApiError(code, response) {
  let details = "";
  try {
    const raw = await response.text();
    details = raw || "";
  } catch (error) {
    details = "";
  }

  const suffix = details ? ` (${response.status}: ${details})` : ` (${response.status})`;
  return new Error(`${code}${suffix}`);
}

async function uploadBackupToGoogleDrive() {
  const metadata = await getGoogleDriveFileMetadata();
  const boundary = `dashboard-vendas-${Date.now()}`;
  const payload = JSON.stringify(getBackupPayload(), null, 2);
  const fileMetadata = metadata?.id
    ? {
        name: GOOGLE_DRIVE_FILE_NAME,
        mimeType: "application/json"
      }
    : {
        name: GOOGLE_DRIVE_FILE_NAME,
        mimeType: "application/json",
        parents: ["appDataFolder"]
      };
  const multipartBody =
    `--${boundary}\r\n` +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify(fileMetadata) +
    `\r\n--${boundary}\r\n` +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    payload +
    `\r\n--${boundary}--`;

  const endpoint = metadata?.id
    ? `https://www.googleapis.com/upload/drive/v3/files/${metadata.id}?uploadType=multipart&fields=id,modifiedTime`
    : "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,modifiedTime";
  const method = metadata?.id ? "PATCH" : "POST";
  driveDebug("upload:start", {
    mode: metadata?.id ? "update" : "create",
    fileId: metadata?.id || null,
    payloadBytes: payload.length
  });
  const response = await googleApiFetch(endpoint, {
    method,
    headers: {
      "Content-Type": `multipart/related; boundary=${boundary}`
    },
    body: multipartBody
  });
  if (!response.ok) throw await createGoogleApiError("google_drive_upload_failed", response);
  const result = await response.json();
  driveDebug("upload:success", result);
  return {
    ...result,
    action: metadata?.id ? "updated" : "created"
  };
}

async function downloadBackupFromGoogleDrive() {
  const metadata = await getGoogleDriveFileMetadata();
  if (!metadata?.id) return null;
  driveDebug("download:start", { fileId: metadata.id });
  const response = await googleApiFetch(`https://www.googleapis.com/drive/v3/files/${metadata.id}?alt=media`);
  if (!response.ok) throw await createGoogleApiError("google_drive_download_failed", response);
  const payload = await response.json();
  driveDebug("download:success", {
    fileId: metadata.id,
    keys: Object.keys(payload || {})
  });
  return { metadata, payload };
}

function scheduleGoogleDriveSync() {
  if (!canUseGoogleDrive()) return;
  clearTimeout(googleDriveSyncTimer);
  googleDriveSyncTimer = setTimeout(() => {
    syncGoogleDriveNow({ silent: true });
  }, 1200);
}

async function restoreGoogleDriveOnSessionStart() {
  if (googleDriveBootstrapStarted) return false;
  if (!canUseGoogleDrive()) return false;

  googleDriveBootstrapStarted = true;
  driveDebug("bootstrap:start", {
    user: state.auth?.username || null,
    provider: state.auth?.provider || "local"
  });

  if (!googleDriveBackendStatus.checked) {
    await refreshGoogleDriveBackendStatus({ render: false });
  }

  const restored = await restoreFromGoogleDrive({
    silent: true,
    preferredMode: "replace",
    showSuccessToast: false,
    showMissingToast: false
  });

  if (restored) {
    state.auth.googleDriveLastAction = "restored_on_login";
    saveState({ skipGoogleSync: true });
    renderGoogleUi();
    driveDebug("bootstrap:restored", {
      fileId: state.auth?.googleDriveFileId || null,
      modifiedTime: state.auth?.googleDriveModifiedTime || null
    });
    toast("Backup do Google Drive carregado automaticamente");
    return true;
  }

  driveDebug("bootstrap:no-remote-restore", {
    hasToken: Boolean(googleAccessToken)
  });
  return false;
}

async function syncGoogleDriveNow({ silent = false, showSuccessToast = !silent, showPromptToast = !silent } = {}) {
  if (!canUseGoogleDrive()) {
    if (!silent) toast("Faca login para sincronizar");
    return false;
  }
  if (googleSyncInFlight) {
    driveDebug("sync:skip already running", { silent });
    return false;
  }

  try {
    driveDebug("sync:start", {
      silent,
      user: state.auth?.username || null,
      provider: state.auth?.provider || "local",
      lastFileId: state.auth?.googleDriveFileId || null
    });
    googleSyncInFlight = true;
    renderGoogleUi();

    if (!googleDriveBackendStatus.checked) {
      await refreshGoogleDriveBackendStatus({ render: false });
    }
    if (googleDriveBackendStatus.available && googleDriveBackendStatus.configured) {
      const connected = await ensureGoogleDriveBackendConnection({ interactive: !silent });
      if (!connected) {
        driveDebug("sync:backend waiting user authorization");
        if (showPromptToast) toast("Clique em Sincronizar Google Drive para conectar sua conta");
        return false;
      }
      const upload = await syncGoogleDriveViaBackend();
      saveState({ skipGoogleSync: true });
      renderGoogleUi();
      driveDebug("sync:backend success", {
        action: upload.action,
        fileId: state.auth.googleDriveFileId,
        modifiedTime: state.auth.googleDriveModifiedTime
      });
      if (showSuccessToast) toast(upload.action === "created" ? "Backup criado no Google Drive" : "Backup atualizado no Google Drive");
      return upload.action || "updated";
    }

    const tokenResponse = await requestGoogleAccessToken("", { interactive: !silent });
    if (!tokenResponse && !googleAccessToken) {
      driveDebug("sync:waiting user authorization");
      if (showPromptToast) toast("Clique em Sincronizar Google Drive para autorizar o acesso");
      return false;
    }
    const upload = await uploadBackupToGoogleDrive();
    state.auth.googleDriveFileId = upload.id || "";
    state.auth.googleDriveModifiedTime = upload.modifiedTime || new Date().toISOString();
    state.auth.googleDriveLastAction = upload.action || "updated";
    saveState({ skipGoogleSync: true });
    renderGoogleUi();
    driveDebug("sync:success", {
      action: upload.action,
      fileId: state.auth.googleDriveFileId,
      modifiedTime: state.auth.googleDriveModifiedTime
    });
    if (showSuccessToast) toast(upload.action === "created" ? "Backup criado no Google Drive" : "Backup atualizado no Google Drive");
    return upload.action || "updated";
  } catch (error) {
    driveDebug("sync:error", {
      message: error?.message || String(error)
    });
    console.error("Falha ao sincronizar com Google Drive:", error);
    if (!silent) {
      const message = String(error?.message || "");
      if (message.includes("popup_closed")) {
        toast("A autorizacao do Google Drive foi fechada antes de concluir");
      } else if (message.includes("popup_failed_to_open")) {
        toast("O navegador bloqueou a janela de autorizacao do Google Drive");
      } else if (message.includes("google_drive_not_connected")) {
        toast("Conecte sua conta Google Drive para concluir a sincronizacao");
      } else if (message.includes("google_drive_backend_not_configured")) {
        toast("O backend do Google Drive ainda nao foi configurado");
      } else if (message.includes("access_denied")) {
        toast("O acesso ao Google Drive foi negado");
      } else {
        toast("Nao foi possivel sincronizar com Google Drive");
      }
    }
    return false;
  } finally {
    googleSyncInFlight = false;
    renderGoogleUi();
  }
}

async function restoreFromGoogleDrive({ silent = false, preferredMode = "merge", showSuccessToast = !silent, showMissingToast = !silent } = {}) {
  if (!canUseGoogleDrive()) {
    if (!silent) toast("Faca login para restaurar dados");
    return false;
  }
  if (googleSyncInFlight) {
    driveDebug("restore:skip already running", { silent });
    return false;
  }

  try {
    driveDebug("restore:start", {
      silent,
      mode: preferredMode,
      user: state.auth?.username || null
    });
    googleSyncInFlight = true;
    renderGoogleUi();

    if (!googleDriveBackendStatus.checked) {
      await refreshGoogleDriveBackendStatus({ render: false });
    }
    if (googleDriveBackendStatus.available && googleDriveBackendStatus.configured) {
      const connected = await ensureGoogleDriveBackendConnection({ interactive: !silent });
      if (!connected) {
        driveDebug("restore:backend waiting user authorization");
        if (!silent) toast("Clique em Restaurar do Google Drive para conectar sua conta");
        return false;
      }
      const remote = await restoreGoogleDriveViaBackend(preferredMode);
      saveState({ skipGoogleSync: true });
      renderGoogleUi();
      driveDebug("restore:backend success", {
        fileId: state.auth.googleDriveFileId,
        modifiedTime: state.auth.googleDriveModifiedTime
      });
      if (showSuccessToast) toast("Backup restaurado do Google Drive");
      return true;
    }

    const tokenResponse = await requestGoogleAccessToken("", { interactive: !silent });
    if (!tokenResponse && !googleAccessToken) {
      driveDebug("restore:waiting user authorization");
      if (!silent) toast("Clique em Restaurar do Google Drive para autorizar o acesso");
      return false;
    }
    const remote = await downloadBackupFromGoogleDrive();
    if (!remote) {
      if (showMissingToast) toast("Nenhum backup encontrado no Google Drive");
      return false;
    }

    applyImportedBackup(remote.payload, preferredMode);
    state.auth.googleDriveFileId = remote.metadata.id || "";
    state.auth.googleDriveModifiedTime = remote.metadata.modifiedTime || "";
    state.auth.googleDriveLastAction = "restored";
    saveState({ skipGoogleSync: true });
    renderGoogleUi();
    driveDebug("restore:success", {
      fileId: state.auth.googleDriveFileId,
      modifiedTime: state.auth.googleDriveModifiedTime
    });
    if (showSuccessToast) toast("Backup restaurado do Google Drive");
    return true;
  } catch (error) {
    driveDebug("restore:error", {
      message: error?.message || String(error)
    });
    console.error("Falha ao restaurar do Google Drive:", error);
    if (!silent) {
      const message = String(error?.message || "");
      if (message.includes("popup_closed")) {
        toast("A autorizacao do Google Drive foi fechada antes de concluir");
      } else if (message.includes("popup_failed_to_open")) {
        toast("O navegador bloqueou a janela de autorizacao do Google Drive");
      } else if (message.includes("google_drive_not_connected")) {
        toast("Conecte sua conta Google Drive para restaurar o backup");
      } else if (message.includes("google_drive_file_not_found")) {
        if (showMissingToast) toast("Nenhum backup encontrado no Google Drive");
      } else if (message.includes("google_drive_backend_not_configured")) {
        toast("O backend do Google Drive ainda nao foi configurado");
      } else if (message.includes("access_denied")) {
        toast("O acesso ao Google Drive foi negado");
      } else {
        toast("Nao foi possivel restaurar do Google Drive");
      }
    }
    return false;
  } finally {
    googleSyncInFlight = false;
    renderGoogleUi();
  }
}

function closeHeaderMenu() {
  const menu = document.getElementById("headerMenu");
  const button = document.getElementById("menuToggleButton");
  if (!menu || !button) return;
  clearTimeout(headerMenuCloseTimer);
  menu.classList.remove("open");
  button.setAttribute("aria-expanded", "false");
  headerMenuCloseTimer = setTimeout(() => {
    menu.hidden = true;
  }, 180);
}

function toggleHeaderMenu() {
  const menu = document.getElementById("headerMenu");
  const button = document.getElementById("menuToggleButton");
  if (!menu || !button) return;
  const willOpen = menu.hidden;
  if (!willOpen) {
    closeHeaderMenu();
    return;
  }
  clearTimeout(headerMenuCloseTimer);
  menu.hidden = false;
  requestAnimationFrame(() => {
    menu.classList.add("open");
    button.setAttribute("aria-expanded", "true");
  });
}

function getPlatformByKey(key) {
  return getPlatforms().find((platform) => platform.key === key) || null;
}

function resetPlatformForm() {
  editingPlatformKey = null;
  const nameInput = document.getElementById("platformName");
  const shortInput = document.getElementById("platformShort");
  const colorInput = document.getElementById("platformColor");
  const button = document.getElementById("addPlatformConfigButton");
  const cancelButton = document.getElementById("cancelPlatformEditButton");
  if (nameInput) nameInput.value = "";
  if (shortInput) shortInput.value = "";
  if (colorInput) colorInput.value = BRAND_COLORS[getPlatforms().length % BRAND_COLORS.length];
  if (button) button.textContent = "Adicionar Plataforma";
  if (cancelButton) cancelButton.hidden = true;
}

function startPlatformEdit(key) {
  const platform = getPlatformByKey(key);
  if (!platform) return;
  editingPlatformKey = key;
  document.getElementById("platformName").value = platform.name;
  document.getElementById("platformShort").value = platform.icon;
  document.getElementById("platformColor").value = platform.color;
  document.getElementById("addPlatformConfigButton").textContent = "Salvar Edicao";
  document.getElementById("cancelPlatformEditButton").hidden = false;
}

function updateImportModeUI() {
  document.querySelectorAll("[data-import-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.importMode === pendingImportMode);
  });
}

function applyTheme() {
  document.body.classList.toggle("light-theme", currentTheme === "light");
  const button = document.getElementById("themeToggleButton");
  if (button) {
    button.textContent = currentTheme === "light" ? "☾" : "☀";
    button.setAttribute("aria-label", currentTheme === "light" ? "Ativar modo escuro" : "Ativar modo claro");
    button.title = currentTheme === "light" ? "Modo Escuro" : "Modo Claro";
  }
}

function toggleTheme() {
  currentTheme = currentTheme === "light" ? "dark" : "light";
  saveTheme();
  applyTheme();
}

function getReturnRate(returns, sales) {
  if (!sales) return 0;
  return (returns / sales) * 100;
}

function getMonthDays(month) {
  const monthIndex = ALL_MONTHS.indexOf(month);
  if (monthIndex < 0) return 30;
  return new Date(getCurrentYear(), monthIndex + 1, 0).getDate();
}

function getWeekBuckets(monthName, days) {
  const monthIndex = getMonthIndexByName(monthName);
  if (monthIndex < 0) return [];

  const totalDays = getMonthDays(monthName);
  const firstWeekday = new Date(getCurrentYear(), monthIndex, 1).getDay();
  const ranges = [];
  let startDay = 1;
  let firstWeekLength = 7 - firstWeekday;
  if (firstWeekLength <= 0 || firstWeekday === 0) firstWeekLength = 7;

  while (startDay <= totalDays) {
    const weekLength = ranges.length === 0 ? firstWeekLength : 7;
    const endDay = Math.min(totalDays, startDay + weekLength - 1);
    ranges.push({ startDay, endDay, total: 0 });
    startDay = endDay + 1;
  }

  days.forEach((day) => {
    const dayNumber = Number((day.d || "").split("/")[0]);
    if (!dayNumber) return;
    const bucket = ranges.find((item) => dayNumber >= item.startDay && dayNumber <= item.endDay);
    if (!bucket) return;
    const dayTotal = getPlatforms().reduce((sum, platform) => sum + Number(day[platform.key] || 0), 0);
    bucket.total += dayTotal;
  });

  return ranges.map((bucket, index) => ({
    index,
    total: bucket.total,
    label: bucket.startDay === bucket.endDay ? `${bucket.startDay}` : `${bucket.startDay}-${bucket.endDay}`,
    shortLabel: `${index + 1}a sem.`
  }));
}

function getLoggedDays(month) {
  const data = state.db[month];
  if (!data) return 0;
  return data.days.filter((day) => getPlatforms().some((platform) => Number(day[platform.key] || 0) > 0)).length;
}

function calcTotals(month) {
  const data = state.db[month];
  if (!data) return null;
  const sales = {};
  getPlatforms().forEach((platform) => {
    sales[platform.key] = data.days.reduce((sum, day) => sum + Number(day[platform.key] || 0), 0);
  });
  const ret = {};
  getPlatforms().forEach((platform) => {
    ret[platform.key] = Number((data.returns || {})[platform.key] || 0);
  });
  const gross = getPlatforms().reduce((sum, platform) => sum + Number(sales[platform.key] || 0), 0);
  const totalRet = getPlatforms().reduce((sum, platform) => sum + Number(ret[platform.key] || 0), 0);
  return { sales, ret, gross, totalRet, net: gross - totalRet };
}

function calcProjection(month) {
  const totals = calcTotals(month);
  if (!totals) return null;
  const loggedDays = getLoggedDays(month);
  const monthDays = getMonthDays(month);
  const salesDailyAverage = loggedDays > 0 ? totals.gross / loggedDays : 0;
  const returnsDailyAverage = loggedDays > 0 ? totals.totalRet / loggedDays : 0;
  const projectedGross = salesDailyAverage * monthDays;
  const projectedReturns = returnsDailyAverage * monthDays;
  return {
    loggedDays,
    monthDays,
    salesDailyAverage,
    returnsDailyAverage,
    projectedGross,
    projectedReturns,
    projectedNet: projectedGross - projectedReturns,
    currentReturnRate: getReturnRate(totals.totalRet, totals.gross),
    projectedReturnRate: getReturnRate(projectedReturns, projectedGross)
  };
}

function prevMonth(month) {
  const months = Object.keys(state.db);
  const index = months.indexOf(month);
  return index > 0 ? months[index - 1] : null;
}

function varH(current, previous) {
  if (previous === null || previous === undefined || previous === 0) return dash;
  const diff = ((current - previous) / previous) * 100;
  const cls = diff >= 0 ? "up" : "down";
  const arrow = diff >= 0 ? "↑" : "↓";
  return `<span class="${cls}">${arrow} ${Math.abs(diff).toFixed(1)}%</span>`;
}

function getPlatformFaviconUrl(platform) {
  const candidates = [
    platform?.key,
    platform?.name,
    (platform?.name || "").replace(/\s+/g, ""),
    (platform?.name || "").replace(/\s+/g, "-")
  ]
    .map((value) => slugifyText(value))
    .filter(Boolean);
  const matchedKey = candidates.find((key) => PLATFORM_FAVICON_DOMAINS[key]);
  if (!matchedKey) return "";
  const domain = PLATFORM_FAVICON_DOMAINS[matchedKey];
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
}

function platformIcon(platform) {
  const faviconUrl = getPlatformFaviconUrl(platform);
  if (!faviconUrl) return "";
  return `<span class="platform-icon"><img class="platform-favicon" src="${escapeAttribute(faviconUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentElement.style.display='none'"></span>`;
}

function platformBadge(platform, shortName = false) {
  const label = shortName ? platform.name.split(" ")[0] : platform.name;
  return `<span class="platform-badge">${platformIcon(platform)}<span>${escapeHtml(label)}</span></span>`;
}

function destroyCharts() {
  if (dailyChart) {
    dailyChart.destroy();
    dailyChart = null;
  }
  if (donutChart) {
    donutChart.destroy();
    donutChart = null;
  }
}

function isSetupComplete() {
  return getPlatforms().length > 0;
}

function setActiveAppScreen(screen) {
  activeAppScreen = screen === "dashboard" || screen === "calculator" ? screen : "hub";
  state.currentScreen = activeAppScreen;
}

function renderScreen() {
  const authScreen = document.getElementById("authScreen");
  const setupScreen = document.getElementById("setupScreen");
  const hubScreen = document.getElementById("hubScreen");
  const dashboardScreen = document.getElementById("dashboardScreen");
  const calculatorScreen = document.getElementById("calculatorScreen");
  const hasAuth = Boolean(state.auth?.username);
  const isLoggedIn = Boolean(hasAuth && isSessionActive());

  if (isLoggedIn) saveSession(sessionUser.username, sessionUser.provider);

  authScreen.hidden = hasAuth && isLoggedIn;
  setupScreen.hidden = true;
  hubScreen.hidden = true;
  dashboardScreen.hidden = true;
  calculatorScreen.hidden = true;

  if (!hasAuth || !isLoggedIn) {
    destroyCharts();
    renderAuthScreen();
    setActiveAppScreen("hub");
  } else if (!isSetupComplete()) {
    setupScreen.hidden = false;
    renderSetupScreen();
  } else if (activeAppScreen === "dashboard") {
    dashboardScreen.hidden = false;
    renderDashboardShell();
  } else if (activeAppScreen === "calculator") {
    calculatorScreen.hidden = false;
    renderCalculatorScreen();
  } else {
    hubScreen.hidden = false;
    renderHubScreen();
  }
  renderGoogleUi();
}

function renderAuthScreen() {
  const storedAuth = loadStoredAuth();
  if (!state.auth?.username && storedAuth?.username) {
    state.auth = storedAuth;
    saveState();
  }

  const hasExistingAuth = Boolean(state.auth?.username);
  const authProvider = state.auth?.provider || "local";
  const usernameInput = document.getElementById("authUsername");
  const passwordInput = document.getElementById("authPassword");
  const createButton = document.getElementById("authModeCreateButton");
  const loginButton = document.getElementById("authModeLoginButton");
  const authModeSwitch = document.getElementById("authModeSwitch");
  const localFields = document.getElementById("authLocalFields");
  const submitButton = document.getElementById("authSubmitButton");
  const usesGoogleAuth = hasExistingAuth && authProvider === "google";

  if (usesGoogleAuth) {
    authMode = "login";
  } else {
    authMode = hasExistingAuth ? "login" : "create";
  }

  createButton.classList.toggle("active", authMode === "create");
  loginButton.classList.toggle("active", authMode === "login");
  loginButton.disabled = usesGoogleAuth || !hasExistingAuth;
  createButton.disabled = usesGoogleAuth || hasExistingAuth;
  usernameInput.disabled = usesGoogleAuth;
  passwordInput.disabled = usesGoogleAuth;
  if (authModeSwitch) authModeSwitch.hidden = usesGoogleAuth || hasExistingAuth;
  if (localFields) localFields.hidden = usesGoogleAuth;

  submitButton.disabled = usesGoogleAuth;
  submitButton.hidden = usesGoogleAuth;

  if (usesGoogleAuth) {
    document.getElementById("authTitle").textContent = "Entrar com Google";
    document.getElementById("authSubtitle").textContent = `Use a conta Google ${state.auth.googleEmail || state.auth.username} para acessar este dashboard.`;
  } else {
    document.getElementById("authTitle").textContent = authMode === "create" ? "Criar acesso" : "Fazer login";
    document.getElementById("authSubtitle").textContent = authMode === "create"
      ? "Crie um acesso local simples para proteger seu dashboard nesta maquina."
      : "Use seu acesso local para entrar no dashboard.";
    submitButton.textContent = authMode === "create" ? "Criar acesso" : "Entrar";
  }

  if (!usesGoogleAuth && authMode === "create") {
    usernameInput.readOnly = false;
    usernameInput.value = "";
    usernameInput.placeholder = "Seu usuario";
  } else if (!usesGoogleAuth) {
    usernameInput.readOnly = true;
    usernameInput.value = state.auth.username;
    usernameInput.placeholder = state.auth.username;
  } else {
    usernameInput.readOnly = true;
    usernameInput.value = "";
    usernameInput.placeholder = "Seu usuario";
  }
  passwordInput.value = "";
  renderGoogleSignInButton();
}

async function handleAuthSubmit() {
  if (isGoogleAuth()) {
    toast("Use o botao do Google para entrar");
    return;
  }
  const username = document.getElementById("authUsername").value.trim();
  const password = document.getElementById("authPassword").value;
  if (!username || !password) {
    toast("Preencha usuario e senha");
    return;
  }

  if (authMode === "create") {
    try {
      const result = await readBackendJson("/api/auth/register", {
        method: "POST",
        requiresAuth: false,
        body: JSON.stringify({ username, password })
      });
      state.auth = normalizeAuth({
        provider: "local",
        username,
        googleDriveFileId: state.auth?.googleDriveFileId || "",
        googleDriveModifiedTime: state.auth?.googleDriveModifiedTime || ""
      });
      saveState({ skipGoogleSync: true });
      saveSession(username, "local", result.sessionToken || "");
      setActiveAppScreen("hub");
      toast("Acesso criado com sucesso");
      await refreshGoogleDriveBackendStatus();
      renderScreen();
    } catch (error) {
      toast(error?.message === "user_already_exists" ? "Esse usuario ja existe" : "Nao foi possivel criar o acesso");
    }
    return;
  }

  try {
    const result = await readBackendJson("/api/auth/login", {
      method: "POST",
      requiresAuth: false,
      body: JSON.stringify({ username, password })
    });
    state.auth = normalizeAuth({
      ...state.auth,
      provider: "local",
      username,
      password: ""
    });
    saveState({ skipGoogleSync: true });
    saveSession(username, "local", result.sessionToken || "");
    setActiveAppScreen("hub");
    await refreshGoogleDriveBackendStatus();
    renderScreen();
  } catch (error) {
    toast("Usuario ou senha invalidos");
  }
}

async function handleLogout() {
  const serverSessionToken = getServerSessionToken();
  if (serverSessionToken) {
    try {
      await readBackendJson("/api/auth/logout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serverSessionToken}`
        }
      });
    } catch (error) {
      console.warn("Falha ao encerrar sessao no backend:", error);
    }
  }
  clearSession();
  clearCachedGoogleToken();
  resetGoogleDriveBackendStatus();
  setActiveAppScreen("hub");
  authMode = state.auth?.provider === "google" ? "login" : (state.auth?.username ? "login" : "create");
  closeHeaderMenu();
  renderScreen();
}

function renderSetupScreen() {
  const list = document.getElementById("platformConfigList");
  if (!getPlatforms().length) {
    list.innerHTML = `<div class="empty-state">Nenhuma plataforma cadastrada ainda.</div>`;
    resetPlatformForm();
    return;
  }

  list.innerHTML = getPlatforms().map((platform) => `
    <div class="setup-item">
      <div class="setup-item-main">
        ${platformIcon(platform)}
        <div class="setup-item-copy">
          <strong>${escapeHtml(platform.name)}</strong>
          <span>Sigla ${platform.icon} · ${platform.color}</span>
        </div>
      </div>
      <div class="setup-item-actions">
        <button class="btn btn-secondary" data-edit-platform="${escapeAttribute(platform.key)}" type="button">Editar</button>
        <button class="btn btn-secondary setup-remove" data-remove-platform="${escapeAttribute(platform.key)}" type="button">Remover</button>
      </div>
    </div>
  `).join("");
}

function openSetupEditor() {
  destroyCharts();
  setActiveAppScreen("hub");
  closeHeaderMenu();
  document.getElementById("authScreen").hidden = true;
  document.getElementById("setupScreen").hidden = false;
  const hubScreen = document.getElementById("hubScreen");
  if (hubScreen) hubScreen.hidden = true;
  document.getElementById("dashboardScreen").hidden = true;
  const calculatorScreen = document.getElementById("calculatorScreen");
  if (calculatorScreen) calculatorScreen.hidden = true;
  resetPlatformForm();
  renderSetupScreen();
}

function addPlatformConfig() {
  const name = document.getElementById("platformName").value.trim();
  const short = document.getElementById("platformShort").value.trim().toUpperCase();
  const color = document.getElementById("platformColor").value;

  if (!name) {
    toast("Informe o nome da plataforma");
    return;
  }

  if (editingPlatformKey) {
    const platform = getPlatformByKey(editingPlatformKey);
    if (!platform) {
      resetPlatformForm();
      renderSetupScreen();
      toast("Plataforma nao encontrada");
      return;
    }

    platform.name = name;
    platform.icon = (short || name.slice(0, 2)).slice(0, 3);
    platform.color = color;
    saveState();
    renderSetupScreen();
    resetPlatformForm();
    toast("Plataforma atualizada");
    return;
  }

  const key = slugifyText(name);
  if (getPlatforms().some((platform) => platform.key === key)) {
    toast("Essa plataforma ja foi cadastrada");
    return;
  }

  state.platforms.push(normalizePlatform({
    key,
    name,
    icon: short || name.slice(0, 2),
    color
  }, getPlatforms().length));

  saveState();
  renderSetupScreen();
  resetPlatformForm();
  toast("Plataforma adicionada");
}

function removePlatformConfig(key) {
  if (editingPlatformKey === key) resetPlatformForm();
  state.platforms = getPlatforms().filter((platform) => platform.key !== key);
  Object.values(state.db).forEach((monthData) => {
    if (!monthData) return;
    if (monthData.returns) delete monthData.returns[key];
    (monthData.days || []).forEach((day) => {
      delete day[key];
    });
  });
  saveState();
  renderSetupScreen();
  toast("Plataforma removida");
}

function finishSetup() {
  if (!getPlatforms().length) {
    toast("Cadastre ao menos uma plataforma");
    return;
  }

  if (!state.db[state.currentMonth]) ensureMonthData(state.currentMonth);
  saveState();
  setActiveAppScreen("hub");
  renderScreen();
}

function openHubScreen() {
  setActiveAppScreen("hub");
  closeHeaderMenu();
  renderScreen();
}

function openDashboardScreen() {
  setActiveAppScreen("dashboard");
  renderScreen();
}

function openCalculatorScreen() {
  setActiveAppScreen("calculator");
  closeHeaderMenu();
  renderScreen();
}

function renderHubScreen() {
  const username = state.auth?.username || "Usuario";
  document.getElementById("hubGreeting").textContent = `Bem-vindo, ${username}`;
  document.getElementById("hubPlatformCount").textContent = `${getPlatforms().length} plataforma${getPlatforms().length > 1 ? "s" : ""} cadastrada${getPlatforms().length > 1 ? "s" : ""}`;
}

function getPricingBaseCost() {
  return Number(state.pricing.productCost || 0)
    + Number(state.pricing.packagingCost || 0)
    + Number(state.pricing.extraCost || 0)
    + Number(state.pricing.shippingSubsidy || 0);
}

function calculatePlatformPrice(profile) {
  const variableRate = (Number(profile.commissionRate || 0) + Number(profile.transactionRate || 0)) / 100;
  const fixedCosts = getPricingBaseCost() + Number(profile.fixedFee || 0) + Number(profile.extraShippingCost || 0);
  const targetMarginRate = Number(state.pricing.targetMargin || 0) / 100;
  let idealPrice = 0;

  if (state.pricing.mode === "profit") {
    const denominator = 1 - variableRate;
    if (denominator <= 0) return null;
    idealPrice = (fixedCosts + Number(state.pricing.targetProfit || 0)) / denominator;
  } else {
    const denominator = 1 - variableRate - targetMarginRate;
    if (denominator <= 0) return null;
    idealPrice = fixedCosts / denominator;
  }

  const variableFees = idealPrice * variableRate;
  const profit = idealPrice - variableFees - fixedCosts;
  return {
    idealPrice,
    variableFees,
    profit,
    profitMargin: idealPrice > 0 ? (profit / idealPrice) * 100 : 0
  };
}

function renderCalculatorProfiles() {
  const container = document.getElementById("pricingPlatformGrid");
  container.innerHTML = getPlatforms().map((platform) => {
    const profile = state.pricing.profiles[platform.key] || normalizePricingProfile(platform);
    const result = calculatePlatformPrice(profile);
    const sourceBadge = profile.sourceType === "official"
      ? "Taxa base publica"
      : profile.sourceType === "estimated"
        ? "Taxa inicial estimada"
        : "Taxa personalizada";
    return `
      <article class="pricing-card">
        <div class="pricing-card-head">
          <div>
            <div class="pricing-platform">${platformBadge(platform)}</div>
            <div class="pricing-source">${sourceBadge}</div>
          </div>
          <div class="pricing-result">${result ? R(result.idealPrice) : "Revise taxas"}</div>
        </div>
        <div class="pricing-grid">
          <label class="fg">
            <span class="flabel">Comissao %</span>
            <input class="finput" type="number" step="0.1" min="0" data-pricing-profile="${platform.key}" data-field="commissionRate" value="${Number(profile.commissionRate || 0).toFixed(1)}">
          </label>
          <label class="fg">
            <span class="flabel">Taxa Extra %</span>
            <input class="finput" type="number" step="0.1" min="0" data-pricing-profile="${platform.key}" data-field="transactionRate" value="${Number(profile.transactionRate || 0).toFixed(1)}">
          </label>
          <label class="fg">
            <span class="flabel">Taxa Fixa R$</span>
            <input class="finput" type="number" step="0.01" min="0" data-pricing-profile="${platform.key}" data-field="fixedFee" value="${Number(profile.fixedFee || 0).toFixed(2)}">
          </label>
          <label class="fg">
            <span class="flabel">Frete Repasse R$</span>
            <input class="finput" type="number" step="0.01" min="0" data-pricing-profile="${platform.key}" data-field="extraShippingCost" value="${Number(profile.extraShippingCost || 0).toFixed(2)}">
          </label>
        </div>
        <div class="pricing-note">${profile.note || "Revise os custos dessa plataforma antes de usar o valor em producao."}</div>
        <div class="pricing-kpis">
          <div><span>Taxas variaveis</span><strong>${result ? R(result.variableFees) : "-"}</strong></div>
          <div><span>Lucro estimado</span><strong>${result ? R(result.profit) : "-"}</strong></div>
          <div><span>Margem final</span><strong>${result ? `${result.profitMargin.toFixed(1)}%` : "-"}</strong></div>
        </div>
      </article>
    `;
  }).join("");
}

function renderCalculatorScreen() {
  document.getElementById("calculatorTitle").textContent = `Calculadora de ${getPlatforms().length} Plataforma${getPlatforms().length > 1 ? "s" : ""}`;
  document.getElementById("pricingModeMargin").classList.toggle("active", state.pricing.mode === "margin");
  document.getElementById("pricingModeProfit").classList.toggle("active", state.pricing.mode === "profit");
  document.getElementById("pricingProductCost").value = Number(state.pricing.productCost || 0).toFixed(2);
  document.getElementById("pricingPackagingCost").value = Number(state.pricing.packagingCost || 0).toFixed(2);
  document.getElementById("pricingExtraCost").value = Number(state.pricing.extraCost || 0).toFixed(2);
  document.getElementById("pricingShippingSubsidy").value = Number(state.pricing.shippingSubsidy || 0).toFixed(2);
  document.getElementById("pricingTargetMargin").value = Number(state.pricing.targetMargin || 0).toFixed(1);
  document.getElementById("pricingTargetProfit").value = Number(state.pricing.targetProfit || 0).toFixed(2);
  document.getElementById("pricingTargetMarginWrap").hidden = state.pricing.mode !== "margin";
  document.getElementById("pricingTargetProfitWrap").hidden = state.pricing.mode !== "profit";
  document.getElementById("pricingBaseCost").textContent = R(getPricingBaseCost());
  renderCalculatorProfiles();
}

function renderTabs() {
  const months = Object.keys(state.db);
  document.getElementById("monthTabs").innerHTML = months
    .map((month) => `<button class="month-tab ${month === state.currentMonth ? "active" : ""}" data-month="${month}" type="button">${SHORT[month] || month}</button>`)
    .join("");

  const options = months
    .map((month) => `<option value="${month}"${month === state.currentMonth ? " selected" : ""}>${month}</option>`)
    .join("");

  ["inputMonth", "returnMonth"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = options;
  });
}

function renderDashboardShell() {
  document.getElementById("brandTitle").textContent = `Dashboard de ${getPlatforms().length} Plataforma${getPlatforms().length > 1 ? "s" : ""}`;
  renderCurrentUserBadge();
  renderSaleInputs();
  renderTabs();
  const inputMonth = document.getElementById("inputMonth");
  if (inputMonth) inputMonth.value = state.currentMonth;
  syncSaleDateWithMonth(true);
  renderAll();
  const baseMessage = getPlatforms().length ? `Dados locais de ${state.auth.username}` : `Dados locais de ${state.auth.username} · cadastre plataformas em "Plataformas"`;
  const savedAt = formatSavedAt(loadLastSavedAt());
  setStorageStatus(savedAt ? `${baseMessage} · salvo em ${savedAt}` : baseMessage);
  const returnMonth = document.getElementById("returnMonth");
  if (returnMonth) returnMonth.value = state.currentMonth;
  renderGoogleUi();
}

function switchMonth(month) {
  state.currentMonth = month;
  saveState();
  renderTabs();
  const inputMonth = document.getElementById("inputMonth");
  if (inputMonth) inputMonth.value = month;
  syncSaleDateWithMonth(true);
  renderAll();
}

function renderKPIs() {
  const totals = calcTotals(state.currentMonth);
  const previousName = prevMonth(state.currentMonth);
  const previousTotals = previousName ? calcTotals(previousName) : null;
  const returnsPercent = getReturnRate(totals.totalRet, totals.gross);

  document.getElementById("kpiRow").innerHTML = `
    <div class="kpi-card"><div class="kpi-label">Faturamento Bruto</div><div class="kpi-value">${RS(totals.gross)}</div><div class="kpi-change">${previousTotals ? `${varH(totals.gross, previousTotals.gross)} vs ${previousName}` : state.currentMonth}</div></div>
    <div class="kpi-card"><div class="kpi-label">Faturamento Liquido</div><div class="kpi-value">${RS(totals.net)}</div><div class="kpi-change">${previousTotals ? `${varH(totals.net, previousTotals.net)} vs ${previousName}` : dash}</div></div>
    <div class="kpi-card"><div class="kpi-label">Devolucoes</div><div class="kpi-value">${RS(totals.totalRet)}</div><div class="kpi-change">${previousTotals ? `${varH(totals.totalRet, previousTotals.totalRet)} vs ${previousName}` : dash}</div><div class="kpi-change" style="color:var(--muted)">${returnsPercent.toFixed(1)}% das vendas</div><div class="returns-bar"><div class="returns-fill" style="width:${Math.min(returnsPercent, 100)}%"></div></div></div>
    <div class="kpi-card"><div class="kpi-label">Plataformas Ativas</div><div class="kpi-value">${getPlatforms().filter((platform) => totals.sales[platform.key] > 0).length}</div><div class="kpi-change" style="color:var(--muted)">de ${getPlatforms().length} cadastradas</div></div>
  `;
}

function renderDailyChart() {
  const data = state.db[state.currentMonth];
  const active = getPlatforms().filter((platform) => data.days.some((day) => Number(day[platform.key] || 0) > 0));
  const ctx = document.getElementById("dailyChart").getContext("2d");
  if (dailyChart) dailyChart.destroy();

  if (!active.length || !data.days.length) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    return;
  }

  dailyChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: data.days.map((day) => day.d),
      datasets: active.map((platform) => ({
        label: platform.name,
        data: data.days.map((day) => Number(day[platform.key] || 0)),
        backgroundColor: getPlatformVisualColor(platform, 0.73),
        borderColor: getPlatformVisualColor(platform),
        borderWidth: 0,
        borderRadius: 2,
        borderSkipped: false
      }))
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: "#6b7280",
            font: { family: "Inter", size: 10 },
            boxWidth: 7,
            padding: 10
          }
        },
        tooltip: {
          backgroundColor: "#181c24",
          borderColor: "rgba(255,255,255,.1)",
          borderWidth: 1,
          callbacks: {
            label: (context) => ` ${context.dataset.label}: ${R(context.raw)}`
          }
        }
      },
      scales: {
        x: {
          stacked: true,
          ticks: { color: "#4b5563", font: { size: 8 }, maxRotation: 50 },
          grid: { display: false },
          border: { display: false }
        },
        y: {
          stacked: true,
          ticks: { color: "#4b5563", font: { size: 9 }, callback: (value) => RS(value) },
          grid: { color: "rgba(255,255,255,.04)" },
          border: { display: false }
        }
      }
    }
  });
}

function renderDailyTable() {
  const data = state.db[state.currentMonth];
  const active = getPlatforms().filter((platform) => data.days.some((day) => Number(day[platform.key] || 0) > 0));
  if (!data.days.length || !active.length) {
    document.getElementById("dailyDetailsTable").innerHTML = `<tbody><tr><td style="text-align:left;padding:20px;color:var(--muted)">Nenhuma venda registrada neste mes.</td></tr></tbody>`;
    return;
  }

  const totals = {};
  active.forEach((platform) => {
    totals[platform.key] = data.days.reduce((sum, day) => sum + Number(day[platform.key] || 0), 0);
  });
  const grandTotal = active.reduce((sum, platform) => sum + totals[platform.key], 0);

  const head = `<thead><tr><th>Data</th>${active.map((platform) => `<th><span class="chdot" style="background:${getPlatformVisualColor(platform)}"></span>${platform.icon}</th>`).join("")}<th>Total</th></tr></thead>`;
  const body = data.days.map((day, dayIndex) => {
    const rowTotal = active.reduce((sum, platform) => sum + Number(day[platform.key] || 0), 0);
    return `<tr><td>${day.d}</td>${active.map((platform) => {
      const value = Number(day[platform.key] || 0);
      return `<td><span class="ceditable${value === 0 ? " czero" : ""}" contenteditable="true" data-day-index="${dayIndex}" data-platform-key="${platform.key}">${value === 0 ? "-" : value.toFixed(2)}</span></td>`;
    }).join("")}<td style="color:var(--muted2);font-size:11px">${rowTotal > 0 ? RS(rowTotal) : "-"}</td></tr>`;
  }).join("");
  const foot = `<tfoot><tr><td>Total</td>${active.map((platform) => `<td>${RS(totals[platform.key])}</td>`).join("")}<td>${RS(grandTotal)}</td></tr></tfoot>`;
  document.getElementById("dailyDetailsTable").innerHTML = head + body + foot;
}

function selectAll(el) {
  const range = document.createRange();
  range.selectNodeContents(el);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

function updateCell(dayIndex, key, el) {
  const value = parseFloat((el.textContent || "").replace(/[^0-9.,]/g, "").replace(",", ".")) || 0;
  state.db[state.currentMonth].days[dayIndex][key] = value;
  state.db[state.currentMonth].days = sortDays(state.db[state.currentMonth].days);
  saveState();
  renderAll();
  toast("Valor atualizado");
}

function renderDonut() {
  const totals = calcTotals(state.currentMonth);
  const active = getPlatforms().filter((platform) => totals.sales[platform.key] > 0);
  const netValues = active.map((platform) => Math.max(0, Number(totals.sales[platform.key] || 0) - Number(totals.ret[platform.key] || 0)));
  const total = netValues.reduce((sum, value) => sum + value, 0);
  const ctx = document.getElementById("donutChart").getContext("2d");
  if (donutChart) donutChart.destroy();

  if (!active.length || total <= 0) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    document.getElementById("donutLegend").innerHTML = `<div class="empty-state">Sem dados suficientes para o mix.</div>`;
    return;
  }

  donutChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: active.map((platform) => platform.name),
      datasets: [{
        data: netValues,
        backgroundColor: active.map((platform) => getPlatformVisualColor(platform, 0.8)),
        borderColor: active.map((platform) => getPlatformVisualColor(platform)),
        borderWidth: 1,
        hoverOffset: 5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "70%",
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#181c24",
          borderColor: "rgba(255,255,255,.1)",
          borderWidth: 1,
          callbacks: {
            label: (context) => ` ${context.label}: ${R(context.raw)} (${total > 0 ? ((context.raw / total) * 100).toFixed(1) : 0}%)`
          }
        }
      }
    }
  });

  document.getElementById("donutLegend").innerHTML = active.map((platform, index) => {
    const value = netValues[index];
    const percent = total > 0 ? (value / total) * 100 : 0;
    const tone = getPlatformTone(platform);
    const visualColor = getPlatformVisualColor(platform);
    return `<div class="dleg-item"><div class="dleg-l"><div class="dleg-dot" style="background:${visualColor};border-color:${tone.softBorder}"></div><span>${escapeHtml(platform.name)}</span></div><div style="text-align:right"><span class="dleg-pct" style="color:${tone.text}">${percent.toFixed(1)}%</span><div class="dleg-bar"><div class="dleg-fill" style="width:${percent}%;background:${visualColor}"></div></div></div></div>`;
  }).join("");
}

function renderWeekly() {
  const weekly = getWeekBuckets(state.currentMonth, state.db[state.currentMonth].days);
  const previousName = prevMonth(state.currentMonth);
  const previousWeekly = previousName && state.db[previousName]
    ? getWeekBuckets(previousName, state.db[previousName].days)
    : [];
  const total = weekly.reduce((sum, item) => sum + item.total, 0);
  const max = Math.max(...weekly.map((item) => item.total), 1);
  const colors = ["#e8ff47", "#47d4ff", "#a78bfa", "#34d399", "#fb923c", "#f472b6"];
  const weekBars = document.getElementById("weekBars");
  weekBars.style.gridTemplateColumns = `repeat(${Math.max(weekly.length, 1)}, minmax(0,1fr))`;

  weekBars.innerHTML = weekly.map((item, index) => {
    const value = item.total;
    const percent = total > 0 ? (value / total) * 100 : 0;
    const previousValue = previousWeekly[index]?.total || 0;
    const comparison = previousName ? varH(value, previousValue) : "";
    const color = colors[index % colors.length];
    return `<div class="wbwrap"><div class="wblabel">${item.shortLabel}</div><div class="wbpct">${escapeHtml(item.label)}</div><div class="wbcon"><div class="wbar" style="height:${value > 0 ? Math.max(7, (value / max) * 100) : 0}%;background:${color};opacity:${value > 0 ? 1 : .15}"></div></div><div class="wbval" style="color:${color}">${value > 0 ? RS(value) : "-"}</div><div class="wbpct">${value > 0 ? `${percent.toFixed(1)}%` : ""}</div><div class="wbdelta">${comparison || dash}</div></div>`;
  }).join("");
}

function renderBestDays() {
  const data = state.db[state.currentMonth];
  const best = {};
  data.days.forEach((day) => {
    getPlatforms().forEach((platform) => {
      const value = Number(day[platform.key] || 0);
      if (!best[platform.key] || value > best[platform.key].v) best[platform.key] = { v: value, d: day.d };
    });
  });

  const html = getPlatforms()
    .filter((platform) => best[platform.key] && best[platform.key].v > 0)
    .map((platform) => `<div class="bdrow"><div class="bdl"><div class="pdot" style="background:${getPlatformVisualColor(platform)}"></div>${escapeHtml(platform.name)}</div><div class="bdr"><div class="bdval">${RS(best[platform.key].v)}</div><div class="bddate">${escapeHtml(best[platform.key].d)}</div></div></div>`)
    .join("");
  document.getElementById("bestDayGrid").innerHTML = html || `<div class="empty-state">Ainda nao ha dias destacados.</div>`;
}

function renderPlatformTable() {
  const totals = calcTotals(state.currentMonth);
  const previousName = prevMonth(state.currentMonth);
  const previousTotals = previousName ? calcTotals(previousName) : null;
  const active = getPlatforms().filter((platform) => totals.sales[platform.key] > 0 || totals.ret[platform.key] > 0);
  if (!active.length) {
    document.getElementById("platformTable").innerHTML = `<tbody><tr><td style="text-align:left;padding:20px;color:var(--muted)">Cadastre vendas para ver o resumo por plataforma.</td></tr></tbody>`;
    return;
  }
  const netTotal = active.reduce((sum, platform) => sum + Math.max(0, totals.sales[platform.key] - totals.ret[platform.key]), 0);

  document.getElementById("platformTable").innerHTML = `
    <thead><tr><th>Plataforma</th><th>Bruto</th><th>Devolucoes</th><th>% Dev.</th><th>vs Mes Ant.</th><th>Liquido</th><th>% Mix</th></tr></thead>
    <tbody>${active.map((platform) => {
      const value = totals.sales[platform.key] || 0;
      const returns = totals.ret[platform.key] || 0;
      const net = Math.max(0, value - returns);
      const previousNet = previousTotals ? Math.max(0, (previousTotals.sales[platform.key] || 0) - (previousTotals.ret[platform.key] || 0)) : null;
      const returnRate = getReturnRate(returns, value);
      const percent = netTotal > 0 ? ((net / netTotal) * 100).toFixed(1) : "0.0";
      const tone = getPlatformTone(platform);
      return `<tr>
        <td data-label="Plataforma">${platformBadge(platform)}</td>
        <td data-label="Bruto">${R(value)}</td>
        <td data-label="Devolucoes" class="neg">${returns > 0 ? R(returns) : "-"}</td>
        <td data-label="% Dev." style="color:var(--muted)">${returnRate.toFixed(1)}%</td>
        <td data-label="vs Mes Ant.">${previousTotals ? varH(net, previousNet) : dash}</td>
        <td data-label="Liquido" style="font-family:var(--font-ui);font-weight:700">${R(net)}</td>
        <td data-label="% Mix"><span class="ppill" style="color:${tone.text};background:${tone.softBg};border-color:${tone.softBorder}">${percent}%</span></td>
      </tr>`;
    }).join("")}</tbody>
    <tfoot><tr>
      <td data-label="Plataforma" style="color:var(--accent)">Total</td>
      <td data-label="Bruto">${R(totals.gross)}</td>
      <td data-label="Devolucoes" class="neg">${R(totals.totalRet)}</td>
      <td data-label="% Dev." style="color:var(--muted)">${getReturnRate(totals.totalRet, totals.gross).toFixed(1)}%</td>
      <td data-label="vs Mes Ant.">${previousTotals ? varH(totals.net, previousTotals.net) : dash}</td>
      <td data-label="Liquido" style="color:var(--accent)">${R(totals.net)}</td>
      <td data-label="% Mix"><span class="ppill">100%</span></td>
    </tr></tfoot>
  `;
}

function renderMonthCompare() {
  const totals = calcTotals(state.currentMonth);
  const previousName = prevMonth(state.currentMonth);
  const previousTotals = previousName ? calcTotals(previousName) : null;

  let html = `<div class="compare-grid">
    <div class="compare-card compare-card-current">
      <div class="compare-month">${state.currentMonth}</div>
      <div class="compare-value compare-value-current">${RS(totals.net)}</div>
      <div class="compare-meta">Bruto: ${RS(totals.gross)}</div>
      <div class="compare-meta compare-meta-neg">Dev: ${RS(totals.totalRet)}</div>
    </div>
    ${previousTotals ? `<div class="compare-card">
      <div class="compare-month">${previousName}</div>
      <div class="compare-value">${RS(previousTotals.net)}</div>
      <div class="compare-meta">Bruto: ${RS(previousTotals.gross)}</div>
      <div class="compare-meta compare-meta-neg">Dev: ${RS(previousTotals.totalRet)}</div>
    </div>` : `<div class="compare-card compare-card-empty"><span>Sem mes anterior</span></div>`}
  </div>`;

  if (previousTotals) {
    html += `<div class="compare-section-title">Variacao por plataforma</div>`;
    getPlatforms().filter((platform) => totals.sales[platform.key] > 0 || previousTotals.sales[platform.key] > 0).forEach((platform) => {
      const currentNet = Math.max(0, totals.sales[platform.key] - totals.ret[platform.key]);
      const previousNet = Math.max(0, previousTotals.sales[platform.key] - previousTotals.ret[platform.key]);
      html += `<div class="compare-row">${platformBadge(platform)}<div class="compare-delta">${varH(currentNet, previousNet)}</div></div>`;
    });
  }

  document.getElementById("monthCompare").innerHTML = html;
}

function renderSaleInputs() {
  document.getElementById("saleInputs").innerHTML = getPlatforms().map((platform) => `
    <div class="fg">
      <label class="flabel" for="sale_${escapeAttribute(platform.key)}" style="color:${getReadablePlatformColor(platform.color)}">${escapeHtml(platform.name)}</label>
      <input type="number" class="finput" id="sale_${escapeAttribute(platform.key)}" placeholder="0,00" step="0.01" min="0">
    </div>
  `).join("");
}

function renderReturnInputs() {
  const month = document.getElementById("returnMonth")?.value || state.currentMonth;
  ensureMonthData(month);
  const returns = state.db[month].returns || {};
  document.getElementById("returnInputs").innerHTML = getPlatforms().map((platform) => `
    <div class="fg">
      <label class="flabel" for="ret_${escapeAttribute(platform.key)}" style="color:${getReadablePlatformColor(platform.color)}">${escapeHtml(platform.name)}</label>
      <input type="number" class="finput" id="ret_${escapeAttribute(platform.key)}" value="${Number(returns[platform.key] || 0).toFixed(2)}" step="0.01" min="0">
    </div>
  `).join("");
}

function renderProjection() {
  const totals = calcTotals(state.currentMonth);
  const projection = calcProjection(state.currentMonth);
  const previousName = prevMonth(state.currentMonth);
  const previousTotals = previousName ? calcTotals(previousName) : null;

  document.getElementById("projectionGrid").innerHTML = `
    <div class="projection-card">
      <div class="projection-label">Dias Lancados</div>
      <div class="projection-value">${projection.loggedDays}/${projection.monthDays}</div>
      <div class="projection-sub">Base usada para a media do mes</div>
    </div>
    <div class="projection-card">
      <div class="projection-label">Projecao de Vendas</div>
      <div class="projection-value">${RS(projection.projectedGross)}</div>
      <div class="projection-sub">Media diaria: ${RS(projection.salesDailyAverage)}</div>
      <div class="projection-meta">${previousTotals ? `vs bruto de ${previousName}: ${varH(projection.projectedGross, previousTotals.gross)}` : "Sem mes anterior para comparar"}</div>
    </div>
    <div class="projection-card">
      <div class="projection-label">Projecao de Devolucoes</div>
      <div class="projection-value neg">${RS(projection.projectedReturns)}</div>
      <div class="projection-sub">Media diaria: ${RS(projection.returnsDailyAverage)}</div>
      <div class="projection-meta">Taxa projetada: ${projection.projectedReturnRate.toFixed(1)}% das vendas</div>
    </div>
    <div class="projection-card">
      <div class="projection-label">Projecao Liquida</div>
      <div class="projection-value" style="color:var(--accent)">${RS(projection.projectedNet)}</div>
      <div class="projection-sub">Taxa atual de devolucao: ${projection.currentReturnRate.toFixed(1)}%</div>
      <div class="projection-meta">Realizado ate agora: ${RS(totals.net)}</div>
    </div>
  `;
}

function renderCommission() {
  const totals = calcTotals(state.currentMonth);
  const commission = totals.net * 0.01;
  document.getElementById("commissionCard").innerHTML = `
    <div class="commission-shell">
      <div class="commission-copy">
        <div class="commission-label">Minha Comissao</div>
        <div class="commission-title">1% do faturamento liquido</div>
        <div class="commission-sub">Calculado sobre o faturamento liquido realizado do mes atual.</div>
      </div>
      <div class="commission-value-wrap">
        <div class="commission-value">${R(commission)}</div>
        <div class="commission-meta">Base de calculo: ${R(totals.net)}</div>
      </div>
    </div>
  `;
}

function renderAll() {
  if (!getPlatforms().length || !state.db[state.currentMonth]) return;
  renderKPIs();
  renderDailyChart();
  renderDailyTable();
  renderDonut();
  renderWeekly();
  renderBestDays();
  renderPlatformTable();
  renderMonthCompare();
  renderProjection();
  renderCommission();
}

function switchTab(name) {
  document.querySelectorAll(".itab").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === name);
  });
  document.querySelectorAll(".ipanel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `panel-${name}`);
  });
  if (name === "returns") renderReturnInputs();
}

function addSale() {
  const month = document.getElementById("inputMonth").value;
  const dateValue = document.getElementById("inputDate").value;
  if (!dateValue) {
    toast("Selecione a data");
    return;
  }

  ensureMonthData(month);

  const parts = dateValue.split("-");
  const selectedMonthIndex = getMonthIndexByName(month);
  if (selectedMonthIndex < 0) {
    toast("Mes invalido");
    return;
  }
  if (Number(parts[1]) !== selectedMonthIndex + 1) {
    document.getElementById("inputDate").value = getSuggestedInputDate(month);
    toast("A data foi ajustada para o mes selecionado");
    return;
  }
  const label = `${parts[2]}/${parts[1]}`;
  const entry = { d: label };
  let hasAnyValue = false;

  getPlatforms().forEach((platform) => {
    const value = parseFloat(document.getElementById(`sale_${platform.key}`)?.value || 0) || 0;
    entry[platform.key] = value;
    if (value > 0) hasAnyValue = true;
  });

  if (!hasAnyValue) {
    toast("Insira ao menos um valor");
    return;
  }

  const existingIndex = state.db[month].days.findIndex((day) => day.d === label);
  if (existingIndex >= 0) {
    getPlatforms().forEach((platform) => {
      state.db[month].days[existingIndex][platform.key] = Number(state.db[month].days[existingIndex][platform.key] || 0) + Number(entry[platform.key] || 0);
    });
  } else {
    state.db[month].days.push(normalizeDay(entry));
    state.db[month].days = sortDays(state.db[month].days);
  }

  saveState();
  if (month === state.currentMonth) renderAll();
  clearSale();
  toast(`Vendas registradas em ${month}`);
}

function clearSale() {
  getPlatforms().forEach((platform) => {
    const el = document.getElementById(`sale_${platform.key}`);
    if (el) el.value = "";
  });
}

function saveReturns() {
  const month = document.getElementById("returnMonth").value;
  ensureMonthData(month);

  getPlatforms().forEach((platform) => {
    state.db[month].returns[platform.key] = parseFloat(document.getElementById(`ret_${platform.key}`)?.value || 0) || 0;
  });

  saveState();
  if (month === state.currentMonth) renderAll();
  toast(`Devolucoes salvas para ${month}`);
}

function openAddMonth() {
  closeHeaderMenu();
  newMonthSel = null;
  const existing = Object.keys(state.db);
  document.getElementById("monthPicker").innerHTML = ALL_MONTHS.map((month) => {
    const done = existing.includes(month);
    return `<button class="mbtn" ${done ? "disabled" : ""} data-picker-month="${month}" type="button">${SHORT[month] || month}${done ? " ✓" : ""}</button>`;
  }).join("");
  document.getElementById("addMonthModal").classList.add("open");
}

function openDeleteMonthModal() {
  const months = Object.keys(state.db);
  if (months.length <= 1) {
    toast("Mantenha ao menos um mes no dashboard");
    return;
  }
  pendingDeleteMonth = state.currentMonth;
  document.getElementById("deleteMonthSubtitle").textContent = `Confirme a exclusao de ${pendingDeleteMonth}.`;
  closeModal("addMonthModal");
  document.getElementById("deleteMonthModal").classList.add("open");
}

function pickMonth(month, button) {
  newMonthSel = month;
  document.querySelectorAll("#monthPicker .mbtn").forEach((btn) => btn.classList.remove("sel"));
  button.classList.add("sel");
}

function confirmAddMonth() {
  if (!newMonthSel) {
    toast("Selecione um mes");
    return;
  }
  ensureMonthData(newMonthSel);
  state.currentMonth = newMonthSel;
  saveState();
  closeModal("addMonthModal");
  renderTabs();
  renderAll();
  toast(`${newMonthSel} criado`);
}

function confirmDeleteMonth() {
  if (!pendingDeleteMonth || !state.db[pendingDeleteMonth]) {
    closeModal("deleteMonthModal");
    return;
  }

  delete state.db[pendingDeleteMonth];
  const remainingMonths = Object.keys(state.db);
  state.currentMonth = remainingMonths.includes(state.currentMonth)
    ? state.currentMonth
    : (remainingMonths[remainingMonths.length - 1] || getDefaultMonth());
  ensureMonthData(state.currentMonth);
  pendingDeleteMonth = null;
  saveState();
  closeModal("deleteMonthModal");
  renderTabs();
  renderAll();
  toast("Mes excluido com sucesso");
}

function closeModal(id) {
  document.getElementById(id).classList.remove("open");
  if (id === "deleteMonthModal") pendingDeleteMonth = null;
  if (id === "importBackupModal") pendingImportMode = "merge";
}

function openImportBackupModal() {
  closeHeaderMenu();
  pendingImportMode = "merge";
  updateImportModeUI();
  document.getElementById("importBackupModal").classList.add("open");
}

function openChangePasswordModal() {
  if (!isLocalAuth()) {
    toast("A conta Google nao usa senha local");
    return;
  }
  closeHeaderMenu();
  document.getElementById("currentPasswordInput").value = "";
  document.getElementById("newPasswordInput").value = "";
  document.getElementById("confirmPasswordInput").value = "";
  document.getElementById("changePasswordModal").classList.add("open");
}

function openDailyDetailsModal() {
  closeHeaderMenu();
  renderDailyTable();
  document.getElementById("dailyDetailsModal").classList.add("open");
}

async function saveChangedPassword() {
  if (!isLocalAuth()) {
    toast("A conta Google nao usa senha local");
    return;
  }
  const currentPassword = document.getElementById("currentPasswordInput").value;
  const newPassword = document.getElementById("newPasswordInput").value;
  const confirmPassword = document.getElementById("confirmPasswordInput").value;

  if (!state.auth?.username) {
    toast("Nenhum usuario encontrado");
    return;
  }
  if (!currentPassword || !newPassword || !confirmPassword) {
    toast("Preencha todos os campos");
    return;
  }
  if (newPassword.length < 4) {
    toast("Use pelo menos 4 caracteres");
    return;
  }
  if (newPassword !== confirmPassword) {
    toast("A confirmacao da senha nao confere");
    return;
  }

  try {
    await readBackendJson("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({
        username: state.auth.username,
        currentPassword,
        newPassword
      })
    });
    state.auth = normalizeAuth({
      ...state.auth,
      password: ""
    });
    saveState({ skipGoogleSync: true });
    closeModal("changePasswordModal");
    toast("Senha atualizada com sucesso");
  } catch (error) {
    toast(error?.message === "invalid_current_password"
      ? "Senha atual incorreta"
      : "Nao foi possivel atualizar a senha");
  }
}

function openReport() {
  closeHeaderMenu();
  const month = state.currentMonth;
  const totals = calcTotals(month);
  const previousName = prevMonth(month);
  const previousTotals = previousName ? calcTotals(previousName) : null;
  const active = getPlatforms().filter((platform) => totals.sales[platform.key] > 0 || totals.ret[platform.key] > 0);
  const maxNet = previousTotals ? Math.max(totals.net, previousTotals.net, 1) : Math.max(totals.net, 1);

  document.getElementById("reportTitle").textContent = `Relatorio - ${month} ${getCurrentYear()}`;

  const platformRows = active.map((platform) => {
    const value = totals.sales[platform.key] || 0;
    const returns = totals.ret[platform.key] || 0;
    const net = Math.max(0, value - returns);
    const previousValue = previousTotals ? Math.max(0, (previousTotals.sales[platform.key] || 0) - (previousTotals.ret[platform.key] || 0)) : null;
    return `<tr><td>${platformBadge(platform)}</td><td>${R(value)}</td><td class="neg">${returns > 0 ? R(returns) : "-"}</td><td style="font-size:12px;color:var(--muted)">${value > 0 ? ((returns / value) * 100).toFixed(1) : 0}%</td><td style="font-family:var(--font-ui);font-weight:700">${R(net)}</td><td>${previousValue !== null ? varH(net, previousValue) : dash}</td></tr>`;
  }).join("");

  const compareRows = previousTotals ? active.map((platform) => {
    const currentNet = Math.max(0, (totals.sales[platform.key] || 0) - (totals.ret[platform.key] || 0));
    const previousNet = Math.max(0, (previousTotals.sales[platform.key] || 0) - (previousTotals.ret[platform.key] || 0));
    const maxValue = Math.max(currentNet, previousNet, 1);
    return `<div class="pcrow"><div class="pcname">${platformBadge(platform, true)}</div><div class="pcbars"><div class="pcbar-cur" style="width:${((currentNet / maxValue) * 100).toFixed(0)}%;background:${platform.color}"></div><div class="pcbar-prev" style="width:${((previousNet / maxValue) * 100).toFixed(0)}%;background:${platform.color}"></div></div><div class="pcvals"><div class="pcval-cur">${RS(currentNet)}</div><div class="pcval-var">${varH(currentNet, previousNet)}</div></div></div>`;
  }).join("") : '<div style="color:var(--muted);font-size:12px;padding:10px 0">Sem mes anterior.</div>';

  document.getElementById("reportContent").innerHTML = `
    <div class="rkpis">
      <div class="rkpi"><div class="rkpi-label">Faturamento Bruto</div><div class="rkpi-val">${R(totals.gross)}</div><div class="rkpi-sub">${previousTotals ? varH(totals.gross, previousTotals.gross) : ""}</div></div>
      <div class="rkpi"><div class="rkpi-label">Devolucoes</div><div class="rkpi-val neg">${R(totals.totalRet)}</div><div class="rkpi-sub" style="color:var(--muted)">${totals.gross > 0 ? ((totals.totalRet / totals.gross) * 100).toFixed(1) : 0}% do bruto</div></div>
      <div class="rkpi" style="border:1px solid rgba(232,255,71,.25)"><div class="rkpi-label">Faturamento Liquido</div><div class="rkpi-val" style="color:var(--accent)">${R(totals.net)}</div><div class="rkpi-sub">${previousTotals ? varH(totals.net, previousTotals.net) : ""}</div></div>
    </div>
    <div class="msection">
      <div class="msec-title">Detalhamento por Plataforma</div>
      <table class="rtable"><thead><tr><th>Plataforma</th><th>Bruto</th><th>Devolucoes</th><th>% Dev.</th><th>Liquido</th><th>vs. Mes Ant.</th></tr></thead><tbody>${platformRows}</tbody><tfoot><tr><td style="color:var(--accent)">Total</td><td>${R(totals.gross)}</td><td class="neg">${R(totals.totalRet)}</td><td style="color:var(--muted)">${totals.gross > 0 ? ((totals.totalRet / totals.gross) * 100).toFixed(1) : 0}%</td><td style="color:var(--accent)">${R(totals.net)}</td><td>${previousTotals ? varH(totals.net, previousTotals.net) : "-"}</td></tr></tfoot></table>
    </div>
    ${previousTotals ? `<div class="msection">
      <div class="msec-title">Comparativo Visual - ${month} vs ${previousName}</div>
      <div class="cvis">
        <div class="cvis-item"><div class="cvis-month">${month}</div><div class="cvis-val" style="color:var(--accent)">${R(totals.net)}</div><div style="font-size:11px;color:var(--muted);margin-bottom:6px">Bruto: ${R(totals.gross)} · Dev: ${R(totals.totalRet)}</div><div class="cvis-bar"><div class="cvis-fill" style="width:${((totals.net / maxNet) * 100).toFixed(1)}%;background:var(--accent)"></div></div></div>
        <div class="cvis-item"><div class="cvis-month">${previousName}</div><div class="cvis-val">${R(previousTotals.net)}</div><div style="font-size:11px;color:var(--muted);margin-bottom:6px">Bruto: ${R(previousTotals.gross)} · Dev: ${R(previousTotals.totalRet)}</div><div class="cvis-bar"><div class="cvis-fill" style="width:${((previousTotals.net / maxNet) * 100).toFixed(1)}%;background:var(--accent2)"></div></div></div>
      </div>
      <div class="msec-title">Por Plataforma - barra solida = atual · transparente = anterior</div>
      ${compareRows}
    </div>` : ""}`;

  document.getElementById("reportModal").classList.add("open");
}

async function exportReportPNG() {
  const button = document.getElementById("exportReportButton");
  const title = document.getElementById("reportTitle")?.textContent || "Relatorio";
  const subtitle = document.querySelector("#reportModal .modal-subtitle")?.textContent || "";
  const reportModal = document.querySelector("#reportModal .modal");

  if (!reportModal || !window.html2canvas) {
    toast("Nao foi possivel exportar o relatorio");
    return;
  }

  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = "Exportando...";

  const exportRoot = document.createElement("div");
  exportRoot.className = "pdf-export-root";
  exportRoot.innerHTML = `
    <div class="modal rmodal pdf-export-modal">
      <div class="mheader">
        <div>
          <div class="mtitle">${title}</div>
          <div class="card-sub modal-subtitle">${subtitle}</div>
        </div>
      </div>
      <div>${document.getElementById("reportContent").innerHTML}</div>
    </div>
  `;
  document.body.appendChild(exportRoot);

  try {
    const canvas = await window.html2canvas(exportRoot.querySelector(".pdf-export-modal"), {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true
    });
    const imageURL = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = imageURL;
    link.download = `${slugifyText(title)}.png`;
    link.click();
    toast("PNG exportado com sucesso");
  } catch (error) {
    console.error(error);
    toast("Nao foi possivel exportar o PNG");
  } finally {
    exportRoot.remove();
    button.disabled = false;
    button.textContent = originalLabel;
  }
}

function getBackupPayload() {
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    theme: currentTheme,
    sessionUser,
    state
  };
}

function exportBackup() {
  const payload = JSON.stringify(getBackupPayload(), null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `dashboard-vendas-backup-${slugifyText(state.currentMonth || "dados")}.json`;
  link.click();
  URL.revokeObjectURL(url);
  setStorageStatus("Backup exportado com sucesso");
  toast("Backup exportado com sucesso");
  closeHeaderMenu();
}

async function saveNow() {
  saveState();
  if (hasGoogleDriveAccess()) {
    await syncGoogleDriveNow();
  } else {
    toast("Dados salvos localmente");
  }
  closeHeaderMenu();
}

function replaceImportedState(restoredState) {
  state.platforms = restoredState.platforms.map((platform) => clone(platform));
  state.db = clone(restoredState.db || {});
  state.currentMonth = restoredState.currentMonth || getDefaultMonth();
  ensureStateMonths(state);
}

function applyImportedBackup(payload, mode = "merge") {
  const previousAuth = state.auth ? clone(state.auth) : null;
  const previousSession = sessionUser;
  const source = payload?.state
    ? payload.state
    : payload?.dashboardData
      ? convertLegacyBackup(payload)
      : payload;
  const restoredState = normalizeState(source);
  state.auth = previousAuth || restoredState.auth;
  if (mode === "replace") {
    replaceImportedState(restoredState);
  } else {
    mergeImportedState(restoredState);
  }
  if (payload?.theme === "light" || payload?.theme === "dark") currentTheme = payload.theme;
  saveState();
  saveTheme();
  if (previousSession && state.auth?.username === previousSession.username && (state.auth?.provider || "local") === previousSession.provider) {
    saveSession(previousSession.username, previousSession.provider, previousSession.serverSessionToken || "");
  }
  applyTheme();
  renderScreen();
  void migrateLegacyLocalAuthIfNeeded();
}

function updatePricingValue(field, value) {
  if (!state.pricing) state.pricing = normalizePricing({}, getPlatforms());
  state.pricing[field] = Number(value || 0);
  saveState({ skipGoogleSync: true });
  if (activeAppScreen === "calculator") renderCalculatorScreen();
}

function updatePricingMode(mode) {
  state.pricing.mode = mode === "profit" ? "profit" : "margin";
  saveState({ skipGoogleSync: true });
  if (activeAppScreen === "calculator") renderCalculatorScreen();
}

function updatePricingProfileValue(platformKey, field, value) {
  const platform = getPlatformByKey(platformKey);
  if (!platform) return;
  if (!state.pricing.profiles[platformKey]) {
    state.pricing.profiles[platformKey] = normalizePricingProfile(platform);
  }
  state.pricing.profiles[platformKey][field] = Number(value || 0);
  state.pricing.profiles[platformKey].sourceType = "custom";
  saveState({ skipGoogleSync: true });
  if (activeAppScreen === "calculator") renderCalculatorScreen();
}

async function importBackupFile(file, mode = pendingImportMode) {
  if (!file) return;
  try {
    const payload = JSON.parse(await file.text());
    applyImportedBackup(payload, mode);
    closeModal("importBackupModal");
    toast(mode === "replace" ? "Backup importado e substituido com sucesso" : "Backup importado com sucesso");
  } catch (error) {
    console.error("Falha ao importar backup:", error);
    toast("Nao foi possivel importar o backup");
  }
}

function bindEvents() {
  document.getElementById("authModeLoginButton").addEventListener("click", () => {
    if (!state.auth?.username) {
      toast("Crie um acesso primeiro");
      return;
    }
    authMode = "login";
    renderAuthScreen();
  });
  document.getElementById("authModeCreateButton").addEventListener("click", () => {
    authMode = "create";
    renderAuthScreen();
  });
  document.getElementById("authSubmitButton").addEventListener("click", handleAuthSubmit);
  document.getElementById("openDashboardCard").addEventListener("click", openDashboardScreen);
  document.getElementById("openCalculatorCard").addEventListener("click", openCalculatorScreen);
  document.getElementById("hubManagePlatformsButton").addEventListener("click", openSetupEditor);
  document.getElementById("hubImportBackupButton").addEventListener("click", openImportBackupModal);
  document.getElementById("hubLogoutButton").addEventListener("click", handleLogout);
  ["authUsername", "authPassword"].forEach((id) => {
    document.getElementById(id).addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        handleAuthSubmit();
      }
    });
  });
  document.getElementById("inputMonth").addEventListener("change", () => {
    syncSaleDateWithMonth();
  });
  document.getElementById("addPlatformConfigButton").addEventListener("click", addPlatformConfig);
  document.getElementById("cancelPlatformEditButton").addEventListener("click", resetPlatformForm);
  document.getElementById("importBackupSetupButton").addEventListener("click", openImportBackupModal);
  document.getElementById("finishSetupButton").addEventListener("click", finishSetup);
  document.getElementById("logoutFromSetupButton").addEventListener("click", handleLogout);
  document.getElementById("logoutButton").addEventListener("click", handleLogout);
  document.getElementById("openHubButton").addEventListener("click", openHubScreen);
  document.getElementById("openCalculatorButton").addEventListener("click", openCalculatorScreen);
  document.getElementById("managePlatformsButton").addEventListener("click", openSetupEditor);
  document.getElementById("changePasswordButton").addEventListener("click", openChangePasswordModal);
  document.getElementById("openDailyDetailsButton").addEventListener("click", openDailyDetailsModal);
  document.getElementById("saveNowButton").addEventListener("click", saveNow);
  document.getElementById("syncGoogleDriveButton").addEventListener("click", () => {
    closeHeaderMenu();
    syncGoogleDriveNow();
  });
  document.getElementById("restoreGoogleDriveButton").addEventListener("click", () => {
    closeHeaderMenu();
    restoreFromGoogleDrive();
  });
  document.getElementById("exportBackupButton").addEventListener("click", exportBackup);
  document.getElementById("importBackupButton").addEventListener("click", openImportBackupModal);
  document.getElementById("menuToggleButton").addEventListener("click", toggleHeaderMenu);
  document.getElementById("confirmImportBackupButton").addEventListener("click", () => document.getElementById("backupFileInputModal").click());
  document.getElementById("backupFileInputModal").addEventListener("change", (event) => {
    importBackupFile(event.target.files?.[0], pendingImportMode);
    event.target.value = "";
  });
  document.getElementById("savePasswordButton").addEventListener("click", saveChangedPassword);
  document.getElementById("themeToggleButton").addEventListener("click", toggleTheme);
  document.getElementById("addMonthButton").addEventListener("click", openAddMonth);
  document.getElementById("openDeleteMonthButton").addEventListener("click", openDeleteMonthModal);
  document.getElementById("confirmDeleteMonthButton").addEventListener("click", confirmDeleteMonth);
  document.getElementById("reportButton").addEventListener("click", openReport);
  document.getElementById("calculatorBackToHubButton").addEventListener("click", openHubScreen);
  document.getElementById("calculatorOpenDashboardButton").addEventListener("click", openDashboardScreen);
  document.getElementById("calculatorManagePlatformsButton").addEventListener("click", openSetupEditor);
  document.getElementById("registerSaleButton").addEventListener("click", addSale);
  document.getElementById("clearSaleButton").addEventListener("click", clearSale);
  document.getElementById("saveReturnsButton").addEventListener("click", saveReturns);
  document.getElementById("cancelReturnsButton").addEventListener("click", renderReturnInputs);
  document.getElementById("confirmAddMonthButton").addEventListener("click", confirmAddMonth);
  document.getElementById("exportReportButton").addEventListener("click", exportReportPNG);
  document.getElementById("returnMonth").addEventListener("change", renderReturnInputs);
  document.getElementById("pricingModeMargin").addEventListener("click", () => updatePricingMode("margin"));
  document.getElementById("pricingModeProfit").addEventListener("click", () => updatePricingMode("profit"));
  ["pricingProductCost", "pricingPackagingCost", "pricingExtraCost", "pricingShippingSubsidy", "pricingTargetMargin", "pricingTargetProfit"].forEach((id) => {
    const field = {
      pricingProductCost: "productCost",
      pricingPackagingCost: "packagingCost",
      pricingExtraCost: "extraCost",
      pricingShippingSubsidy: "shippingSubsidy",
      pricingTargetMargin: "targetMargin",
      pricingTargetProfit: "targetProfit"
    }[id];
    document.getElementById(id).addEventListener("change", (event) => updatePricingValue(field, event.target.value));
  });
  document.getElementById("pricingPlatformGrid").addEventListener("change", (event) => {
    const input = event.target.closest("[data-pricing-profile]");
    if (!input) return;
    updatePricingProfileValue(input.dataset.pricingProfile, input.dataset.field, input.value);
  });

  document.querySelectorAll(".itab").forEach((button) => {
    button.addEventListener("click", () => switchTab(button.dataset.tab));
  });

  document.addEventListener("click", (event) => {
    const menu = document.getElementById("headerMenu");
    const toggle = document.getElementById("menuToggleButton");
    if (menu && toggle && !menu.hidden && !event.target.closest("#headerMenu") && !event.target.closest("#menuToggleButton")) {
      closeHeaderMenu();
    }

    const monthTab = event.target.closest("[data-month]");
    if (monthTab) {
      switchMonth(monthTab.dataset.month);
      return;
    }

    const pickerButton = event.target.closest("[data-picker-month]");
    if (pickerButton && !pickerButton.disabled) {
      pickMonth(pickerButton.dataset.pickerMonth, pickerButton);
      return;
    }

    const removeButton = event.target.closest("[data-remove-platform]");
    if (removeButton) {
      removePlatformConfig(removeButton.dataset.removePlatform);
      return;
    }

    const editButton = event.target.closest("[data-edit-platform]");
    if (editButton) {
      startPlatformEdit(editButton.dataset.editPlatform);
      return;
    }

    const importModeButton = event.target.closest("[data-import-mode]");
    if (importModeButton) {
      pendingImportMode = importModeButton.dataset.importMode;
      updateImportModeUI();
      return;
    }

    const closeButton = event.target.closest("[data-close-modal]");
    if (closeButton) {
      closeModal(closeButton.dataset.closeModal);
    }
  });

  document.getElementById("dailyDetailsTable").addEventListener("focusin", (event) => {
    const cell = event.target.closest(".ceditable");
    if (cell) selectAll(cell);
  });

  document.getElementById("dailyDetailsTable").addEventListener("blur", (event) => {
    const cell = event.target.closest(".ceditable");
    if (!cell) return;
    updateCell(Number(cell.dataset.dayIndex), cell.dataset.platformKey, cell);
  }, true);

  document.querySelectorAll(".moverlay").forEach((overlay) => {
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) closeModal(overlay.id);
    });
  });
}

function init() {
  const storedAuth = loadStoredAuth();
  if (!state.auth?.username && storedAuth?.username) {
    state.auth = storedAuth;
    saveState({ skipGoogleSync: true });
  }
  ensureStateMonths(state);
  applyTheme();
  bindEvents();
  const menuButton = document.getElementById("menuToggleButton");
  if (menuButton) menuButton.textContent = "\u2630";
  const themeButton = document.getElementById("themeToggleButton");
  if (themeButton) {
    themeButton.textContent = currentTheme === "light" ? "\u263E" : "\u2600";
  }
  window.addEventListener("beforeunload", saveState);
  renderGoogleUi();
  renderScreen();
  refreshGoogleDriveBackendStatus();
  void migrateLegacyLocalAuthIfNeeded();
  restoreGoogleDriveOnSessionStart();
}

init();

