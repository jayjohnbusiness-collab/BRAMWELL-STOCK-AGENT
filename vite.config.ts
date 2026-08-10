import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// Bramwell is a static front-end scaffold. The agent brain (src/agent) is
// deliberately transport-agnostic so it can later be lifted behind an API.
//
// SINGLE_FILE=1 produces one self-contained index.html (JS, CSS, and fonts all
// inlined) for hosting the demo as a single page.
const single = process.env.SINGLE_FILE === "1";

export default defineConfig({
  plugins: [react(), ...(single ? [viteSingleFile()] : [])],
  build: single
    ? { assetsInlineLimit: 100_000_000, cssCodeSplit: false, target: "esnext" }
    : {},
  server: {
    port: 5173,
  },
});
