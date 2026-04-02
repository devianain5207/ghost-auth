import { defineConfig } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  plugins: [svelte()],
  resolve: {
    tsconfigPaths: true,
    conditions: ["browser"],
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts", "src/lib/**/*.svelte"],
      exclude: ["src/test/**"],
    },
  },
});
