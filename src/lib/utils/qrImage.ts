import { readBarcodes, prepareZXingModule } from "zxing-wasm/reader";
import type { ReadResult } from "zxing-wasm/reader";
import { invoke } from "@tauri-apps/api/core";

prepareZXingModule({
  overrides: {
    locateFile: (path: string, prefix: string) => {
      if (path.endsWith(".wasm")) {
        return "/zxing_reader.wasm";
      }
      return prefix + path;
    },
  },
});

type BarcodeResultLike = { rawValue?: string };
type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<BarcodeResultLike[]>;
};
type BarcodeDetectorCtorLike = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

type DecodeSource = {
  width: number;
  height: number;
  barcodeSource: CanvasImageSource;
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void;
  close: () => void;
};

let barcodeDetectorUnavailable = false;

function isAndroidWebView(): boolean {
  if (typeof navigator === "undefined") return false;
  const userAgent = navigator.userAgent || "";
  return /Android/i.test(userAgent) && /\bwv\b/i.test(userAgent);
}

function isIOSDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const userAgent = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/i.test(userAgent)) return true;
  // iPad with desktop-class UA (iPadOS 13+)
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

function getBarcodeDetectorCtor(): BarcodeDetectorCtorLike | null {
  if (barcodeDetectorUnavailable || isAndroidWebView()) return null;
  const ctor = (globalThis as typeof globalThis & { BarcodeDetector?: BarcodeDetectorCtorLike }).BarcodeDetector;
  return typeof ctor === "function" ? ctor : null;
}

async function decodeWithBarcodeDetector(source: CanvasImageSource): Promise<string | null> {
  const BarcodeDetectorCtor = getBarcodeDetectorCtor();
  if (!BarcodeDetectorCtor) return null;

  const getRawValue = (results: BarcodeResultLike[]): string | null => {
    for (const result of results) {
      if (typeof result.rawValue === "string" && result.rawValue.length > 0) {
        return result.rawValue;
      }
    }
    return null;
  };

  try {
    const detector = new BarcodeDetectorCtor({ formats: ["qr_code"] });
    return getRawValue(await detector.detect(source));
  } catch {
    try {
      const detector = new BarcodeDetectorCtor();
      return getRawValue(await detector.detect(source));
    } catch {
      // Some Android WebView builds expose BarcodeDetector but back it with
      // optional modules that may be missing, causing noisy repeated failures.
      // Mark unavailable for this app session and rely on zxing-wasm fallback.
      barcodeDetectorUnavailable = true;
      return null;
    }
  }
}

function loadImageElementFromFile(file: File): Promise<DecodeSource> {
  return new Promise((resolve, reject) => {
    const useDataUrl = isAndroidWebView() || isIOSDevice();
    const url = useDataUrl ? "" : URL.createObjectURL(file);
    const image = new Image();
    image.decoding = "async";

    image.onload = () => {
      if (!useDataUrl) {
        URL.revokeObjectURL(url);
      }
      resolve({
        width: image.naturalWidth || image.width,
        height: image.naturalHeight || image.height,
        barcodeSource: image,
        draw: (ctx, width, height) => {
          ctx.drawImage(image, 0, 0, width, height);
        },
        close: () => {
          // noop
        },
      });
    };
    image.onerror = () => {
      if (!useDataUrl) {
        URL.revokeObjectURL(url);
      }
      reject(new Error("Failed to read selected image"));
    };

    if (useDataUrl) {
      const reader = new FileReader();
      reader.onerror = () => {
        reject(new Error("Failed to read selected image"));
      };
      reader.onload = () => {
        image.src = typeof reader.result === "string" ? reader.result : "";
      };
      reader.readAsDataURL(file);
      return;
    }

    image.src = url;
  });
}

async function loadImageBitmapFromFile(file: File): Promise<DecodeSource | null> {
  // Skip createImageBitmap on mobile WebViews — both Android and iOS have known
  // issues that can produce wrong pixel data (color space, premultiplied alpha).
  // The Image element fallback is more reliable on these platforms.
  if (isAndroidWebView() || isIOSDevice() || typeof createImageBitmap !== "function") return null;

  const toDecodeSource = (bitmap: ImageBitmap | null | undefined): DecodeSource | null => {
    if (!bitmap) return null;
    if (!Number.isFinite(bitmap.width) || !Number.isFinite(bitmap.height)) {
      try {
        bitmap.close();
      } catch {
        // noop
      }
      return null;
    }
    if (bitmap.width <= 0 || bitmap.height <= 0) {
      try {
        bitmap.close();
      } catch {
        // noop
      }
      return null;
    }

    return {
      width: bitmap.width,
      height: bitmap.height,
      barcodeSource: bitmap,
      draw: (ctx, width, height) => {
        ctx.drawImage(bitmap, 0, 0, width, height);
      },
      close: () => {
        bitmap.close();
      },
    };
  };

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
    return toDecodeSource(bitmap);
  } catch {
    try {
      const bitmap = await createImageBitmap(file);
      return toDecodeSource(bitmap);
    } catch {
      return null;
    }
  }
}

async function loadImageFromFile(file: File): Promise<DecodeSource> {
  const bitmapSource = await loadImageBitmapFromFile(file);
  if (bitmapSource) return bitmapSource;
  return loadImageElementFromFile(file);
}

