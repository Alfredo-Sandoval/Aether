// background.js - Single Source of Truth for settings

if (typeof importScripts === "function") {
  importScripts("shared-utils.js");
}

const sharedUtils = globalThis.AetherShared;
if (!sharedUtils) {
  throw new Error("Aether: shared utilities failed to load in background context.");
}

const {
  sanitizeBackgroundUrl: sharedSanitizeBackgroundUrl,
  sanitizeBackgroundBlur: sharedSanitizeBackgroundBlur,
  sanitizeContentWidth,
  sanitizeBackgroundScaling,
  coerceBooleanLike,
} = sharedUtils;

const getExtensionUrl = (path) => (chrome?.runtime?.getURL ? chrome.runtime.getURL(path) : "");
const EXTENSION_BASE_URL = getExtensionUrl("");
const sanitizeBackgroundUrl = (url) => sharedSanitizeBackgroundUrl(url, EXTENSION_BASE_URL);
const sanitizeBackgroundBlur = (rawValue) =>
  sharedSanitizeBackgroundBlur(rawValue, {
    min: 0,
    max: 150,
    fallback: 60,
  });

const DEFAULTS = {
  theme: "auto",
  appearance: "dimmed",
  hideGpt5Limit: false,
  hideUpgradeButtons: false,
  disableAnimations: false,
  disableBgAnimation: false,

  customBgUrl: "__jet__",
  backgroundBlur: "60",
  contentWidth: "95",
  backgroundScaling: "cover",
  hideGptsButton: false,
  hideSoraButton: false,
  hideTodaysPulse: false,
  hideShoppingButton: true,
  hasSeenWelcomeScreen: false,
  blurChatHistory: false,
  accentColor: "none",
};

const SETTINGS_KEYS = Object.keys(DEFAULTS);
const SETTINGS_KEY_SET = new Set(SETTINGS_KEYS);
const BOOLEAN_SETTING_KEYS = SETTINGS_KEYS.filter((key) => typeof DEFAULTS[key] === "boolean");
const BOOLEAN_SETTING_KEY_SET = new Set(BOOLEAN_SETTING_KEYS);

const DURABILITY_SCHEMA_VERSION = 1;
const MAX_BACKUP_SNAPSHOTS = 24;
const BACKUP_MIN_INTERVAL_MS = 4000;
const DURABILITY_STORAGE_KEYS = {
  mirror: "aether_settings_mirror_v1",
  backups: "aether_settings_backups_v1",
  userDefaults: "aether_user_defaults_v1",
};
const LOCAL_CACHE_KEYS = ["detectedTheme", ...Object.values(DURABILITY_STORAGE_KEYS)];

const isPlainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

const pickKnownSettings = (rawSettings) => {
  const source = isPlainObject(rawSettings) ? rawSettings : {};
  const picked = {};
  SETTINGS_KEYS.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      picked[key] = source[key];
    }
  });
  return picked;
};

const hasAnyKnownSetting = (rawSettings) => {
  const source = isPlainObject(rawSettings) ? rawSettings : {};
  for (const key of SETTINGS_KEYS) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      return true;
    }
  }
  return false;
};

const sanitizeSettingsPayload = (rawSettings) => {
  const known = pickKnownSettings(rawSettings);
  const merged = { ...DEFAULTS, ...known };
  const sanitized = { ...merged };
  BOOLEAN_SETTING_KEYS.forEach((key) => {
    sanitized[key] = coerceBooleanLike(merged[key], DEFAULTS[key]);
  });
  sanitized.customBgUrl = sanitizeBackgroundUrl(merged.customBgUrl || "");
  sanitized.backgroundBlur = sanitizeBackgroundBlur(merged.backgroundBlur);
  sanitized.contentWidth = sanitizeContentWidth(merged.contentWidth);
  sanitized.backgroundScaling = sanitizeBackgroundScaling(merged.backgroundScaling);

  const patch = {};
  BOOLEAN_SETTING_KEYS.forEach((key) => {
    if (sanitized[key] !== merged[key]) {
      patch[key] = sanitized[key];
    }
  });
  if (sanitized.customBgUrl !== merged.customBgUrl) {
    patch.customBgUrl = sanitized.customBgUrl;
  }
  if (sanitized.backgroundBlur !== String(merged.backgroundBlur ?? "")) {
    patch.backgroundBlur = sanitized.backgroundBlur;
  }
  if (sanitized.contentWidth !== String(merged.contentWidth ?? "")) {
    patch.contentWidth = sanitized.contentWidth;
  }
  if (sanitized.backgroundScaling !== merged.backgroundScaling) {
    patch.backgroundScaling = sanitized.backgroundScaling;
  }

  return { sanitized, patch };
};

