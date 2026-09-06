import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Lets the dev server run correctly inside a docker container
    watch: { usePolling: true },
  },
});
