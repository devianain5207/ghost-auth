/**
 * iOS keyboard handling: push modal panels above the virtual keyboard.
 * iOS WKWebView overlays the keyboard instead of resizing the viewport,
 * and visualViewport resize events may not fire, so we detect keyboard
 * via focus events on inputs inside modal panels and fall back to an
 * estimated height when viewport APIs don't report changes.
 * Android doesn't need this — its WebView resizes the viewport natively.
 *
 * Call from a Svelte $effect — returns a cleanup function, or undefined on non-iOS.
 */
export function setupIosKeyboardHandling(): (() => void) | undefined {
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (!isIOS) return undefined;

  const baseHeight = window.innerHeight;
  let focusTimer: ReturnType<typeof setTimeout> | null = null;
  let blurTimer: ReturnType<typeof setTimeout> | null = null;
  let viewportTimer: ReturnType<typeof setTimeout> | null = null;

  function getKeyboardHeight(): number {
    const vv = window.visualViewport;
    if (vv) {
      const offset = baseHeight - vv.height;
      if (offset > 100) return offset;
    }
    const diff = baseHeight - window.innerHeight;
    if (diff > 100) return diff;
    return 0;
  }

  function onFocusIn(e: FocusEvent) {
    const el = e.target as HTMLElement;
    if (el.tagName !== "INPUT" && el.tagName !== "TEXTAREA") return;
    if ((el as HTMLInputElement).type === "file") return;
    if (!el.closest(".modal-panel") && !el.closest(".search-bottom")) return;

    if (blurTimer) {
      clearTimeout(blurTimer);
      blurTimer = null;
    }
    if (focusTimer) {
      clearTimeout(focusTimer);
      focusTimer = null;
    }

    focusTimer = setTimeout(() => {
      let kb = getKeyboardHeight();
      if (kb === 0) kb = Math.round(baseHeight * 0.4);
      if (kb > 0) {
        document.documentElement.style.setProperty("--keyboard-inset-bottom", `${kb}px`);
        el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
      focusTimer = null;
    }, 20);
  }

  function onFocusOut() {
    if (focusTimer) {
      clearTimeout(focusTimer);
      focusTimer = null;
    }

    blurTimer = setTimeout(() => {
      const active = document.activeElement;
      if (active?.tagName !== "INPUT" && active?.tagName !== "TEXTAREA") {
        document.documentElement.style.setProperty("--keyboard-inset-bottom", "0px");
      }
      blurTimer = null;
    }, 150);
  }

  // Debounced: only update the CSS variable after the keyboard animation
  // settles, so we don't restart the CSS transition on every frame.
  function onViewportChange() {
    if (viewportTimer) clearTimeout(viewportTimer);
    viewportTimer = setTimeout(() => {
      const kb = getKeyboardHeight();
      if (kb > 100) {
        document.documentElement.style.setProperty("--keyboard-inset-bottom", `${kb}px`);
      } else if (kb === 0 && !focusTimer) {
        document.documentElement.style.setProperty("--keyboard-inset-bottom", "0px");
      }
      viewportTimer = null;
    }, 150);
  }

  document.addEventListener("focusin", onFocusIn);
  document.addEventListener("focusout", onFocusOut);
  const vv = window.visualViewport;
  if (vv) vv.addEventListener("resize", onViewportChange);
  window.addEventListener("resize", onViewportChange);

  return () => {
    if (focusTimer) clearTimeout(focusTimer);
    if (blurTimer) clearTimeout(blurTimer);
    if (viewportTimer) clearTimeout(viewportTimer);
    document.removeEventListener("focusin", onFocusIn);
    document.removeEventListener("focusout", onFocusOut);
    if (vv) vv.removeEventListener("resize", onViewportChange);
    window.removeEventListener("resize", onViewportChange);
    document.documentElement.style.removeProperty("--keyboard-inset-bottom");
  };
}