const persistSanitizedPatch = (patch) => {
  if (Object.keys(patch).length === 0) return;
  chrome.storage.sync.set(patch);
};

const isTransientRuntimeError = (message) => {
  const text = String(message || "").toLowerCase();
  return (
    text.includes("no sw") ||
    text.includes("service worker") ||
    text.includes("extension context invalidated") ||
    text.includes("receiving end does not exist")
  );
};

const logRuntimeError = (context, message) => {
  if (isTransientRuntimeError(message)) return;
  console.error(`Aether: ${context}:`, message);
};

const createSettingsFingerprint = (settings) =>
  SETTINGS_KEYS.map((key) => `${key}:${JSON.stringify(settings[key])}`).join("|");

const normalizeSnapshotEnvelope = (rawSnapshot) => {
  if (!isPlainObject(rawSnapshot) || !isPlainObject(rawSnapshot.settings)) {
    return null;
  }
  const { sanitized } = sanitizeSettingsPayload(rawSnapshot.settings);
  const savedAt = Number(rawSnapshot.savedAt);
  return {
    schemaVersion: DURABILITY_SCHEMA_VERSION,
    savedAt: Number.isFinite(savedAt) && savedAt > 0 ? savedAt : Date.now(),
    reason: typeof rawSnapshot.reason === "string" ? rawSnapshot.reason : "unknown",
    fingerprint: createSettingsFingerprint(sanitized),
    settings: sanitized,
  };
};

const normalizeSnapshotList = (rawSnapshots) => {
  if (!Array.isArray(rawSnapshots)) return [];
  const normalized = [];
  rawSnapshots.forEach((entry) => {
    const snapshot = normalizeSnapshotEnvelope(entry);
    if (snapshot) {
      normalized.push(snapshot);
    }
  });
  normalized.sort((a, b) => b.savedAt - a.savedAt);
  return normalized.slice(0, MAX_BACKUP_SNAPSHOTS);
};

const buildSnapshotEnvelope = (settings, reason) => {
  const { sanitized } = sanitizeSettingsPayload(settings);
  return {
    schemaVersion: DURABILITY_SCHEMA_VERSION,
    savedAt: Date.now(),
    reason,
    fingerprint: createSettingsFingerprint(sanitized),
    settings: sanitized,
  };
};

const getPopupLocalPayload = () => {
  const payload = {};
  if (typeof localCache.detectedTheme === "string") {
    payload.detectedTheme = localCache.detectedTheme;
  }
  return payload;
};

const buildDurabilityStatus = (localData) => {
  const mirror = normalizeSnapshotEnvelope(localData[DURABILITY_STORAGE_KEYS.mirror]);
  const backups = normalizeSnapshotList(localData[DURABILITY_STORAGE_KEYS.backups]);
  const userDefaults = normalizeSnapshotEnvelope(localData[DURABILITY_STORAGE_KEYS.userDefaults]);

  return {
    schemaVersion: DURABILITY_SCHEMA_VERSION,
    mirrorSavedAt: mirror ? mirror.savedAt : null,
    backupCount: backups.length,
    latestBackupAt: backups[0] ? backups[0].savedAt : null,
    userDefaultsSavedAt: userDefaults ? userDefaults.savedAt : null,
  };
};

const parseImportSettings = (rawPayload, baseSettings = DEFAULTS) => {
  if (!isPlainObject(rawPayload)) return null;
  const source = isPlainObject(rawPayload.settings) ? rawPayload.settings : rawPayload;
  const known = pickKnownSettings(source);
  if (Object.keys(known).length === 0) return null;
  return sanitizeSettingsPayload({ ...DEFAULTS, ...baseSettings, ...known }).sanitized;
};

const parseImportUserDefaultsSnapshot = (rawPayload, baseSettings = DEFAULTS) => {
  if (!isPlainObject(rawPayload) || !isPlainObject(rawPayload.userDefaults)) return null;
  const userDefaultsSource = rawPayload.userDefaults;
  const source = isPlainObject(userDefaultsSource.settings) ? userDefaultsSource.settings : userDefaultsSource;
  const known = pickKnownSettings(source);
  if (Object.keys(known).length === 0) return null;
  return buildSnapshotEnvelope({ ...DEFAULTS, ...baseSettings, ...known }, "manual-import-user-defaults");
};

