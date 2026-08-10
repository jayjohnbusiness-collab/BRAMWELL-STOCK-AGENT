import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Bramwell is a static front-end scaffold. The agent brain (src/agent) is
// deliberately transport-agnostic so it can later be lifted behind an API.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
});
