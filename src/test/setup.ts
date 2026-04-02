import { beforeAll, vi } from "vitest";
import { waitLocale } from "svelte-i18n";
import { initI18n } from "$lib/i18n";

// Mock @tauri-apps/api/core so invoke() works in tests
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

// Mock clipboard plugin
vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({
  writeText: vi.fn(),
}));

// Mock barcode scanner plugin
vi.mock("@tauri-apps/plugin-barcode-scanner", () => ({
  scan: vi.fn(),
  Format: { QRCode: "QR_CODE" },
}));

// Mock biometric plugin
vi.mock("@tauri-apps/plugin-biometric", () => ({
  checkStatus: vi.fn().mockResolvedValue({ isAvailable: false }),
  authenticate: vi.fn(),
}));

// Mock SVG asset imports
vi.mock("$lib/assets/ghost.svg", () => ({ default: "ghost.svg" }));

if (typeof window !== "undefined" && !window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

beforeAll(async () => {
  localStorage.setItem("ghost-auth-locale", "en");
  initI18n();
  await waitLocale();
});
