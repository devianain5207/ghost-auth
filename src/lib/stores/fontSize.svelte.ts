const STORAGE_KEY = "ghost-auth-font-size";

export const FONT_VW_MIN = 3.8;
export const FONT_VW_MAX = 4.6;
export const FONT_VW_DEFAULT = 4.2;

function getInitialVw(): number {
  if (typeof window === "undefined") return FONT_VW_DEFAULT;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return FONT_VW_DEFAULT;
  const val = parseFloat(stored);
  if (isNaN(val) || val < FONT_VW_MIN || val > FONT_VW_MAX) return FONT_VW_DEFAULT;
  return Math.round(val * 100) / 100;
}

function applyFontVw(vw: number) {
  document.documentElement.style.setProperty("--font-vw", String(vw));
}

let current: number = $state(getInitialVw());

export function getFontSize(): number {
  return current;
}

export function setFontSize(vw: number) {
  const clamped = Math.round(Math.max(FONT_VW_MIN, Math.min(FONT_VW_MAX, vw)) * 100) / 100;
  current = clamped;
  localStorage.setItem(STORAGE_KEY, String(clamped));
  applyFontVw(clamped);
}

// System font scale — detect the OS text-size accessibility setting and inject
// a CSS scale factor so calc(clamp(...) * var(--dt-scale)) tracks it.
//
// iOS:     probe -apple-system-body (responds to Dynamic Type in WKWebView)
// Android: read Configuration.fontScale via Tauri JNI command
function applyDynamicTypeScale() {
  if (!document.body) return;

  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua) ||
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);

  if (isIOS) {
    const probe = document.createElement("span");
    probe.style.cssText =
      "font:-apple-system-body;position:absolute;visibility:hidden;pointer-events:none";
    probe.textContent = "X";
    document.body.appendChild(probe);
    const size = parseFloat(getComputedStyle(probe).fontSize);
    probe.remove();
    // Default iOS body text at "Large" (the default Dynamic Type) is 17pt
    if (size > 0) {
      document.documentElement.style.setProperty("--dt-scale", String(size / 17));
    }
    return;
  }

  if (/Android/.test(ua)) {
    import("@tauri-apps/api/core")
      .then(({ invoke }) => invoke<number>("get_font_scale"))
      .then((scale) => {
        if (scale > 0) {
          document.documentElement.style.setProperty("--dt-scale", String(scale));
        }
      })
      .catch(() => {});
  }
}

// Apply on load
if (typeof window !== "undefined") {
  applyFontVw(getFontSize());

  // Probe Dynamic Type once DOM is ready
  if (document.body) {
    applyDynamicTypeScale();
  } else {
    document.addEventListener("DOMContentLoaded", applyDynamicTypeScale, { once: true });
  }

  // Re-probe when app returns to foreground (user may have changed Dynamic Type in Settings)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") applyDynamicTypeScale();
  });
}
