import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { copyFileSync, mkdirSync } from "fs";
import { resolve } from "path";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [
    svelte(),
    tailwindcss(),
    {
      name: "copy-zxing-wasm",
      writeBundle(options) {
        const outDir = options.dir || "dist";
        mkdirSync(outDir, { recursive: true });
        copyFileSync(
          resolve("node_modules/zxing-wasm/dist/reader/zxing_reader.wasm"),
          resolve(outDir, "zxing_reader.wasm"),
        );
      },
    },
  ],
  clearScreen: false,
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
  },
});
