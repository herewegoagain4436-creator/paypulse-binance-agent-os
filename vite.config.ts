import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { paypulseApiPlugin } from "./src/server/vitePlugin";

export default defineConfig({
  plugins: [react(), paypulseApiPlugin()],
  root: ".",
  publicDir: "public",
  server: { port: 5174, host: true },
  build: { outDir: "dist", sourcemap: true },
});
