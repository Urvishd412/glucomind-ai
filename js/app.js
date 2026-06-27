const STORAGE_KEY = "t1d-manager-data-v2";
const LEGACY_STORAGE_KEYS = ["t1d-manager-data-v2", "t1d-manager-data-v1"];
const DB_NAME = "t1d-manager";
const DB_VERSION = 1;
const ACTIVE_PROFILE_ID = "local-patient";
const THEME_STORAGE_KEY = "t1d-manager-theme";

const DEFAULT_SETTINGS = {
  unit: "mg/dL",
  low: 70,
  targetLow: 80,
  targetHigh: 180,
  high: 250,
  carbRatio: 12,
  correctionFactor: 45,
  correctionTarget: 110,
  insulinDuration: 4,
  basalTime: "22:00",
  checkInterval: 4,
};

const DEFAULT_PROFILE = {
  id: ACTIVE_PROFILE_ID,
  displayName: "My profile",
  diabetesType: "Type 1",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Local",
  createdAt: new Date().toISOString(),
};

const state = {
  profile: { ...DEFAULT_PROFILE },
  settings: { ...DEFAULT_SETTINGS },
  entries: [],
  storageMode: "localStorage",
};

let database = null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

// Theme management functions
function getSystemTheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getSavedTheme() {
  return localStorage.getItem(THEME_STORAGE_KEY);
}

function applyTheme(theme) {
  const html = document.documentElement;
  if (theme === "dark" || theme === "light") {
    html.setAttribute("data-theme", theme);
    updateThemeToggleButton(theme);
  }
}

function toggleTheme() {
  const html = document.documentElement;
  const currentTheme = html.getAttribute("data-theme") || getSystemTheme();
  const newTheme = currentTheme === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_STORAGE_KEY, newTheme);
  applyTheme(newTheme);
  
  // Redraw charts with new theme colors
  renderDistributionChart();
  renderChart();
}

function updateThemeToggleButton(theme) {
  const btn = document.getElementById("themeToggleButton");
  if (btn) {
    btn.innerHTML = theme === "dark" ? '<span aria-hidden="true">☀️</span>' : '<span aria-hidden="true">🌙</span>';
  }
}

function initTheme() {
  const savedTheme = getSavedTheme();
  const themeToApply = savedTheme || getSystemTheme();
  applyTheme(themeToApply);
}

function getCSSVariable(varName) {
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}

const els = {
  tabs: $$(".tab"),
  views: $$(".view"),
  themeToggleButton: $("#themeToggleButton"),
  metricGrid: $("#metricGrid"),
  profileLine: $("#profileLine"),
  targetRangeLabel: $("#targetRangeLabel"),
  attentionList: $("#attentionList"),
  glucoseChart: $("#glucoseChart"),
  entryForm: $("#entryForm"),
  entryFormTitle: $("#entryFormTitle"),
  entryId: $("#entryId"),
  entryDate: $("#entryDate"),
  entryTime: $("#entryTime"),
  entryGlucose: $("#entryGlucose"),
  entryCarbs: $("#entryCarbs"),
  entryInsulin: $("#entryInsulin"),
  entryInsulinType: $("#entryInsulinType"),
  entryMeal: $("#entryMeal"),
  entryActivity: $("#entryActivity"),
  entryNotes: $("#entryNotes"),
  resetEntryButton: $("#resetEntryButton"),
  entriesTable: $("#entriesTable"),
  emptyStateTemplate: $("#emptyStateTemplate"),
  entrySearch: $("#entrySearch"),
  entryRange: $("#entryRange"),
  doseForm: $("#doseForm"),
  doseGlucose: $("#doseGlucose"),
  doseCarbs: $("#doseCarbs"),
  doseIob: $("#doseIob"),
  doseResult: $("#doseResult"),
  insightsGrid: $("#insightsGrid"),
  settingsForm: $("#settingsForm"),
  settingUnit: $("#settingUnit"),
  settingProfileName: $("#settingProfileName"),
  settingDiabetesType: $("#settingDiabetesType"),
  settingTimezone: $("#settingTimezone"),
  settingLow: $("#settingLow"),
  settingTargetLow: $("#settingTargetLow"),
  settingTargetHigh: $("#settingTargetHigh"),
  settingHigh: $("#settingHigh"),
  settingCarbRatio: $("#settingCarbRatio"),
  settingCorrectionFactor: $("#settingCorrectionFactor"),
  settingCorrectionTarget: $("#settingCorrectionTarget"),
  settingInsulinDuration: $("#settingInsulinDuration"),
  settingBasalTime: $("#settingBasalTime"),
  settingCheckInterval: $("#settingCheckInterval"),
  exportJsonButton: $("#exportJsonButton"),
  importJsonInput: $("#importJsonInput"),
  templateCsvButton: $("#templateCsvButton"),
  importCsvInput: $("#importCsvInput"),
  exportCsvButton: $("#exportCsvButton"),
  clearDataButton: $("#clearDataButton"),
};