// --- Settings cache for instant responses ---
let settingsCache = null;
let localCache = {};
let durabilityWriteQueue = Promise.resolve();
let lastBackupWrittenAt = 0;

const persistDurabilitySnapshot = (settings, reason, options = {}) => {
  const { forceBackup = false } = options;
  const snapshot = buildSnapshotEnvelope(settings, reason);

  durabilityWriteQueue = durabilityWriteQueue.then(() => {
    return new Promise((resolve) => {
      chrome.storage.local.get([DURABILITY_STORAGE_KEYS.backups], (result) => {
        if (chrome.runtime.lastError) {
          logRuntimeError("Failed to read durability snapshots", chrome.runtime.lastError.message);
          resolve();
          return;
        }

        const backups = normalizeSnapshotList(result[DURABILITY_STORAGE_KEYS.backups]);
        const latest = backups[0] || null;
        const isDuplicateOfLatest = !!latest && latest.fingerprint === snapshot.fingerprint;
        const isWithinBackupWindow = snapshot.savedAt - lastBackupWrittenAt < BACKUP_MIN_INTERVAL_MS;

        const shouldStoreBackup = forceBackup || (!isDuplicateOfLatest && !isWithinBackupWindow);
        const nextBackups = shouldStoreBackup
          ? [snapshot, ...backups.filter((entry) => entry.fingerprint !== snapshot.fingerprint)].slice(
              0,
              MAX_BACKUP_SNAPSHOTS
            )
          : backups;

        if (shouldStoreBackup) {
          lastBackupWrittenAt = snapshot.savedAt;
        }

        chrome.storage.local.set(
          {
            [DURABILITY_STORAGE_KEYS.mirror]: snapshot,
            [DURABILITY_STORAGE_KEYS.backups]: nextBackups,
          },
          () => {
            if (chrome.runtime.lastError) {
              logRuntimeError("Failed to write durability snapshots", chrome.runtime.lastError.message);
            }
            resolve();
          }
        );
      });
    });
  });
};

const hydrateSettingsFromMirror = (reason, callback) => {
  chrome.storage.local.get([DURABILITY_STORAGE_KEYS.mirror], (result) => {
    if (chrome.runtime.lastError) {
      logRuntimeError("Failed to read mirror settings", chrome.runtime.lastError.message);
      settingsCache = { ...DEFAULTS };
      callback({ ...settingsCache });
      return;
    }

    const mirrorSnapshot = normalizeSnapshotEnvelope(result[DURABILITY_STORAGE_KEYS.mirror]);
    if (!mirrorSnapshot) {
      settingsCache = { ...DEFAULTS };
      chrome.storage.sync.set(settingsCache, () => {
        if (chrome.runtime.lastError) {
          logRuntimeError("Failed to reseed defaults in sync storage", chrome.runtime.lastError.message);
        }
      });
      persistDurabilitySnapshot(settingsCache, "sync-reseed-defaults", { forceBackup: true });
      callback({ ...settingsCache });
      return;
    }

    settingsCache = { ...mirrorSnapshot.settings };
    chrome.storage.sync.set(settingsCache, () => {
      if (chrome.runtime.lastError) {
        logRuntimeError(`Failed to restore sync settings (${reason})`, chrome.runtime.lastError.message);
      }
      persistDurabilitySnapshot(settingsCache, "recover-from-local-mirror", { forceBackup: true });
      callback({ ...settingsCache });
    });
  });
};

const hydrateSettingsCache = (callback) => {
  if (settingsCache) {
    callback({ ...settingsCache });
    return;
  }

  chrome.storage.sync.get(null, (rawSettings) => {
    if (chrome.runtime.lastError) {
      logRuntimeError("Failed to read sync settings", chrome.runtime.lastError.message);
      hydrateSettingsFromMirror("sync-read-error", callback);
      return;
    }

    if (!hasAnyKnownSetting(rawSettings)) {
      hydrateSettingsFromMirror("sync-empty", callback);
      return;
    }

    const { sanitized, patch } = sanitizeSettingsPayload(rawSettings);
    settingsCache = { ...sanitized };
    persistSanitizedPatch(patch);
    persistDurabilitySnapshot(sanitized, "hydrate-sync");
    callback({ ...sanitized });
  });
};

