import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    env: loadEnv("test", process.cwd(), ""),
    // The integration tests share one database, so files run one after another.
    fileParallelism: false,
    testTimeout: 20000,
  },
});
