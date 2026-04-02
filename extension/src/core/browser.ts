export function getBrowserStorage(): typeof chrome.storage {
  return (globalThis as any).browser?.storage ?? chrome.storage;
}

export function getBrowserRuntime(): typeof chrome.runtime {
  return (globalThis as any).browser?.runtime ?? chrome.runtime;
}

export function getBrowserAlarms(): typeof chrome.alarms {
  return (globalThis as any).browser?.alarms ?? chrome.alarms;
}
