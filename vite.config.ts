import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, "/");

          if (
            normalizedId.includes("/node_modules/react/") ||
            normalizedId.includes("/node_modules/react-dom/") ||
            normalizedId.includes("/node_modules/react-router-dom/") ||
            normalizedId.includes("/node_modules/scheduler/")
          ) {
            return "vendor-react";
          }

          if (normalizedId.includes("/node_modules/@react-three/fiber/")) {
            return "react-three-fiber";
          }

          if (normalizedId.includes("/node_modules/three/examples/jsm/")) {
            return "three-addons";
          }

          if (normalizedId.includes("/node_modules/three/")) {
            return "three-core";
          }
        },
      },
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
});
