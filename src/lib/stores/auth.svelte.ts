import { authStatus, hasPin, lockVault, getBiometricPreference, setBiometricPreference } from "./accounts";
import { checkStatus } from "@tauri-apps/plugin-biometric";

const AUTO_LOCK_MS = 5 * 60 * 1000;

// --- Reactive state ---
let locked = $state(true);
let pinEnabled = $state(false);
let loading = $state(true);
let biometricHardwareAvailable = $state(false);
let biometricEnabled = $state(false);
let appVisible = $state(true);

let autoLockTimer: ReturnType<typeof setTimeout> | null = null;

// --- Reads ---

export function isLocked(): boolean {
  return locked;
}

export function isPinEnabled(): boolean {
  return pinEnabled;
}

export function isLoading(): boolean {
  return loading;
}

export function isBiometricHardwareAvailable(): boolean {
  return biometricHardwareAvailable;
}

export function isBiometricEnabled(): boolean {
  return biometricEnabled;
}

export function isAppVisible(): boolean {
  return appVisible;
}

// --- Visibility ---

export function setAppVisible(visible: boolean) {
  appVisible = visible;
}

// --- Biometric ---

async function checkBiometricAvailability() {
  try {
    const status = await Promise.race([
      checkStatus(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 3000)
      ),
    ]);
    biometricHardwareAvailable = status.isAvailable;
    const stored = await getBiometricPreference();
    biometricEnabled = stored && biometricHardwareAvailable;
  } catch {
    biometricHardwareAvailable = false;
    biometricEnabled = false;
  }
}

export function handleBiometricToggle() {
  biometricEnabled = !biometricEnabled;
  setBiometricPreference(biometricEnabled).catch(() => {});
}

export function handleBiometricEnable() {
  biometricEnabled = true;
  setBiometricPreference(true).catch(() => {});
}

export function handleBiometricSkip() {
  biometricEnabled = false;
  setBiometricPreference(false).catch(() => {});
}

// --- Auth lifecycle ---

/** Returns true if account data was unreadable and had to be backed up. */
export async function checkPin(): Promise<boolean> {
  let dataRecovered = false;
  try {
    const status = await authStatus();
    pinEnabled = status.pin_enabled;
    locked = pinEnabled ? !status.unlocked : false;
    dataRecovered = status.data_recovered ?? false;
    if (pinEnabled) {
      await checkBiometricAvailability();
    }
  } catch {
    try {
      pinEnabled = await hasPin();
      locked = pinEnabled;
      if (pinEnabled) {
        await checkBiometricAvailability();
      }
    } catch {
      locked = false;
      pinEnabled = false;
    }
  } finally {
    loading = false;
  }
  return dataRecovered;
}

export async function handleUnlock() {
  try {
    const status = await authStatus();
    pinEnabled = status.pin_enabled;
    locked = pinEnabled ? !status.unlocked : false;
  } catch {
    locked = false;
    pinEnabled = await hasPin();
  }
}

export function handlePinRemoved() {
  pinEnabled = false;
  biometricEnabled = false;
  setBiometricPreference(false).catch(() => {});
}

/** Returns whether the caller should show the biometric prompt. */
export async function handlePinSetupDone(): Promise<boolean> {
  pinEnabled = true;
  await checkBiometricAvailability();
  return biometricHardwareAvailable && !biometricEnabled;
}

// --- Locking ---

export async function lockApp(clearOverlays: () => void) {
  try {
    await lockVault();
  } catch {
    // Retry once — locking must not fail silently
    try { await lockVault(); } catch (e) {
      console.error("[ghost-auth] lockVault failed after retry:", e);
    }
  }
  clearOverlays();
  locked = true;
}

// --- Auto-lock ---

export function resetAutoLock(clearOverlays: () => void) {
  if (autoLockTimer) clearTimeout(autoLockTimer);
  if (!pinEnabled || locked || loading) return;
  autoLockTimer = setTimeout(() => {
    lockApp(clearOverlays);
  }, AUTO_LOCK_MS);
}

export function stopAutoLock() {
  if (autoLockTimer) {
    clearTimeout(autoLockTimer);
    autoLockTimer = null;
  }
}
