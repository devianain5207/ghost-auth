import { describe, expect, it, beforeAll } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, extname, basename } from "node:path";
import QRCode from "qrcode";
import { PNG } from "pngjs";
import * as jpeg from "jpeg-js";
import { prepareZXingModule } from "zxing-wasm/reader";
import { __qrImageTestUtils } from "./qrImage";

// Load WASM binary for Node.js test environment
beforeAll(() => {
  const wasmPath = join(process.cwd(), "node_modules/zxing-wasm/dist/reader/zxing_reader.wasm");
  prepareZXingModule({
    overrides: {
      wasmBinary: readFileSync(wasmPath).buffer as ArrayBuffer,
    },
  });
});

type RenderOptions = {
  left: number;
  top: number;
  size: number;
};

function createPhotoLikePixels(width: number, height: number): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(width * height * 4);
  let seed = 0x9e3779b9;

  const nextNoise = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) / 0xffffffff;
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const gradient = 218 + Math.round((x / width) * 16 - (y / height) * 12);
      const noise = Math.round((nextNoise() - 0.5) * 18);
      const value = Math.max(150, Math.min(255, gradient + noise));
      pixels[index] = value;
      pixels[index + 1] = value;
      pixels[index + 2] = value;
      pixels[index + 3] = 255;
    }
  }

  return pixels;
}

function drawQrCode(pixels: Uint8ClampedArray, width: number, height: number, payload: string, opts: RenderOptions) {
  const qr = QRCode.create(payload, { errorCorrectionLevel: "M" });
  const quietModules = 4;
  const moduleCount = qr.modules.size;
  const totalModules = moduleCount + quietModules * 2;
  const modulePixels = Math.max(1, Math.floor(opts.size / totalModules));

  for (let moduleY = 0; moduleY < totalModules; moduleY += 1) {
    for (let moduleX = 0; moduleX < totalModules; moduleX += 1) {
      const qrX = moduleX - quietModules;
      const qrY = moduleY - quietModules;
      const isDark =
        qrX >= 0 &&
        qrY >= 0 &&
        qrX < moduleCount &&
        qrY < moduleCount &&
        qr.modules.get(qrX, qrY) === 1;

      if (!isDark) continue;

      const startX = opts.left + moduleX * modulePixels;
      const startY = opts.top + moduleY * modulePixels;

      for (let py = 0; py < modulePixels; py += 1) {
        const y = startY + py;
        if (y < 0 || y >= height) continue;
        for (let px = 0; px < modulePixels; px += 1) {
          const x = startX + px;
          if (x < 0 || x >= width) continue;
          const index = (y * width + x) * 4;
          pixels[index] = 0;
          pixels[index + 1] = 0;
          pixels[index + 2] = 0;
          pixels[index + 3] = 255;
        }
      }
    }
  }
}

function makeImageData(pixels: Uint8ClampedArray, width: number, height: number): ImageData {
  return { data: pixels, width, height, colorSpace: "srgb" } as ImageData;
}