function openDatabase() {
  if (!("indexedDB" in window)) return Promise.resolve(null);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains("entries")) {
        const entries = db.createObjectStore("entries", { keyPath: "id" });
        entries.createIndex("byPatient", "patientId", { unique: false });
        entries.createIndex("byPatientDate", ["patientId", "datetime"], { unique: false });
        entries.createIndex("bySource", "source", { unique: false });
      }

      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "key" });
      }

      if (!db.objectStoreNames.contains("profiles")) {
        db.createObjectStore("profiles", { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

async function dbGet(storeName, key) {
  const transaction = database.transaction(storeName, "readonly");
  return requestToPromise(transaction.objectStore(storeName).get(key));
}

async function dbGetAll(storeName) {
  const transaction = database.transaction(storeName, "readonly");
  return requestToPromise(transaction.objectStore(storeName).getAll());
}

async function dbPut(storeName, value) {
  const transaction = database.transaction(storeName, "readwrite");
  transaction.objectStore(storeName).put(value);
  await transactionDone(transaction);
}

async function dbReplaceAll(storeName, values) {
  const transaction = database.transaction(storeName, "readwrite");
  const store = transaction.objectStore(storeName);
  store.clear();
  values.forEach((value) => store.put(value));
  await transactionDone(transaction);
}

async function dbReplaceEntriesForPatient(patientId, entries) {
  const existing = await dbGetAll("entries");
  const preserved = existing.filter((entry) => entry.patientId !== patientId);
  await dbReplaceAll("entries", [...preserved, ...entries]);
}

async function dbDelete(storeName, key) {
  const transaction = database.transaction(storeName, "readwrite");
  transaction.objectStore(storeName).delete(key);
  await transactionDone(transaction);
}

async function loadState() {
  try {
    database = await openDatabase();
  } catch (error) {
    console.warn("IndexedDB unavailable; using localStorage fallback", error);
  }

  if (database) {
    state.storageMode = "indexedDB";
    const storedProfile = await dbGet("profiles", ACTIVE_PROFILE_ID);
    const storedSettings = await dbGet("settings", "active");
    const storedEntries = await dbGetAll("entries");

    state.profile = { ...DEFAULT_PROFILE, ...(storedProfile || {}) };
    state.settings = { ...DEFAULT_SETTINGS, ...(storedSettings?.value || {}) };
    state.entries = storedEntries
      .filter((entry) => entry.patientId === ACTIVE_PROFILE_ID)
      .map(normalizeEntry);

    if (!storedProfile) await dbPut("profiles", state.profile);
    if (!storedSettings) await dbPut("settings", { key: "active", value: state.settings });

    if (state.entries.length === 0) {
      const legacy = readLegacyState();
      if (legacy) {
        state.profile = { ...state.profile, ...(legacy.profile || {}) };
        state.settings = { ...state.settings, ...(legacy.settings || {}) };
        state.entries = legacy.entries.map(normalizeEntry);
        await saveState();
      }
    }
  } else {
    state.storageMode = "localStorage";
    const legacy = readLegacyState();
    if (legacy) {
      state.profile = { ...DEFAULT_PROFILE, ...(legacy.profile || {}) };
      state.settings = { ...DEFAULT_SETTINGS, ...(legacy.settings || {}) };
      state.entries = legacy.entries.map(normalizeEntry);
    }
  }

  sortEntries();
}

function readLegacyState() {
  for (const key of LEGACY_STORAGE_KEYS) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw);
      return {
        profile: parsed.profile || {},
        settings: parsed.settings || {},
        entries: Array.isArray(parsed.entries) ? parsed.entries : [],
      };
    } catch (error) {
      console.warn(`Could not read ${key}`, error);
    }
  }

  return null;
}

