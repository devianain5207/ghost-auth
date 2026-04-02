import { tick } from "svelte";
import { scan, cancel, Format, checkPermissions, requestPermissions, openAppSettings } from "@tauri-apps/plugin-barcode-scanner";
import { decodeQrFromImageFile } from "$lib/utils/qrImage";
import { getErrorMessage, isCancelLikeError } from "$lib/utils/error";

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => resolve());
      return;
    }
    setTimeout(resolve, 0);
  });
}

export interface ScannerOptions {
  /** Called with the raw scanned/decoded string. Consumer validates and handles. */
  onContent: (content: string) => Promise<void>;
  /** Set the component's error message. */
  setError: (msg: string) => void;
  /** Set the component's permissionDenied flag. */
  setPermissionDenied: (denied: boolean) => void;
  /** Translate an i18n key (pass `$_` from the component). */
  t: (key: string) => string;
  /** Called when native scan starts (for overlay tracking). */
  onscanstart?: () => void;
  /** Called when native scan ends (for overlay tracking). */
  onscanend?: () => void;
}

export class Scanner {
  scanning = $state(false);
  imageProcessing = $state(false);
  scanHint = $state(false);
  showWebScanner = $state(false);

  /** Bind the hidden file input for QR image uploads. */
  qrImageInput: HTMLInputElement | undefined;

  #scanHintTimer: ReturnType<typeof setTimeout> | null = null;
  #scanCancelReject: ((reason: Error) => void) | null = null;
  #suppressNextScanError = false;
  #opts: ScannerOptions;

  constructor(opts: ScannerOptions) {
    this.#opts = opts;
  }

  async scanQr() {
    this.#opts.setError("");
    this.#opts.setPermissionDenied(false);
    let scanStarted = false;
    try {
      const granted = await this.#ensureCameraPermission();
      if (!granted) return;

      this.scanning = true;
      this.scanHint = false;
      scanStarted = true;
      document.documentElement.classList.add('scanning');
      this.#opts.onscanstart?.();
      this.#scanHintTimer = setTimeout(() => { this.scanHint = true; }, 8000);

      const scanPromise = scan({ windowed: true, formats: [Format.QRCode] });
      const cancelPromise = new Promise<never>((_, reject) => {
        this.#scanCancelReject = reject;
      });
      const result = await Promise.race([scanPromise, cancelPromise]);

      if (!result.content) {
        this.#opts.setError(this.#opts.t('scanner.noQrDetected'));
        return;
      }

      await this.#opts.onContent(result.content);
    } catch (e: unknown) {
      const raw = getErrorMessage(e);
      const msg = raw.toLowerCase();
      if (this.#suppressNextScanError || isCancelLikeError(e)) {
        // User cancelled — not an error
      } else if (msg.includes("permission") || msg.includes("camera")) {
        this.#opts.setError(this.#opts.t('scanner.cameraPermissionDenied'));
        this.#opts.setPermissionDenied(true);
      } else if (msg.includes("not supported") || msg.includes("not available") || msg.includes("not implemented") || msg.includes("not found")) {
        this.showWebScanner = true;
      } else {
        this.#opts.setError(raw);
      }
    } finally {
      this.#suppressNextScanError = false;
      this.#scanCancelReject = null;
      if (this.#scanHintTimer) { clearTimeout(this.#scanHintTimer); this.#scanHintTimer = null; }
      this.scanHint = false;
      if (scanStarted) {
        this.scanning = false;
        document.documentElement.classList.remove('scanning');
        this.#opts.onscanend?.();
      }
    }
  }

  async cancelScan() {
    try { await cancel(); } catch { /* silent */ }
    this.#scanCancelReject?.(new Error("cancelled"));
    this.#scanCancelReject = null;
  }

  async openQrImagePicker() {
    if (this.scanning) {
      this.#suppressNextScanError = true;
      this.#opts.setError("");
      await this.cancelScan();
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
    this.qrImageInput?.click();
  }

  async handleQrImageSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;

    this.#opts.setError("");
    this.#opts.setPermissionDenied(false);
    this.imageProcessing = true;

    try {
      if (this.scanning) {
        this.#suppressNextScanError = true;
        await this.cancelScan();
      }
      await tick();
      await nextFrame();
      const content = await decodeQrFromImageFile(file);
      if (!content) {
        this.#opts.setError(this.#opts.t('scanner.noQrDetected'));
        return;
      }
      await this.#opts.onContent(content);
    } catch (e) {
      this.#opts.setError(getErrorMessage(e));
    } finally {
      this.imageProcessing = false;
    }
  }

  async handleWebScanResult(content: string) {
    this.showWebScanner = false;
    this.#opts.setError("");
    await this.#opts.onContent(content);
  }

  async handleOpenSettings() {
    try {
      await openAppSettings();
    } catch {
      // silent
    }
  }

  async #ensureCameraPermission(): Promise<boolean> {
    try {
      let state = await checkPermissions();
      if (state === "granted") return true;
      state = await requestPermissions();
      if (state === "granted") return true;
      this.#opts.setError(this.#opts.t('scanner.cameraPermissionDenied'));
      this.#opts.setPermissionDenied(true);
      return false;
    } catch {
      return true;
    }
  }
}
