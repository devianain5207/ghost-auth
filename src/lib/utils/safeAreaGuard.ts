/**
 * Android safe-area guard: detects and corrects double-counted safe-area insets.
 *
 * The edge-to-edge plugin injects --safe-area-inset-* CSS variables based on
 * WindowInsetsCompat values. If the WebView is NOT actually in edge-to-edge
 * mode (e.g. OEM firmware quirk or decorFitsSystemWindows reset), those values
 * cause double-spacing because the system already insets the viewport.
 *
 * Detection: in true edge-to-edge the viewport height ≈ screen height.
 * If the viewport is >10 % smaller the system is consuming insets itself,
 * so we zero out the plugin's CSS variables.
 *
 * Call from a Svelte $effect — returns a cleanup function, or undefined on non-Android.
 */
export function setupSafeAreaGuard(): (() => void) | undefined {
  if (!/android/i.test(navigator.userAgent)) return undefined;

  function check() {
    const viewportH = window.visualViewport?.height ?? window.innerHeight;
    const screenH = screen.height;
    if (screenH === 0) return;

    if (viewportH < screenH * 0.90) {
      const s = document.documentElement.style;
      s.setProperty('--safe-area-inset-top', '0px');
      s.setProperty('--safe-area-inset-bottom', '0px');
      s.setProperty('--safe-area-inset-left', '0px');
      s.setProperty('--safe-area-inset-right', '0px');
    }
  }

  // Run after the plugin has had time to inject, then re-check whenever it fires
  const timer = setTimeout(check, 300);
  const onSafeAreaChanged = () => setTimeout(check, 50);
  window.addEventListener('safeAreaChanged', onSafeAreaChanged);

  return () => {
    clearTimeout(timer);
    window.removeEventListener('safeAreaChanged', onSafeAreaChanged);
  };
}