async function saveState() {
  sortEntries();

  const snapshot = {
    profile: state.profile,
    settings: state.settings,
    entries: state.entries,
    exportedAt: new Date().toISOString(),
    schemaVersion: DB_VERSION,
  };

  if (database) {
    await dbPut("profiles", state.profile);
    await dbPut("settings", { key: "active", value: state.settings });
    await dbReplaceEntriesForPatient(ACTIVE_PROFILE_ID, state.entries.map(normalizeEntry));
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}

function sortEntries() {
  state.entries.sort((a, b) => new Date(b.datetime) - new Date(a.datetime));
}

function nowParts() {
  const now = new Date();
  return {
    date: toDateInputValue(now),
    time: now.toTimeString().slice(0, 5),
  };
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `entry-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeEntry(entry) {
  const now = new Date().toISOString();
  return {
    id: entry.id || createId(),
    patientId: entry.patientId || ACTIVE_PROFILE_ID,
    datetime: entry.datetime,
    glucose: Number(entry.glucose),
    glucoseUnit: entry.glucoseUnit || state.settings.unit,
    carbs: numberOrZero(entry.carbs),
    insulin: numberOrZero(entry.insulin),
    insulinType: entry.insulinType || "rapid",
    meal: entry.meal || "none",
    activity: entry.activity || "none",
    notes: entry.notes || "",
    source: entry.source || "manual",
    createdAt: entry.createdAt || now,
    updatedAt: now,
  };
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function daysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatNumber(value, digits = 0) {
  if (!Number.isFinite(value)) return "--";
  return value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function convertGlucose(value, fromUnit, toUnit) {
  const glucose = Number(value);
  if (!Number.isFinite(glucose)) return NaN;
  if (!fromUnit || fromUnit === toUnit) return glucose;
  if (fromUnit === "mmol/L" && toUnit === "mg/dL") return glucose * 18.0182;
  if (fromUnit === "mg/dL" && toUnit === "mmol/L") return glucose / 18.0182;
  return glucose;
}

function getStatus(glucose) {
  if (glucose < state.settings.targetLow) return "low";
  if (glucose > state.settings.targetHigh) return "high";
  return "range";
}

function statusLabel(status) {
  if (status === "low") return "Low";
  if (status === "high") return "High";
  return "In range";
}

function setDefaultEntryDateTime() {
  const parts = nowParts();
  els.entryDate.value = parts.date;
  els.entryTime.value = parts.time;
}

function hydrateSettingsForm() {
  els.settingProfileName.value = state.profile.displayName;
  els.settingDiabetesType.value = state.profile.diabetesType;
  els.settingTimezone.value = state.profile.timezone;
  els.settingUnit.value = state.settings.unit;
  els.settingLow.value = state.settings.low;
  els.settingTargetLow.value = state.settings.targetLow;
  els.settingTargetHigh.value = state.settings.targetHigh;
  els.settingHigh.value = state.settings.high;
  els.settingCarbRatio.value = state.settings.carbRatio;
  els.settingCorrectionFactor.value = state.settings.correctionFactor;
  els.settingCorrectionTarget.value = state.settings.correctionTarget;
  els.settingInsulinDuration.value = state.settings.insulinDuration;
  els.settingBasalTime.value = state.settings.basalTime;
  els.settingCheckInterval.value = state.settings.checkInterval;
}

function updateUnitLabels() {
  $$(".unitLabel").forEach((label) => {
    label.textContent = `(${state.settings.unit})`;
  });
  els.targetRangeLabel.textContent = `${state.settings.targetLow}-${state.settings.targetHigh} ${state.settings.unit}`;
  els.profileLine.textContent = `${state.profile.displayName} · ${state.profile.diabetesType} · ${state.storageMode}`;
}

function getEntriesSince(days) {
  const cutoff = daysAgo(days);
  return state.entries.filter((entry) => new Date(entry.datetime) >= cutoff);
}

function getTodaysEntries() {
  const today = startOfToday();
  return state.entries.filter((entry) => new Date(entry.datetime) >= today);
}

function calculateStats(entries = state.entries) {
  const glucoseEntries = entries.filter((entry) => Number.isFinite(entry.glucose));
  const avg =
    glucoseEntries.length > 0
      ? glucoseEntries.reduce((sum, entry) => sum + entry.glucose, 0) / glucoseEntries.length
      : NaN;
  const inRange = glucoseEntries.filter(
    (entry) =>
      entry.glucose >= state.settings.targetLow && entry.glucose <= state.settings.targetHigh,
  ).length;
  const lows = glucoseEntries.filter((entry) => entry.glucose < state.settings.targetLow).length;
  const highs = glucoseEntries.filter((entry) => entry.glucose > state.settings.targetHigh).length;
  const insulin = entries.reduce((sum, entry) => sum + numberOrZero(entry.insulin), 0);
  const carbs = entries.reduce((sum, entry) => sum + numberOrZero(entry.carbs), 0);

  return {
    avg,
    inRangePercent: glucoseEntries.length ? Math.round((inRange / glucoseEntries.length) * 100) : 0,
    lows,
    highs,
    insulin,
    carbs,
    count: glucoseEntries.length,
  };
}

function estimateHbA1c(avgGlucose) {
  if (!Number.isFinite(avgGlucose)) return NaN;
  if (state.settings.unit === "mmol/L") {
    return ((avgGlucose * 18.0182 + 46.7) / 28.7).toFixed(1);
  }
  return ((avgGlucose + 46.7) / 28.7).toFixed(1);
}

function getHbA1cCategory(hba1cValue) {
  const value = Number(hba1cValue);
  if (value < 5.7) return { category: "Excellent", emoji: "🎯" };
  if (value < 6.4) return { category: "Good", emoji: "👍" };
  return { category: "Needs Improvement", emoji: "⚠️" };
}

function getHighestGlucose(entries) {
  const glucoseEntries = entries.filter((entry) => Number.isFinite(entry.glucose));
  if (glucoseEntries.length === 0) return NaN;
  return Math.max(...glucoseEntries.map((e) => e.glucose));
}

function getLowestGlucose(entries) {
  const glucoseEntries = entries.filter((entry) => Number.isFinite(entry.glucose));
  if (glucoseEntries.length === 0) return NaN;
  return Math.min(...glucoseEntries.map((e) => e.glucose));
}

function getMedianGlucose(entries) {
  const glucoseEntries = entries
    .filter((entry) => Number.isFinite(entry.glucose))
    .map((e) => e.glucose)
    .sort((a, b) => a - b);
  if (glucoseEntries.length === 0) return NaN;
  const mid = Math.floor(glucoseEntries.length / 2);
  return glucoseEntries.length % 2 !== 0
    ? glucoseEntries[mid]
    : (glucoseEntries[mid - 1] + glucoseEntries[mid]) / 2;
}

function getStdDeviation(entries) {
  const glucoseEntries = entries.filter((entry) => Number.isFinite(entry.glucose));
  if (glucoseEntries.length === 0) return NaN;
  const avg = glucoseEntries.reduce((sum, entry) => sum + entry.glucose, 0) / glucoseEntries.length;
  const squaredDiffs = glucoseEntries.map((entry) => Math.pow(entry.glucose - avg, 2));
  const avgSquaredDiff = squaredDiffs.reduce((sum, val) => sum + val, 0) / glucoseEntries.length;
  return Math.sqrt(avgSquaredDiff);
}

function getGlucoseDistribution(entries) {
  const glucoseEntries = entries.filter((entry) => Number.isFinite(entry.glucose));
  if (glucoseEntries.length === 0) return { low: 0, range: 0, high: 0 };
  
  const low = glucoseEntries.filter((e) => e.glucose < state.settings.targetLow).length;
  const high = glucoseEntries.filter((e) => e.glucose > state.settings.targetHigh).length;
  const range = glucoseEntries.length - low - high;
  
  return { low, range, high };
}

function renderMetrics() {
  const latest = state.entries[0];
  const todayStats = calculateStats(getTodaysEntries());
  const weekStats = calculateStats(getEntriesSince(7));
  const latestStatus = latest ? getStatus(latest.glucose) : "range";

  const hba1cValue = weekStats.count ? estimateHbA1c(weekStats.avg) : NaN;
  const hba1cInfo = Number.isFinite(hba1cValue) ? getHbA1cCategory(hba1cValue) : null;

  // 6 Key Metrics for the Dashboard
  const metrics = [
    {
      icon: "🩸",
      label: "Current glucose",
      value: latest ? `${formatNumber(latest.glucose, state.settings.unit === "mmol/L" ? 1 : 0)} ${state.settings.unit}` : "--",
      detail: latest ? statusLabel(latestStatus) : "No reading yet",
    },
    {
      icon: "📊",
      label: "Today's average",
      value: todayStats.count ? `${formatNumber(todayStats.avg, state.settings.unit === "mmol/L" ? 1 : 0)} ${state.settings.unit}` : "--",
      detail: `${todayStats.count} reading${todayStats.count !== 1 ? "s" : ""}`,
    },
    {
      icon: "📈",
      label: "Time in range",
      value: weekStats.count ? `${weekStats.inRangePercent}%` : "--",
      detail: `7-day average`,
    },
    {
      icon: "🧬",
      label: "Estimated HbA1c",
      value: hba1cValue ? `${hba1cValue}%` : "--",
      detail: hba1cInfo ? `${hba1cInfo.emoji} ${hba1cInfo.category}` : "Need more data",
    },
    {
      icon: "🍽️",
      label: "Total carbs today",
      value: `${formatNumber(todayStats.carbs, 0)} g`,
      detail: `${todayStats.count} entries`,
    },
    {
      icon: "💉",
      label: "Total insulin today",
      value: `${formatNumber(todayStats.insulin, 1)} u`,
      detail: `${formatNumber(todayStats.carbs, 0)} g carbs`,
    },
  ];

  els.metricGrid.innerHTML = metrics
    .map(
      (metric) => `
        <article class="metric">
          <div>
            <span class="metric-icon">${metric.icon}</span>
            <span class="metric-label">${metric.label}</span>
          </div>
          <div>
            <strong>${metric.value}</strong>
            <small>${metric.detail}</small>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderAttention() {
  const items = [];
  const latest = state.entries[0];
  const now = new Date();

  if (latest) {
    const status = getStatus(latest.glucose);
    if (latest.glucose < state.settings.low) {
      items.push({
        level: "danger",
        title: "Latest reading is below your low threshold",
        text: `${formatNumber(latest.glucose, state.settings.unit === "mmol/L" ? 1 : 0)} ${state.settings.unit}. Follow your hypo plan and recheck.`,
      });
    } else if (latest.glucose > state.settings.high) {
      items.push({
        level: "warning",
        title: "Latest reading is above your high threshold",
        text: `${formatNumber(latest.glucose, state.settings.unit === "mmol/L" ? 1 : 0)} ${state.settings.unit}. Check ketone guidance from your care team if this persists.`,
      });
    } else if (status !== "range") {
      items.push({
        level: "warning",
        title: "Latest reading is outside your target range",
        text: `${statusLabel(status)} at ${formatDateTime(latest.datetime)}.`,
      });
    }

    const hoursSinceReading = (now - new Date(latest.datetime)) / 36e5;
    if (state.settings.checkInterval && hoursSinceReading > state.settings.checkInterval) {
      items.push({
        level: "warning",
        title: "Glucose check interval passed",
        text: `Last logged reading was ${formatNumber(hoursSinceReading, 1)} hours ago.`,
      });
    }
  } else {
    items.push({
      level: "warning",
      title: "No readings logged yet",
      text: "Add a glucose entry to start building your local logbook.",
    });
  }

  const basalDue = getBasalDueMessage();
  if (basalDue) items.push(basalDue);

  if (items.length === 0) {
    items.push({
      level: "",
      title: "Nothing urgent in the log",
      text: "Your latest saved data does not show a configured alert condition.",
    });
  }

  els.attentionList.innerHTML = items
    .map(
      (item) => `
        <div class="attention-item ${item.level}">
          <strong>${item.title}</strong>
          <p>${item.text}</p>
        </div>
      `,
    )
    .join("");
}

function getBasalDueMessage() {
  if (!state.settings.basalTime) return null;

  const [hours, minutes] = state.settings.basalTime.split(":").map(Number);
  const due = startOfToday();
  due.setHours(hours, minutes, 0, 0);
  const now = new Date();
  if (now < due) return null;

  const basalLoggedToday = getTodaysEntries().some(
    (entry) => entry.insulinType === "basal" && new Date(entry.datetime) >= due,
  );

  if (basalLoggedToday) return null;

  return {
    level: "warning",
    title: "Basal reminder",
    text: `No basal insulin entry has been logged after ${state.settings.basalTime} today.`,
  };
}

function renderChart() {
  const canvas = els.glucoseChart;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const width = rect.width;
  const height = rect.height;
  
  const colors = {
    bg: getCSSVariable("--surface-soft"),
    line: getCSSVariable("--line"),
    text: getCSSVariable("--muted"),
    primary: getCSSVariable("--primary"),
    low: getCSSVariable("--low"),
    high: getCSSVariable("--high"),
    range: getCSSVariable("--range"),
  };

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, width, height);

  const padding = { top: 20, right: 18, bottom: 34, left: 48 };
  const points = state.entries
    .filter((entry) => Number.isFinite(entry.glucose))
    .slice(0, 40)
    .reverse();

  if (points.length === 0) {
    ctx.fillStyle = colors.text;
    ctx.font = "700 15px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("Add glucose readings to see your trend", width / 2, height / 2);
    return;
  }

  const values = points.map((point) => point.glucose);
  const minValue = Math.min(...values, state.settings.targetLow) * 0.88;
  const maxValue = Math.max(...values, state.settings.targetHigh) * 1.08;
  const xSpan = Math.max(points.length - 1, 1);

  const xFor = (index) =>
    padding.left + (index / xSpan) * (width - padding.left - padding.right);
  const yFor = (value) =>
    padding.top +
    ((maxValue - value) / (maxValue - minValue || 1)) *
      (height - padding.top - padding.bottom);

  ctx.strokeStyle = colors.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 4; i += 1) {
    const y = padding.top + (i / 3) * (height - padding.top - padding.bottom);
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
  }
  ctx.stroke();

  const targetTop = yFor(state.settings.targetHigh);
  const targetBottom = yFor(state.settings.targetLow);
  ctx.fillStyle = colors.primary + "20";
  ctx.fillRect(
    padding.left,
    targetTop,
    width - padding.left - padding.right,
    Math.max(3, targetBottom - targetTop),
  );

  ctx.strokeStyle = colors.primary;
  ctx.lineWidth = 3;
  ctx.beginPath();
  points.forEach((point, index) => {
    const x = xFor(index);
    const y = yFor(point.glucose);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  points.forEach((point, index) => {
    const status = getStatus(point.glucose);
    const x = xFor(index);
    const y = yFor(point.glucose);
    const color = status === "low" ? colors.low : status === "high" ? colors.high : colors.range;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = colors.text;
  ctx.font = "700 12px system-ui";
  ctx.textAlign = "right";
  [minValue, state.settings.targetLow, state.settings.targetHigh, maxValue].forEach((value) => {
    const y = yFor(value);
    ctx.fillText(formatNumber(value, state.settings.unit === "mmol/L" ? 1 : 0), padding.left - 8, y + 4);
  });

  ctx.textAlign = "left";
  const firstDate = new Date(points[0].datetime).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const lastDate = new Date(points[points.length - 1].datetime).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  ctx.fillText(firstDate, padding.left, height - 10);
  ctx.textAlign = "right";
  ctx.fillText(lastDate, width - padding.right, height - 10);
}

function renderDistributionChart() {
  const canvas = document.getElementById("distributionChart");
  if (!canvas) return;

  const weekData = getEntriesSince(7);
  const distribution = getGlucoseDistribution(weekData);
  const colors = {
    low: getCSSVariable("--low"),
    range: getCSSVariable("--range"),
    high: getCSSVariable("--high"),
  };

  const ctx = canvas.getContext("2d");
  
  // Destroy existing chart if it exists
  if (window.distributionChartInstance) {
    window.distributionChartInstance.destroy();
  }

  window.distributionChartInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["In Range", "High", "Low"],
      datasets: [
        {
          data: [distribution.range, distribution.high, distribution.low],
          backgroundColor: [colors.range, colors.high, colors.low],
          borderColor: [getCSSVariable("--surface"), getCSSVariable("--surface"), getCSSVariable("--surface")],
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: getCSSVariable("--ink"),
            font: { weight: "bold", size: 12 },
            padding: 16,
          },
        },
        tooltip: {
          backgroundColor: getCSSVariable("--ink"),
          titleColor: getCSSVariable("--surface"),
          bodyColor: getCSSVariable("--surface"),
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: function (context) {
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = ((context.parsed / total) * 100).toFixed(1);
              return `${context.label}: ${context.parsed} (${percentage}%)`;
            },
          },
        },
      },
    },
  });
}

