import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // ローカル開発時: /api → バックエンドの3001番へ転送
      "/api": "http://localhost:3001",
    },
  },
});
