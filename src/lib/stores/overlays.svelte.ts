import type { AccountDisplay } from "./accounts";
import { cancel as cancelBarcodeScanner } from "@tauri-apps/plugin-barcode-scanner";

// --- Reactive state ---
let overlays: Record<string, true> = $state({});
let overlayHistory: string[] = $state([]);
let editingAccount: AccountDisplay | null = $state(null);
let migrationData: number[] | undefined = $state(undefined);

// Internal bookkeeping (not reactive)
let ignorePopstate = 0;
let popstateClosing = false;

// --- Reads ---

export function has(name: string): boolean {
  return overlays[name] === true;
}

export function getEditingAccount(): AccountDisplay | null {
  return editingAccount;
}

export function getMigrationData(): number[] | undefined {
  return migrationData;
}

export function hasAny(): boolean {
  return overlayHistory.length > 0;
}

// --- Mutations ---

export function open(name: string) {
  overlays[name] = true;
  overlayHistory.push(name);
  history.pushState({ overlay: name }, '');
}

export function close(name: string) {
  delete overlays[name];
  if (name === 'editAccount') editingAccount = null;
  if (name === 'importExternal') migrationData = undefined;
  if (name === 'scanning') {
    try { cancelBarcodeScanner().catch(() => {}); } catch {}
  }
  const idx = overlayHistory.lastIndexOf(name);
  if (idx !== -1) {
    overlayHistory.splice(idx, 1);
    if (!popstateClosing) {
      ignorePopstate++;
      history.back();
    }
  }
}

export function closeMultiple(...names: string[]) {
  let count = 0;
  for (const name of names) {
    delete overlays[name];
    if (name === 'editAccount') editingAccount = null;
    if (name === 'importExternal') migrationData = undefined;
    if (name === 'scanning') {
      try { cancelBarcodeScanner().catch(() => {}); } catch {}
    }
    const idx = overlayHistory.lastIndexOf(name);
    if (idx !== -1) {
      overlayHistory.splice(idx, 1);
      count++;
    }
  }
  if (count > 0 && !popstateClosing) {
    ignorePopstate++;
    history.go(-count);
  }
}

export function swap(oldName: string, newName: string) {
  delete overlays[oldName];
  overlays[newName] = true;
  const idx = overlayHistory.lastIndexOf(oldName);
  if (idx !== -1) {
    overlayHistory[idx] = newName;
    history.replaceState({ overlay: newName }, '');
  } else {
    open(newName);
  }
}

export function clearAll(appVisible: boolean) {
  const count = overlayHistory.length;
  if (count > 0 && appVisible) {
    ignorePopstate++;
    history.go(-count);
  }
  overlayHistory = [];
  for (const key in overlays) delete overlays[key];
  editingAccount = null;
  migrationData = undefined;
  try { cancelBarcodeScanner().catch(() => {}); } catch {}
}

// --- Data-carrying helpers ---

export function setEditingAccount(account: AccountDisplay) {
  editingAccount = account;
}

export function setMigrationData(data: number[] | undefined) {
  migrationData = data;
}

// --- Browser integration (called from App.svelte $effect) ---

export function handlePopstate() {
  if (ignorePopstate > 0) {
    ignorePopstate--;
    return;
  }
  const top = overlayHistory.pop();
  if (top) {
    popstateClosing = true;
    delete overlays[top];
    if (top === 'editAccount') editingAccount = null;
    if (top === 'importExternal') migrationData = undefined;
    if (top === 'scanning') {
      try { cancelBarcodeScanner().catch(() => {}); } catch {}
    }
    popstateClosing = false;
  }
}