function renderStatistics() {
  const weekData = getEntriesSince(7);
  const weekStats = calculateStats(weekData);
  
  const highest = getHighestGlucose(weekData);
  const lowest = getLowestGlucose(weekData);
  const median = getMedianGlucose(weekData);
  const stdDev = getStdDeviation(weekData);
  
  const stats = [
    {
      label: "Highest",
      value: Number.isFinite(highest) ? `${formatNumber(highest, state.settings.unit === "mmol/L" ? 1 : 0)}` : "--",
      unit: state.settings.unit,
    },
    {
      label: "Lowest",
      value: Number.isFinite(lowest) ? `${formatNumber(lowest, state.settings.unit === "mmol/L" ? 1 : 0)}` : "--",
      unit: state.settings.unit,
    },
    {
      label: "Average",
      value: Number.isFinite(weekStats.avg) ? `${formatNumber(weekStats.avg, state.settings.unit === "mmol/L" ? 1 : 0)}` : "--",
      unit: state.settings.unit,
    },
    {
      label: "Median",
      value: Number.isFinite(median) ? `${formatNumber(median, state.settings.unit === "mmol/L" ? 1 : 0)}` : "--",
      unit: state.settings.unit,
    },
    {
      label: "Std Dev",
      value: Number.isFinite(stdDev) ? `${formatNumber(stdDev, state.settings.unit === "mmol/L" ? 1 : 0)}` : "--",
      unit: state.settings.unit,
    },
    {
      label: "Time in Range",
      value: weekStats.count ? `${weekStats.inRangePercent}%` : "--",
      unit: "",
    },
    {
      label: "Total Insulin",
      value: `${formatNumber(weekStats.insulin, 1)}`,
      unit: "u",
    },
    {
      label: "Total Carbs",
      value: `${formatNumber(weekStats.carbs, 0)}`,
      unit: "g",
    },
  ];

  const statsGrid = document.getElementById("statsGrid");
  if (!statsGrid) return;

  statsGrid.innerHTML = stats
    .map(
      (stat) => `
        <div class="stat-card">
          <span class="stat-label">${stat.label}</span>
          <div class="stat-value">
            <strong>${stat.value}</strong>
            ${stat.unit ? `<span class="stat-unit">${stat.unit}</span>` : ""}
          </div>
        </div>
      `,
    )
    .join("");
}

