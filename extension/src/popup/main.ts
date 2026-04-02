import { initI18n } from "$lib/i18n";
import { waitLocale } from "svelte-i18n";
import { mount } from "svelte";
import App from "./App.svelte";

// Global error capture — prevents silent failures, logs to extension storage
const MAX_ERROR_LOG = 50;
let crashReportingEnabled = false;

// Load crash reporting preference and listen for changes
try {
  const _s = ((globalThis as any).browser?.storage ?? chrome?.storage);
  _s?.local?.get("ghost_crash_reporting").then((r: Record<string, any>) => {
    if (r.ghost_crash_reporting === true) crashReportingEnabled = true;
  }).catch(() => {});
  _s?.onChanged?.addListener((changes: Record<string, any>) => {
    if (changes.ghost_crash_reporting) {
      crashReportingEnabled = changes.ghost_crash_reporting.newValue === true;
    }
  });
} catch { /* ignore */ }

function captureError(source: string, msg: string) {
  console.error(`[Ghost Auth] ${source}:`, msg);
  if (!crashReportingEnabled) return;
  try {
    const s = ((globalThis as any).browser?.storage ?? chrome?.storage)?.local;
    if (!s) return;
    s.get("ghost_error_log").then((r: Record<string, string>) => {
      const log: { ts: number; source: string; msg: string }[] =
        r.ghost_error_log ? JSON.parse(r.ghost_error_log) : [];
      log.push({ ts: Date.now(), source, msg });
      while (log.length > MAX_ERROR_LOG) log.shift();
      s.set({ ghost_error_log: JSON.stringify(log) });
    }).catch(() => {});
  } catch { /* don't throw in the error handler */ }
}

window.addEventListener("unhandledrejection", (e) => {
  captureError("rejection", e.reason instanceof Error ? e.reason.message : String(e.reason));
});

window.addEventListener("error", (e) => {
  captureError("error", e.message);
});

initI18n();

waitLocale().then(() => {
  mount(App, {
    target: document.getElementById("app")!,
  });
});
