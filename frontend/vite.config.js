import { defineConfig } from "vite";
import react            from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  optimizeDeps: {
    include: ["butterchurn", "butterchurn-presets"],
  },

  build: {
    assetsInlineLimit: 8_192,
    commonjsOptions: {
      include: [/butterchurn/, /butterchurn-presets/, /node_modules/],
    },
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react":       ["react", "react-dom"],
          "vendor-socketio":    ["socket.io-client"],
          "vendor-butterchurn": ["butterchurn", "butterchurn-presets"],
        },
      },
    },
  },

  server: {
    port: 5173,
    proxy: {
      "/auth": { target: "http://127.0.0.1:3001", changeOrigin: true },
      "/api":  { target: "http://127.0.0.1:3001", changeOrigin: true },
    },
  },
});
