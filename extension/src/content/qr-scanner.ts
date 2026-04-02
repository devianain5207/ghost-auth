/**
 * Content script: QR code region scanner.
 * Injected on-demand by the service worker when the user clicks "Scan QR from page".
 *
 * Flow:
 * 1. Shows a full-screen overlay with crosshair cursor
 * 2. User draws a rectangle around the QR code
 * 3. Sends coordinates to service worker → receives screenshot data URL
 * 4. Crops the selected region on an offscreen canvas
 * 5. Decodes QR with jsQR
 * 6. Sends the otpauth:// URI back to the service worker
 */

import jsQR from "jsqr";

// Prevent double-injection
if (!(window as any).__ghostAuthQrScanner) {
  (window as any).__ghostAuthQrScanner = true;
  initScanner();
}

function initScanner() {
  // ── State ──
  let startX = 0;
  let startY = 0;
  let dragging = false;

  // ── DOM: overlay container ──
  const overlay = document.createElement("div");
  overlay.id = "ghost-qr-overlay";
  overlay.innerHTML = `
    <style>
      #ghost-qr-overlay {
        position: fixed; inset: 0; z-index: 2147483647;
        cursor: crosshair; user-select: none; -webkit-user-select: none;
      }
      #ghost-qr-overlay * { box-sizing: border-box; }
      .gqr-mask {
        position: fixed; inset: 0;
        background: rgba(0,0,0,0.45);
        pointer-events: none;
        transition: background 0.15s;
      }
      .gqr-hint {
        position: fixed; top: 24px; left: 50%; transform: translateX(-50%);
        background: rgba(0,0,0,0.7); color: #fff; font: 13px/1.4 system-ui, sans-serif;
        padding: 8px 18px; border-radius: 8px; pointer-events: none; white-space: nowrap;
      }
      .gqr-esc {
        position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
        color: rgba(255,255,255,0.5); font: 11px/1.4 system-ui, sans-serif;
        pointer-events: none;
      }
      .gqr-sel {
        position: fixed; border: 2px solid #fff; pointer-events: none; display: none;
        box-shadow: 0 0 0 9999px rgba(0,0,0,0.45);
      }
      .gqr-sel::before, .gqr-sel::after,
      .gqr-sel .c1, .gqr-sel .c2 {
        content: ''; position: absolute; width: 16px; height: 16px;
        border-color: #4ade80; border-style: solid; border-width: 0;
      }
      .gqr-sel::before { top: -2px; left: -2px; border-top-width: 3px; border-left-width: 3px; }
      .gqr-sel::after  { top: -2px; right: -2px; border-top-width: 3px; border-right-width: 3px; }
      .gqr-sel .c1     { bottom: -2px; left: -2px; border-bottom-width: 3px; border-left-width: 3px; }
      .gqr-sel .c2     { bottom: -2px; right: -2px; border-bottom-width: 3px; border-right-width: 3px; }
      .gqr-toast {
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        background: rgba(0,0,0,0.8); color: #fff; font: 14px/1.4 system-ui, sans-serif;
        padding: 14px 28px; border-radius: 10px; pointer-events: none;
        opacity: 0; transition: opacity 0.2s;
      }
      .gqr-toast.show { opacity: 1; }
    </style>
    <div class="gqr-mask"></div>
    <div class="gqr-hint">Draw a rectangle around the QR code</div>
    <div class="gqr-esc">Press Esc to cancel</div>
    <div class="gqr-sel"><div class="c1"></div><div class="c2"></div></div>
    <div class="gqr-toast"></div>
  `;
  document.documentElement.appendChild(overlay);

  const sel = overlay.querySelector<HTMLElement>(".gqr-sel")!;
  const hint = overlay.querySelector<HTMLElement>(".gqr-hint")!;
  const toast = overlay.querySelector<HTMLElement>(".gqr-toast")!;

  // ── Pointer events ──
  overlay.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    startX = e.clientX;
    startY = e.clientY;
    dragging = true;
    sel.style.display = "block";
    updateSel(e.clientX, e.clientY);
    overlay.setPointerCapture(e.pointerId);
  });

  overlay.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    updateSel(e.clientX, e.clientY);
  });

  overlay.addEventListener("pointerup", (e) => {
    if (!dragging) return;
    dragging = false;
    const rect = getRect(e.clientX, e.clientY);
    if (rect.w < 20 || rect.h < 20) {
      // Too small — reset
      sel.style.display = "none";
      return;
    }
    hint.textContent = "Scanning...";
    captureAndDecode(rect);
  });

  // ── Escape to cancel ──
  function onKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") cleanup();
  }
  document.addEventListener("keydown", onKeydown);

  // ── Listen for screenshot from service worker ──
  const messageListener = (
    msg: { type: string; dataUrl?: string },
    _sender: unknown,
    sendResponse: (resp: unknown) => void,
  ) => {
    if (msg.type === "screenshot" && msg.dataUrl) {
      sendResponse({ ok: true });
      handleScreenshot(msg.dataUrl);
    }
  };
  chrome.runtime.onMessage.addListener(messageListener);

  // ── Helpers ──

  function updateSel(cx: number, cy: number) {
    const r = getRect(cx, cy);
    sel.style.left = r.x + "px";
    sel.style.top = r.y + "px";
    sel.style.width = r.w + "px";
    sel.style.height = r.h + "px";
  }

  function getRect(cx: number, cy: number) {
    const x = Math.min(startX, cx);
    const y = Math.min(startY, cy);
    const w = Math.abs(cx - startX);
    const h = Math.abs(cy - startY);
    return { x, y, w, h };
  }

  let pendingRect = { x: 0, y: 0, w: 0, h: 0 };

  function captureAndDecode(rect: { x: number; y: number; w: number; h: number }) {
    pendingRect = rect;
    chrome.runtime.sendMessage({ type: "qr-region-selected", rect });
  }

  function handleScreenshot(dataUrl: string) {
    const img = new Image();
    img.onload = () => {
      const dpr = window.devicePixelRatio || 1;
      const canvas = document.createElement("canvas");
      const sx = Math.round(pendingRect.x * dpr);
      const sy = Math.round(pendingRect.y * dpr);
      const sw = Math.round(pendingRect.w * dpr);
      const sh = Math.round(pendingRect.h * dpr);

      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

      const imageData = ctx.getImageData(0, 0, sw, sh);
      const result = jsQR(imageData.data, sw, sh);

      if (result && result.data && result.data.startsWith("otpauth://")) {
        chrome.runtime.sendMessage({ type: "qr-scanned", uri: result.data });
        showToast("✓ QR code scanned — open Ghost Auth");
        setTimeout(cleanup, 1800);
      } else if (result && result.data) {
        showToast("QR code found but does not contain a TOTP account");
        resetForRetry();
      } else {
        showToast("No QR code found — try again");
        resetForRetry();
      }
    };
    img.onerror = () => {
      showToast("Failed to process screenshot");
      resetForRetry();
    };
    img.src = dataUrl;
  }

  function showToast(msg: string) {
    toast.textContent = msg;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2500);
  }

  function resetForRetry() {
    sel.style.display = "none";
    hint.textContent = "Draw a rectangle around the QR code";
  }

  function cleanup() {
    document.removeEventListener("keydown", onKeydown);
    chrome.runtime.onMessage.removeListener(messageListener);
    overlay.remove();
    (window as any).__ghostAuthQrScanner = false;
  }
}
