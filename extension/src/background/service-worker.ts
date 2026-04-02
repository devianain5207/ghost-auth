import { getBrowserStorage, getBrowserRuntime, getBrowserAlarms } from "$core/browser";

const AUTO_LOCK_ALARM = "ghost-auth-auto-lock";
const DEFAULT_AUTO_LOCK_MINUTES = 5;
const AUTO_LOCK_SETTING_KEY = "ghost_auto_lock_minutes";

const browserRuntime = getBrowserRuntime();
const browserAlarms = getBrowserAlarms();
const browserStorage = getBrowserStorage();

// Auto-lock: clear cached DEK from session storage
browserAlarms.onAlarm.addListener((alarm: chrome.alarms.Alarm) => {
  if (alarm.name === AUTO_LOCK_ALARM) {
    browserStorage.session?.remove("ghost_dek").catch(() => {});
  }
});

// Listen for messages from popup
browserRuntime.onMessage.addListener(
  (msg: { type: string; minutes?: number }, _sender: unknown, sendResponse: (resp: unknown) => void) => {
    if (msg.type === "reset-auto-lock") {
      // Get configured timeout or use default
      browserStorage.local.get(AUTO_LOCK_SETTING_KEY).then((result: Record<string, unknown>) => {
        const minutes = (result[AUTO_LOCK_SETTING_KEY] as number) || DEFAULT_AUTO_LOCK_MINUTES;
        browserAlarms.clear(AUTO_LOCK_ALARM);
        if (minutes > 0) {
          browserAlarms.create(AUTO_LOCK_ALARM, { delayInMinutes: minutes });
        }
        sendResponse({ ok: true });
      }).catch(() => {
        sendResponse({ ok: false });
      });
      return true; // async response
    } else if (msg.type === "clear-auto-lock") {
      browserAlarms.clear(AUTO_LOCK_ALARM);
      sendResponse({ ok: true });
    } else if (msg.type === "set-auto-lock-timeout") {
      const minutes = msg.minutes ?? DEFAULT_AUTO_LOCK_MINUTES;
      browserStorage.local.set({ [AUTO_LOCK_SETTING_KEY]: minutes }).then(() => {
        // Reset the alarm with the new timeout
        browserAlarms.clear(AUTO_LOCK_ALARM);
        if (minutes > 0) {
          browserAlarms.create(AUTO_LOCK_ALARM, { delayInMinutes: minutes });
        }
        sendResponse({ ok: true });
      }).catch(() => {
        sendResponse({ ok: false });
      });
      return true; // async response
    } else if (msg.type === "get-auto-lock-timeout") {
      browserStorage.local.get(AUTO_LOCK_SETTING_KEY).then((result: Record<string, unknown>) => {
        sendResponse({ minutes: (result[AUTO_LOCK_SETTING_KEY] as number) || DEFAULT_AUTO_LOCK_MINUTES });
      }).catch(() => {
        sendResponse({ minutes: DEFAULT_AUTO_LOCK_MINUTES });
      });
      return true; // async response
    } else if (msg.type === "start-qr-scan") {
      // Inject the QR scanner content script into the active tab
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tabId = tabs[0]?.id;
        if (!tabId) { sendResponse({ ok: false }); return; }
        chrome.scripting.executeScript(
          { target: { tabId }, files: ["qr-scanner.js"] },
          () => {
            if (chrome.runtime.lastError) {
              sendResponse({ ok: false, error: chrome.runtime.lastError.message });
              return;
            }
            sendResponse({ ok: true });
          },
        );
      });
      return true; // async response
    } else if (msg.type === "qr-region-selected") {
      // Capture visible tab and send screenshot to content script
      const sender = _sender as chrome.runtime.MessageSender;
      const tabId = sender.tab?.id;
      if (!tabId) { sendResponse({ ok: false }); return; }
      chrome.tabs.captureVisibleTab({ format: "png" }, (dataUrl) => {
        if (chrome.runtime.lastError || !dataUrl) {
          sendResponse({ ok: false, error: chrome.runtime.lastError?.message ?? "Screenshot failed" });
          return;
        }
        chrome.tabs.sendMessage(tabId, { type: "screenshot", dataUrl });
        sendResponse({ ok: true });
      });
      return true; // async response
    } else if (msg.type === "qr-scanned") {
      // Store scanned URI for the popup to pick up
      const uri = (msg as { uri?: string }).uri;
      if (uri) {
        browserStorage.session?.set({ ghost_pending_qr: uri }).catch(() => {});
      }
      sendResponse({ ok: true });
    }
    return false;
  },
);