// Intentionally avoid startup pre-cache to prevent transient MV3 SW wake races.
// Cache is hydrated lazily on first GET_SETTINGS/GET_SETTINGS_FULL request.
chrome.storage.local.get(LOCAL_CACHE_KEYS, (result) => {
  if (!chrome.runtime.lastError && result) {
    localCache = result;
  }
});

// Keep cache in sync with storage changes
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync") {
    if (!settingsCache) {
      settingsCache = { ...DEFAULTS };
    }

    let hasKnownSettingChanges = false;
    const patch = {};

    for (const key in changes) {
      if (!SETTINGS_KEY_SET.has(key)) continue;
      hasKnownSettingChanges = true;

      const rawValue = changes[key].newValue;
      let nextValue = rawValue === undefined ? DEFAULTS[key] : rawValue;

      if (key === "customBgUrl") {
        nextValue = sanitizeBackgroundUrl(nextValue || "");
      } else if (key === "backgroundBlur") {
        nextValue = sanitizeBackgroundBlur(nextValue);
      } else if (key === "contentWidth") {
        nextValue = sanitizeContentWidth(nextValue);
      } else if (key === "backgroundScaling") {
        nextValue = sanitizeBackgroundScaling(nextValue);
      } else if (BOOLEAN_SETTING_KEY_SET.has(key)) {
        nextValue = coerceBooleanLike(nextValue, DEFAULTS[key]);
      }

      settingsCache[key] = nextValue;
      if (nextValue !== rawValue) {
        patch[key] = nextValue;
      }
    }

    persistSanitizedPatch(patch);
    if (hasKnownSettingChanges) {
      persistDurabilitySnapshot(settingsCache, "sync-change");
    }
  }

  if (area === "local") {
    for (const key in changes) {
      if (changes[key].newValue === undefined) {
        delete localCache[key];
      } else {
        localCache[key] = changes[key].newValue;
      }
    }
  }
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.storage.sync.set(DEFAULTS, () => {
      if (chrome.runtime.lastError) {
        logRuntimeError("Failed to set defaults on install", chrome.runtime.lastError.message);
        return;
      }
      settingsCache = { ...DEFAULTS };
      persistDurabilitySnapshot(settingsCache, "fresh-install", { forceBackup: true });
      console.log("Aether Extension: First install, defaults set.");
    });
    return;
  }

  if (details.reason === "update") {
    chrome.storage.sync.get(null, (rawSettings) => {
      if (chrome.runtime.lastError) {
        logRuntimeError("Failed to read settings on update", chrome.runtime.lastError.message);
        return;
      }
      const { sanitized } = sanitizeSettingsPayload(rawSettings);
      chrome.storage.sync.set(sanitized, () => {
        if (chrome.runtime.lastError) {
          logRuntimeError("Failed to write settings on update", chrome.runtime.lastError.message);
          return;
        }
        settingsCache = { ...sanitized };
        persistDurabilitySnapshot(settingsCache, "extension-update", { forceBackup: true });
        console.log("Aether Extension: Updated, settings preserved and merged.");
      });
    });
  }
});

