import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      $core: path.resolve("./src/core"),
      $lib: path.resolve("./src/lib"),
      $shared: path.resolve("../shared"),
      "svelte-i18n": path.resolve("./node_modules/svelte-i18n"),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/core/**/*.ts"],
      exclude: ["src/test/**", "src/core/types.ts", "src/core/constants.ts"],
    },
  },
});