function renderEntriesTable() {
  const query = els.entrySearch.value.trim().toLowerCase();
  const range = els.entryRange.value;
  const cutoff = range === "all" ? null : daysAgo(Number(range));
  const filtered = state.entries.filter((entry) => {
    const inRange = !cutoff || new Date(entry.datetime) >= cutoff;
    const text = `${entry.meal} ${entry.activity} ${entry.notes}`.toLowerCase();
    return inRange && (!query || text.includes(query));
  });

  if (filtered.length === 0) {
    els.entriesTable.innerHTML = els.emptyStateTemplate.innerHTML;
    return;
  }

  els.entriesTable.innerHTML = filtered
    .map((entry) => {
      const status = getStatus(entry.glucose);
      return `
        <tr>
          <td>${formatDateTime(entry.datetime)}</td>
          <td><span class="status-chip ${status}">${formatNumber(entry.glucose, state.settings.unit === "mmol/L" ? 1 : 0)}</span></td>
          <td>${formatNumber(entry.carbs, 0)} g</td>
          <td>${formatNumber(entry.insulin, 1)} u<br><small>${entry.insulinType}</small></td>
          <td>${entry.meal}</td>
          <td>${entry.activity}</td>
          <td>${entry.notes ? escapeHtml(entry.notes) : ""}</td>
          <td>
            <div class="row-actions">
              <button class="small-button" data-action="edit" data-id="${entry.id}">Edit</button>
              <button class="small-button" data-action="delete" data-id="${entry.id}">Delete</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderInsights() {
  const twoWeeks = getEntriesSince(14);
  const month = getEntriesSince(30);
  const stats = calculateStats(twoWeeks);
  const monthStats = calculateStats(month);
  const buckets = {
    Night: [],
    Morning: [],
    Afternoon: [],
    Evening: [],
  };

  month.forEach((entry) => {
    const hour = new Date(entry.datetime).getHours();
    if (hour < 6) buckets.Night.push(entry.glucose);
    else if (hour < 12) buckets.Morning.push(entry.glucose);
    else if (hour < 18) buckets.Afternoon.push(entry.glucose);
    else buckets.Evening.push(entry.glucose);
  });

  const bucketText = Object.entries(buckets)
    .map(([label, values]) => {
      const avg = values.length
        ? values.reduce((sum, value) => sum + value, 0) / values.length
        : NaN;
      return `${label}: ${formatNumber(avg, state.settings.unit === "mmol/L" ? 1 : 0)}`;
    })
    .join("<br>");

  const cards = [
    {
      label: "14-day time in range",
      value: stats.count ? `${stats.inRangePercent}%` : "--",
      text: `${stats.lows} low and ${stats.highs} high readings from ${stats.count} logs.`,
    },
    {
      label: "30-day insulin",
      value: `${formatNumber(monthStats.insulin, 1)} u`,
      text: `${formatNumber(monthStats.carbs, 0)} g carbs logged in the same period.`,
    },
    {
      label: "Time of day averages",
      value: state.settings.unit,
      text: bucketText,
    },
  ];

  els.insightsGrid.innerHTML = cards
    .map(
      (card) => `
        <article class="panel insight-card">
          <span class="eyebrow">${card.label}</span>
          <strong>${card.value}</strong>
          <p>${card.text}</p>
        </article>
      `,
    )
    .join("");
}

function renderDoseEstimate() {
  const glucose = numberOrZero(els.doseGlucose.value);
  const carbs = numberOrZero(els.doseCarbs.value);
  const iob = numberOrZero(els.doseIob.value);

  if (!glucose && !carbs) {
    els.doseResult.innerHTML = "<span>Estimated bolus</span><strong>--</strong>";
    return;
  }

  if (glucose && glucose < state.settings.low) {
    els.doseResult.innerHTML = "<span>Below low threshold</span><strong>Treat first</strong>";
    return;
  }

  const carbDose = carbs / state.settings.carbRatio;
  const correctionDose = glucose
    ? Math.max(0, (glucose - state.settings.correctionTarget) / state.settings.correctionFactor)
    : 0;
  const estimate = Math.max(0, carbDose + correctionDose - iob);

  els.doseResult.innerHTML = `
    <span>${formatNumber(carbDose, 1)}u carbs + ${formatNumber(correctionDose, 1)}u correction - ${formatNumber(iob, 1)}u active</span>
    <strong>${formatNumber(estimate, 1)} u</strong>
  `;
}

function renderAll() {
  updateUnitLabels();
  renderMetrics();
  renderAttention();
  renderChart();
  renderDistributionChart();
  renderStatistics();
  renderRecentEntries();
  renderEntriesTable();
  renderInsights();
  renderDoseEstimate();
  setupDashboardEventListeners();
}

function resetEntryForm() {
  els.entryForm.reset();
  els.entryId.value = "";
  els.entryFormTitle.textContent = "New entry";
  setDefaultEntryDateTime();
}

async function handleEntrySubmit(event) {
  event.preventDefault();

  const entry = normalizeEntry({
    id: els.entryId.value || createId(),
    patientId: ACTIVE_PROFILE_ID,
    datetime: `${els.entryDate.value}T${els.entryTime.value}`,
    glucose: numberOrZero(els.entryGlucose.value),
    glucoseUnit: state.settings.unit,
    carbs: numberOrZero(els.entryCarbs.value),
    insulin: numberOrZero(els.entryInsulin.value),
    insulinType: els.entryInsulinType.value,
    meal: els.entryMeal.value,
    activity: els.entryActivity.value,
    notes: els.entryNotes.value.trim(),
    source: "manual",
  });

  const existingIndex = state.entries.findIndex((item) => item.id === entry.id);
  if (existingIndex >= 0) state.entries[existingIndex] = entry;
  else state.entries.push(entry);

  sortEntries();
  await saveState();
  resetEntryForm();
  renderAll();
}

function editEntry(id) {
  const entry = state.entries.find((item) => item.id === id);
  if (!entry) return;

  const date = new Date(entry.datetime);
  els.entryId.value = entry.id;
  els.entryDate.value = toDateInputValue(date);
  els.entryTime.value = date.toTimeString().slice(0, 5);
  els.entryGlucose.value = entry.glucose;
  els.entryCarbs.value = entry.carbs || "";
  els.entryInsulin.value = entry.insulin || "";
  els.entryInsulinType.value = entry.insulinType;
  els.entryMeal.value = entry.meal;
  els.entryActivity.value = entry.activity;
  els.entryNotes.value = entry.notes;
  els.entryFormTitle.textContent = "Edit entry";
  switchView("logbook");
  els.entryGlucose.focus();
}

async function deleteEntry(id) {
  const ok = confirm("Delete this entry?");
  if (!ok) return;
  state.entries = state.entries.filter((entry) => entry.id !== id);
  if (database) await dbDelete("entries", id);
  await saveState();
  renderAll();
}

async function handleSettingsSubmit(event) {
  event.preventDefault();
  state.profile = {
    ...state.profile,
    displayName: els.settingProfileName.value.trim() || DEFAULT_PROFILE.displayName,
    diabetesType: els.settingDiabetesType.value,
    timezone: els.settingTimezone.value.trim() || DEFAULT_PROFILE.timezone,
    updatedAt: new Date().toISOString(),
  };
  state.settings = {
    unit: els.settingUnit.value,
    low: numberOrZero(els.settingLow.value),
    targetLow: numberOrZero(els.settingTargetLow.value),
    targetHigh: numberOrZero(els.settingTargetHigh.value),
    high: numberOrZero(els.settingHigh.value),
    carbRatio: numberOrZero(els.settingCarbRatio.value),
    correctionFactor: numberOrZero(els.settingCorrectionFactor.value),
    correctionTarget: numberOrZero(els.settingCorrectionTarget.value),
    insulinDuration: numberOrZero(els.settingInsulinDuration.value),
    basalTime: els.settingBasalTime.value,
    checkInterval: numberOrZero(els.settingCheckInterval.value),
  };
  state.entries = state.entries.map((entry) => ({
    ...entry,
    glucoseUnit: entry.glucoseUnit || state.settings.unit,
  }));
  await saveState();
  renderAll();
}

function exportJson() {
  const payload = JSON.stringify(
    {
      profile: state.profile,
      settings: state.settings,
      entries: state.entries,
      exportedAt: new Date().toISOString(),
      schemaVersion: DB_VERSION,
    },
    null,
    2,
  );
  downloadFile(payload, `diabetes-backup-${new Date().toISOString().slice(0, 10)}.json`, "application/json");
}

function importJson(file) {
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!Array.isArray(imported.entries)) throw new Error("Missing entries array");
      state.profile = { ...DEFAULT_PROFILE, ...(imported.profile || {}) };
      state.settings = { ...DEFAULT_SETTINGS, ...(imported.settings || {}) };
      state.entries = imported.entries.map(normalizeEntry);
      sortEntries();
      await saveState();
      hydrateSettingsForm();
      renderAll();
      alert("Import complete.");
    } catch (error) {
      alert("That file could not be imported. Please choose a valid JSON backup.");
      console.error(error);
    }
  };
  reader.readAsText(file);
}

function exportCsv() {
  const headers = [
    "patient_id",
    "datetime",
    "glucose",
    "glucose_unit",
    "carbs_g",
    "insulin_units",
    "insulin_type",
    "meal",
    "activity",
    "notes",
    "source",
  ];
  const rows = state.entries.map((entry) => [
    entry.patientId,
    entry.datetime,
    entry.glucose,
    entry.glucoseUnit || state.settings.unit,
    entry.carbs,
    entry.insulin,
    entry.insulinType,
    entry.meal,
    entry.activity,
    entry.notes,
    entry.source,
  ]);
  const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
  downloadFile(csv, `diabetes-log-${new Date().toISOString().slice(0, 10)}.csv`, "text/csv");
}

function downloadTemplateCsv() {
  const headers = [
    "date",
    "time",
    "glucose",
    "glucose_unit",
    "carbs_g",
    "insulin_units",
    "insulin_type",
    "meal",
    "activity",
    "notes",
  ];
  const rows = [
    [
      "2026-06-25",
      "08:00",
      "110",
      state.settings.unit,
      "45",
      "4.5",
      "rapid",
      "breakfast",
      "light",
      "Example row. Delete before importing.",
    ],
  ];
  const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
  downloadFile(csv, "diabetes-diary-template.csv", "text/csv");
}

function importCsv(file) {
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const rows = parseCsv(reader.result);
      const [headers, ...records] = rows;
      const normalizedHeaders = headers.map((header) => normalizeHeader(header));
      const importedEntries = records
        .filter((record) => record.some((value) => value.trim()))
        .map((record) => rowToEntry(normalizedHeaders, record));

      if (importedEntries.length === 0) throw new Error("No diary rows found");

      state.entries = [...importedEntries, ...state.entries];
      sortEntries();
      await saveState();
      renderAll();
      alert(`Imported ${importedEntries.length} diary entries.`);
    } catch (error) {
      alert("That CSV could not be imported. Check the template columns and try again.");
      console.error(error);
    }
  };
  reader.readAsText(file);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  row.push(value);
  rows.push(row);
  return rows.filter((items) => items.some((item) => item.trim()));
}

function normalizeHeader(header) {
  return header.trim().toLowerCase().replaceAll(" ", "_");
}

function rowToEntry(headers, record) {
  const row = Object.fromEntries(headers.map((header, index) => [header, record[index] || ""]));
  const date = row.date || row.entry_date || "";
  const time = row.time || row.entry_time || "00:00";
  const datetime = row.datetime || (date ? `${date}T${time}` : "");
  const sourceUnit = row.glucose_unit || row.unit || state.settings.unit;
  const glucose = convertGlucose(row.glucose, sourceUnit, state.settings.unit);

  if (!datetime || !Number.isFinite(glucose)) {
    throw new Error("CSV rows need date/time or datetime and numeric glucose");
  }

  return normalizeEntry({
    patientId: row.patient_id || ACTIVE_PROFILE_ID,
    datetime,
    glucose,
    glucoseUnit: state.settings.unit,
    carbs: row.carbs_g || row.carbs || 0,
    insulin: row.insulin_units || row.insulin || 0,
    insulinType: row.insulin_type || "rapid",
    meal: row.meal || "none",
    activity: row.activity || "none",
    notes: row.notes || "",
    source: "csv_import",
  });
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function clearAllData() {
  const ok = confirm("Clear all saved entries and settings from this browser?");
  if (!ok) return;
  localStorage.removeItem(STORAGE_KEY);
  if (database) {
    await dbReplaceEntriesForPatient(ACTIVE_PROFILE_ID, []);
    await dbPut("profiles", { ...DEFAULT_PROFILE });
    await dbPut("settings", { key: "active", value: { ...DEFAULT_SETTINGS } });
  }
  state.profile = { ...DEFAULT_PROFILE };
  state.settings = { ...DEFAULT_SETTINGS };
  state.entries = [];
  hydrateSettingsForm();
  resetEntryForm();
  await saveState();
  renderAll();
}

function switchView(viewName) {
  els.tabs.forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.view === viewName);
  });
  els.views.forEach((view) => {
    view.classList.toggle("is-active", view.id === `${viewName}View`);
  });
}

function bindEvents() {
  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => switchView(tab.dataset.view));
  });

  $$("[data-jump]").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.jump));
  });

  els.themeToggleButton.addEventListener("click", toggleTheme);
  els.entryForm.addEventListener("submit", handleEntrySubmit);
  els.resetEntryButton.addEventListener("click", resetEntryForm);
  els.settingsForm.addEventListener("submit", handleSettingsSubmit);
  els.entrySearch.addEventListener("input", renderEntriesTable);
  els.entryRange.addEventListener("change", renderEntriesTable);
  els.doseForm.addEventListener("input", renderDoseEstimate);
  els.exportJsonButton.addEventListener("click", exportJson);
  els.exportCsvButton.addEventListener("click", exportCsv);
  els.templateCsvButton.addEventListener("click", downloadTemplateCsv);
  els.clearDataButton.addEventListener("click", clearAllData);
  els.importJsonInput.addEventListener("change", (event) => {
    const [file] = event.target.files;
    if (file) importJson(file);
    event.target.value = "";
  });
  els.importCsvInput.addEventListener("change", (event) => {
    const [file] = event.target.files;
    if (file) importCsv(file);
    event.target.value = "";
  });

  els.entriesTable.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    if (button.dataset.action === "edit") editEntry(button.dataset.id);
    if (button.dataset.action === "delete") deleteEntry(button.dataset.id);
  });

  window.addEventListener("resize", renderChart);
}

async function init() {
  await loadState();
  initTheme();
  hydrateSettingsForm();
  setDefaultEntryDateTime();
  bindEvents();
  renderAll();
}

init().catch((error) => {
  console.error("Could not start diabetes manager", error);
  alert("The app could not start. Check the browser console for details.");
});