// Listen for requests from other parts of the extension (popup, content script).
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.type === "GET_SETTINGS") {
    if (settingsCache) {
      sendResponse({ ...settingsCache });
      return false;
    }

    hydrateSettingsCache((settings) => {
      sendResponse(settings);
    });
    return true;
  }

  if (request.type === "GET_SETTINGS_FULL") {
    const respond = (syncSettings) => {
      sendResponse({
        settings: syncSettings,
        defaults: DEFAULTS,
        local: getPopupLocalPayload(),
      });
    };

    if (settingsCache) {
      respond({ ...settingsCache });
      return false;
    }

    hydrateSettingsCache((settings) => {
      respond(settings);
    });
    return true;
  }

  if (request.type === "GET_DEFAULTS") {
    sendResponse(DEFAULTS);
    return false;
  }

  if (request.type === "GET_DURABILITY_STATUS") {
    chrome.storage.local.get(Object.values(DURABILITY_STORAGE_KEYS), (result) => {
      if (chrome.runtime.lastError) {
        logRuntimeError("Failed to read durability status", chrome.runtime.lastError.message);
        sendResponse({ ok: false, error: "failed_to_read_durability_status" });
        return;
      }
      sendResponse({ ok: true, status: buildDurabilityStatus(result || {}) });
    });
    return true;
  }

  if (request.type === "SAVE_USER_DEFAULTS") {
    hydrateSettingsCache((settings) => {
      const snapshot = buildSnapshotEnvelope(settings, "manual-save-user-defaults");
      chrome.storage.local.set({ [DURABILITY_STORAGE_KEYS.userDefaults]: snapshot }, () => {
        if (chrome.runtime.lastError) {
          logRuntimeError("Failed to save user defaults", chrome.runtime.lastError.message);
          sendResponse({ ok: false, error: "failed_to_save_user_defaults" });
          return;
        }
        persistDurabilitySnapshot(settings, "manual-save-user-defaults", { forceBackup: true });
        sendResponse({ ok: true, savedAt: snapshot.savedAt });
      });
    });
    return true;
  }

  if (request.type === "RESTORE_USER_DEFAULTS") {
    chrome.storage.local.get([DURABILITY_STORAGE_KEYS.userDefaults], (result) => {
      if (chrome.runtime.lastError) {
        logRuntimeError("Failed to load user defaults", chrome.runtime.lastError.message);
        sendResponse({ ok: false, error: "failed_to_load_user_defaults" });
        return;
      }

      const snapshot = normalizeSnapshotEnvelope(result[DURABILITY_STORAGE_KEYS.userDefaults]);
      if (!snapshot) {
        sendResponse({ ok: false, error: "missing_user_defaults" });
        return;
      }

      settingsCache = { ...snapshot.settings };
      chrome.storage.sync.set(settingsCache, () => {
        if (chrome.runtime.lastError) {
          logRuntimeError("Failed to restore user defaults", chrome.runtime.lastError.message);
          sendResponse({ ok: false, error: "failed_to_restore_user_defaults" });
          return;
        }
        persistDurabilitySnapshot(settingsCache, "manual-restore-user-defaults", { forceBackup: true });
        sendResponse({ ok: true, settings: { ...settingsCache }, savedAt: snapshot.savedAt });
      });
    });
    return true;
  }

  if (request.type === "EXPORT_SETTINGS") {
    hydrateSettingsCache((settings) => {
      chrome.storage.local.get([DURABILITY_STORAGE_KEYS.userDefaults], (result) => {
        if (chrome.runtime.lastError) {
          logRuntimeError("Failed to load export metadata", chrome.runtime.lastError.message);
          sendResponse({ ok: false, error: "failed_to_export_settings" });
          return;
        }
        const userDefaults = normalizeSnapshotEnvelope(result[DURABILITY_STORAGE_KEYS.userDefaults]);
        sendResponse({
          ok: true,
          payload: {
            schemaVersion: DURABILITY_SCHEMA_VERSION,
            exportedAt: new Date().toISOString(),
            extension: "Aether",
            settings: { ...settings },
            userDefaults,
          },
        });
      });
    });
    return true;
  }

  if (request.type === "IMPORT_SETTINGS") {
    hydrateSettingsCache((currentSettings) => {
      const importedSettings = parseImportSettings(request.payload, currentSettings);
      if (!importedSettings) {
        sendResponse({ ok: false, error: "invalid_import_payload" });
        return;
      }

      const importedUserDefaults = parseImportUserDefaultsSnapshot(request.payload, currentSettings);
      settingsCache = { ...importedSettings };

      chrome.storage.sync.set(settingsCache, () => {
        if (chrome.runtime.lastError) {
          logRuntimeError("Failed to import settings", chrome.runtime.lastError.message);
          sendResponse({ ok: false, error: "failed_to_import_settings" });
          return;
        }

        const finishImport = () => {
          persistDurabilitySnapshot(settingsCache, "manual-import-settings", { forceBackup: true });
          sendResponse({ ok: true, settings: { ...settingsCache } });
        };

        if (!importedUserDefaults) {
          finishImport();
          return;
        }

        chrome.storage.local.set({ [DURABILITY_STORAGE_KEYS.userDefaults]: importedUserDefaults }, () => {
          if (chrome.runtime.lastError) {
            logRuntimeError("Failed to import user defaults snapshot", chrome.runtime.lastError.message);
          }
          finishImport();
        });
      });
    });
    return true;
  }

  if (request.type === "OPEN_POPUP") {
    try {
      if (chrome.action?.openPopup) {
        chrome.action.openPopup().catch(() => {
          chrome.tabs.create({ url: chrome.runtime.getURL("popup.html") });
        });
      } else {
        chrome.tabs.create({ url: chrome.runtime.getURL("popup.html") });
      }
    } catch (_err) {
      chrome.tabs.create({ url: chrome.runtime.getURL("popup.html") });
    }
    return true;
  }

  return false;
});