function getCenterCrops(width: number, height: number): Array<{ x: number; y: number; w: number; h: number }> {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return [];
  }
  const crops: Array<{ x: number; y: number; w: number; h: number }> = [];
  const seen = new Set<string>();
  for (const fraction of [0.7, 0.5, 0.35]) {
    const w = Math.max(1, Math.round(width * fraction));
    const h = Math.max(1, Math.round(height * fraction));
    const x = Math.round((width - w) / 2);
    const y = Math.round((height - h) / 2);
    const key = `${x},${y},${w},${h}`;
    if (!seen.has(key)) {
      seen.add(key);
      crops.push({ x, y, w, h });
    }
  }
  return crops;
}

function getDecodeSizes(width: number, height: number): Array<{ width: number; height: number }> {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return [];
  }

  const maxDimensions = [1024, 1536, 2048, 3072, 4096];
  const sizes: Array<{ width: number; height: number }> = [];
  const seen = new Set<string>();

  const pushSize = (w: number, h: number) => {
    const key = `${w}x${h}`;
    if (seen.has(key)) return;
    seen.add(key);
    sizes.push({ width: w, height: h });
  };

  for (const maxDimension of maxDimensions) {
    const scale = Math.min(1, maxDimension / Math.max(width, height));
    const scaledWidth = Math.max(1, Math.round(width * scale));
    const scaledHeight = Math.max(1, Math.round(height * scale));
    pushSize(scaledWidth, scaledHeight);
  }

  return sizes;
}

function getResultText(results: ReadResult[]): string | null {
  for (const result of results) {
    if (result.isValid && result.text) return result.text;
  }
  return null;
}

async function decodeWithZxing(imageData: ImageData): Promise<string | null> {
  try {
    const results = await readBarcodes(imageData, {
      formats: ["QRCode"],
      tryHarder: true,
      tryRotate: true,
      tryInvert: true,
      tryDownscale: true,
      maxNumberOfSymbols: 1,
    });
    return getResultText(results);
  } catch {
    return null;
  }
}

export const __qrImageTestUtils = {
  decodeWithZxing,
  getCenterCrops,
};

export async function decodeQrFromImageFile(file: File): Promise<string | null> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // Pass 0: Native Rust decoder via Tauri command (image + rqrr crates).
  // Runs entirely outside the WebView — no canvas, no color space issues.
  // This is the most reliable path, especially on iOS.
  try {
    const results = await invoke<string[]>("decode_qr_from_image", {
      data: Array.from(bytes),
    });
    if (results.length > 0 && results[0].length > 0) {
      return results[0];
    }
  } catch {
    // Tauri command not available (e.g. web build) or decode error — fall through
  }

  // Pass 1: Feed raw bytes to zxing-wasm's built-in image decoder.
  try {
    const results = await readBarcodes(bytes, {
      formats: ["QRCode"],
      tryHarder: true,
      tryRotate: true,
      tryInvert: true,
      tryDownscale: true,
      maxNumberOfSymbols: 1,
    });
    const directResult = getResultText(results);
    if (directResult) return directResult;
  } catch {
    // WASM decode failed — fall through to canvas pipeline
  }

  const image = await loadImageFromFile(file);
  try {
    if (!Number.isFinite(image.width) || !Number.isFinite(image.height) || image.width <= 0 || image.height <= 0) {
      return null;
    }

    const directBarcodeResult = await decodeWithBarcodeDetector(image.barcodeSource);
    if (directBarcodeResult) {
      return directBarcodeResult;
    }

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true, colorSpace: "srgb" } as CanvasRenderingContext2DSettings);
    if (!ctx) {
      throw new Error("Failed to process selected image");
    }

    for (const size of getDecodeSizes(image.width, image.height)) {
      canvas.width = size.width;
      canvas.height = size.height;
      try {
        image.draw(ctx, size.width, size.height);
      } catch {
        continue;
      }

      const barcodeResult = await decodeWithBarcodeDetector(canvas);
      if (barcodeResult) {
        return barcodeResult;
      }

      let imageData: ImageData;
      try {
        imageData = ctx.getImageData(0, 0, size.width, size.height);
      } catch {
        continue;
      }

      const zxingResult = await decodeWithZxing(imageData);
      if (zxingResult) {
        return zxingResult;
      }
    }

    // Pass 2: Try center crops for screenshots where QR is surrounded by UI chrome.
    // Cropping increases the QR code's proportion of the frame, aiding detection.
    for (const crop of getCenterCrops(image.width, image.height)) {
      canvas.width = crop.w;
      canvas.height = crop.h;
      try {
        ctx.drawImage(image.barcodeSource, crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h);
      } catch {
        continue;
      }

      const barcodeResult = await decodeWithBarcodeDetector(canvas);
      if (barcodeResult) return barcodeResult;

      let cropImageData: ImageData;
      try {
        cropImageData = ctx.getImageData(0, 0, crop.w, crop.h);
      } catch {
        continue;
      }

      const zxingResult = await decodeWithZxing(cropImageData);
      if (zxingResult) return zxingResult;

      // Try a downscaled version of the crop for very large screenshots
      const maxDim = Math.max(crop.w, crop.h);
      if (maxDim > 1200) {
        const scale = 1024 / maxDim;
        const sw = Math.max(1, Math.round(crop.w * scale));
        const sh = Math.max(1, Math.round(crop.h * scale));
        canvas.width = sw;
        canvas.height = sh;
        try {
          ctx.drawImage(image.barcodeSource, crop.x, crop.y, crop.w, crop.h, 0, 0, sw, sh);
        } catch {
          continue;
        }
        let scaledData: ImageData;
        try {
          scaledData = ctx.getImageData(0, 0, sw, sh);
        } catch {
          continue;
        }
        const scaledResult = await decodeWithZxing(scaledData);
        if (scaledResult) return scaledResult;
      }
    }

    return null;
  } catch {
    return null;
  } finally {
    image.close();
  }
}
