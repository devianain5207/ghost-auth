import { defineConfig, build as viteBuild } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "fs";

const browser = process.env.BROWSER ?? "chrome";

/**
 * Build the QR scanner content script as a self-contained IIFE after the
 * main build completes.  Content scripts injected via chrome.scripting run
 * as classic scripts, so they cannot use ES module imports.
 */
function buildContentScripts() {
  return {
    name: "build-content-scripts",
    async writeBundle() {
      const outDir = resolve(__dirname, `dist/${browser}`);

      await viteBuild({
        configFile: false,
        build: {
          outDir,
          emptyOutDir: false,
          lib: {
            entry: resolve(__dirname, "src/content/qr-scanner.ts"),
            name: "ghostQrScanner",
            formats: ["iife"],
            fileName: () => "qr-scanner.js",
          },
          rollupOptions: { output: { inlineDynamicImports: true } },
          minify: true,
          sourcemap: false,
        },
        define: { "process.env.NODE_ENV": JSON.stringify("production") },
      });
    },
  };
}

function copyExtensionAssets() {
  return {
    name: "copy-extension-assets",
    writeBundle() {
      const outDir = resolve(__dirname, `dist/${browser}`);

      // Copy manifest
      const manifestSrc = resolve(__dirname, `manifest.${browser}.json`);
      if (existsSync(manifestSrc)) {
        copyFileSync(manifestSrc, resolve(outDir, "manifest.json"));
      }

      // Copy icons
      const iconsDir = resolve(__dirname, "icons");
      const outIcons = resolve(outDir, "icons");
      if (existsSync(iconsDir)) {
        mkdirSync(outIcons, { recursive: true });
        for (const file of readdirSync(iconsDir)) {
          copyFileSync(resolve(iconsDir, file), resolve(outIcons, file));
        }
      }

      // Copy theme-init.js (must run synchronously before popup renders)
      const themeInitSrc = resolve(__dirname, "src/popup/theme-init.js");
      const themeInitDest = resolve(outDir, "src/popup/theme-init.js");
      if (existsSync(themeInitSrc)) {
        copyFileSync(themeInitSrc, themeInitDest);
      }
    },
  };
}

export default defineConfig({
  plugins: [svelte(), tailwindcss(), copyExtensionAssets(), buildContentScripts()],
  resolve: {
    alias: {
      $lib: resolve(__dirname, "src/lib"),
      $core: resolve(__dirname, "src/core"),
      $shared: resolve(__dirname, "../shared"),
      $locales: resolve(__dirname, "../src/lib/i18n/locales"),
      // Pin svelte-i18n so ../shared/ resolves to the extension's copy,
      // not the root project's node_modules (dual-package hazard).
      "svelte-i18n": resolve(__dirname, "node_modules/svelte-i18n"),
    },
  },
  base: "./",
  build: {
    outDir: `dist/${browser}`,
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "src/popup/index.html"),
        "service-worker": resolve(__dirname, "src/background/service-worker.ts"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
  define: {
    __BROWSER__: JSON.stringify(browser),
  },
});