describe("getCenterCrops", () => {
  it("returns 3 progressively tighter crops", () => {
    const crops = __qrImageTestUtils.getCenterCrops(2400, 1080);
    expect(crops).toHaveLength(3);
    // 70% crop
    expect(crops[0]).toEqual({ x: 360, y: 162, w: 1680, h: 756 });
    // 50% crop
    expect(crops[1]).toEqual({ x: 600, y: 270, w: 1200, h: 540 });
    // 35% crop
    expect(crops[2]).toEqual({ x: 780, y: 351, w: 840, h: 378 });
  });

  it("returns empty for invalid dimensions", () => {
    expect(__qrImageTestUtils.getCenterCrops(0, 100)).toEqual([]);
    expect(__qrImageTestUtils.getCenterCrops(-1, 100)).toEqual([]);
    expect(__qrImageTestUtils.getCenterCrops(NaN, 100)).toEqual([]);
  });

  it("deduplicates identical crops for small images", () => {
    const crops = __qrImageTestUtils.getCenterCrops(2, 2);
    // At this size, some fractions round to the same result
    const keys = crops.map((c) => `${c.x},${c.y},${c.w},${c.h}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("qrImage zxing-wasm decoder", () => {
  it("decodes a QR code near the bottom-right edge of a photo", async () => {
    const payload = "otpauth://totp/Test:edge?secret=JBSWY3DPEHPK3PXP&issuer=Test";
    const width = 1500;
    const height = 1000;
    const pixels = createPhotoLikePixels(width, height);

    drawQrCode(pixels, width, height, payload, {
      left: width - 240,
      top: height - 240,
      size: 210,
    });

    const decoded = await __qrImageTestUtils.decodeWithZxing(makeImageData(pixels, width, height));
    expect(decoded).toBe(payload);
  });

  it("decodes a small off-center QR code in a large photo", async () => {
    const payload = "otpauth://totp/Test:small?secret=JBSWY3DPEHPK3PXP&issuer=Test";
    const width = 1800;
    const height = 1200;
    const pixels = createPhotoLikePixels(width, height);

    drawQrCode(pixels, width, height, payload, {
      left: 28,
      top: 56,
      size: 118,
    });

    const decoded = await __qrImageTestUtils.decodeWithZxing(makeImageData(pixels, width, height));
    expect(decoded).toBe(payload);
  });

  it("decodes a centered QR code", async () => {
    const payload = "otpauth://totp/GitHub:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=GitHub";
    const width = 1200;
    const height = 1200;
    const pixels = createPhotoLikePixels(width, height);

    drawQrCode(pixels, width, height, payload, {
      left: 250,
      top: 250,
      size: 300,
    });

    const decoded = await __qrImageTestUtils.decodeWithZxing(makeImageData(pixels, width, height));
    expect(decoded).toBe(payload);
  });

  it("decodes a QR code from a screenshot-like image (30% of frame, slightly above center)", async () => {
    // Simulates a Google Authenticator export screenshot:
    // Phone-sized image, QR code ~30% of the frame, centered slightly above middle
    const payload = "otpauth-migration://offline?data=CjEKCkhlbGxvV29ybGQSEnRlc3RAZXhhbXBsZS5jb20aBFRlc3QgASgBMAI4Ag";
    const width = 1170;  // iPhone-like width
    const height = 2532; // iPhone-like height
    const qrSize = Math.round(width * 0.7); // QR is ~70% of width, ~30% of total area
    const qrLeft = Math.round((width - qrSize) / 2);
    const qrTop = Math.round(height * 0.3); // Slightly above center

    const pixels = createPhotoLikePixels(width, height);
    drawQrCode(pixels, width, height, payload, {
      left: qrLeft,
      top: qrTop,
      size: qrSize,
    });

    const decoded = await __qrImageTestUtils.decodeWithZxing(makeImageData(pixels, width, height));
    expect(decoded).toBe(payload);
  });

  it("decodes a QR code from a center-cropped region of a screenshot", async () => {
    // Simulates what the center-crop strategy produces: crop a screenshot and the
    // QR code becomes a larger proportion of the cropped frame, aiding detection.
    const payload = "otpauth://totp/Google:test@gmail.com?secret=JBSWY3DPEHPK3PXP&issuer=Google";
    const fullWidth = 1080;
    const fullHeight = 2400;
    const qrSize = Math.round(fullWidth * 0.35); // ~35% of width
    const qrLeft = Math.round((fullWidth - qrSize) / 2);
    const qrTop = Math.round(fullHeight * 0.35); // slightly above center

    // Build full image with QR code
    const fullPixels = createPhotoLikePixels(fullWidth, fullHeight);
    drawQrCode(fullPixels, fullWidth, fullHeight, payload, {
      left: qrLeft,
      top: qrTop,
      size: qrSize,
    });

    // Extract a 50% center crop (same as getCenterCrops would produce)
    const cropW = Math.round(fullWidth * 0.5);
    const cropH = Math.round(fullHeight * 0.5);
    const cropX = Math.round((fullWidth - cropW) / 2);
    const cropY = Math.round((fullHeight - cropH) / 2);

    const cropPixels = new Uint8ClampedArray(cropW * cropH * 4);
    for (let y = 0; y < cropH; y++) {
      const srcOffset = ((cropY + y) * fullWidth + cropX) * 4;
      const dstOffset = y * cropW * 4;
      cropPixels.set(fullPixels.subarray(srcOffset, srcOffset + cropW * 4), dstOffset);
    }

    const decoded = await __qrImageTestUtils.decodeWithZxing(makeImageData(cropPixels, cropW, cropH));
    expect(decoded).toBe(payload);
  });

  it("decodes a QR code with a long URI", async () => {
    const payload = "otpauth://totp/VeryLongIssuerName:verylongusername@example.com?secret=JBSWY3DPEHPK3PXP&issuer=VeryLongIssuerName&algorithm=SHA256&digits=8&period=60";
    const width = 1000;
    const height = 1000;
    const pixels = createPhotoLikePixels(width, height);

    drawQrCode(pixels, width, height, payload, {
      left: 200,
      top: 200,
      size: 600,
    });

    const decoded = await __qrImageTestUtils.decodeWithZxing(makeImageData(pixels, width, height));
    expect(decoded).toBe(payload);
  });
});

// ---------------------------------------------------------------------------
// Fixture-driven tests: drop real QR images in test-fixtures/qr-images/
// alongside a .expected.txt with the expected decoded content.
// ---------------------------------------------------------------------------
const FIXTURES_DIR = join(process.cwd(), "test-fixtures/qr-images");

function loadFixtures(): Array<{ name: string; imageFile: string; expected: string }> {
  if (!existsSync(FIXTURES_DIR)) return [];
  const files = readdirSync(FIXTURES_DIR);
  const imageExts = new Set([".png", ".jpg", ".jpeg"]);
  const fixtures: Array<{ name: string; imageFile: string; expected: string }> = [];

  for (const file of files) {
    const ext = extname(file).toLowerCase();
    if (!imageExts.has(ext)) continue;
    const base = basename(file, ext);
    const expectedFile = join(FIXTURES_DIR, `${base}.expected.txt`);
    if (!existsSync(expectedFile)) continue;
    const expected = readFileSync(expectedFile, "utf-8").trim();
    if (!expected) continue;
    fixtures.push({ name: base, imageFile: join(FIXTURES_DIR, file), expected });
  }
  return fixtures;
}

function decodeImage(filePath: string): ImageData {
  const buf = readFileSync(filePath);
  // Detect format by magic bytes, not extension
  const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  if (isPng) {
    const png = PNG.sync.read(buf);
    return {
      data: new Uint8ClampedArray(png.data.buffer, png.data.byteOffset, png.data.byteLength),
      width: png.width,
      height: png.height,
      colorSpace: "srgb",
    } as ImageData;
  }
  // Assume JPEG otherwise
  const img = jpeg.decode(buf, { useTArray: true, formatAsRGBA: true });
  return {
    data: new Uint8ClampedArray(img.data.buffer, img.data.byteOffset, img.data.byteLength),
    width: img.width,
    height: img.height,
    colorSpace: "srgb",
  } as ImageData;
}

const fixtures = loadFixtures();

describe.runIf(fixtures.length > 0)("qrImage real-image fixtures", () => {
  for (const fixture of fixtures) {
    it(`decodes ${fixture.name}`, async () => {
      const imageData = decodeImage(fixture.imageFile);

      // Try full image first (Pass 1 behavior)
      let decoded = await __qrImageTestUtils.decodeWithZxing(imageData);

      // If full image fails, try center crops (Pass 2 behavior)
      if (!decoded) {
        const crops = __qrImageTestUtils.getCenterCrops(imageData.width, imageData.height);
        for (const crop of crops) {
          const cropped = new Uint8ClampedArray(crop.w * crop.h * 4);
          for (let y = 0; y < crop.h; y++) {
            const srcOffset = ((crop.y + y) * imageData.width + crop.x) * 4;
            const dstOffset = y * crop.w * 4;
            cropped.set(imageData.data.subarray(srcOffset, srcOffset + crop.w * 4), dstOffset);
          }
          decoded = await __qrImageTestUtils.decodeWithZxing(
            makeImageData(cropped, crop.w, crop.h),
          );
          if (decoded) break;
        }
      }

      expect(decoded).toBe(fixture.expected);
    });
  }
});
