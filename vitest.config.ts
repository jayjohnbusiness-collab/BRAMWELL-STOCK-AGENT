import { defineConfig } from "vitest/config";

// The agent brain is pure (no DOM), so tests run in the node environment.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
