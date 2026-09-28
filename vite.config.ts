import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

const root = import.meta.dirname;
const serverUrl = process.env.VITE_API_PROXY ?? "http://localhost:3000";

/** In development, serve the two app shells at the same addresses the server uses in production. */
function appShells(): Plugin {
  return {
    name: "app-shells",
    configureServer(server) {
      server.middlewares.use((request, _response, next) => {
        const path = request.url?.split("?")[0] ?? "";
        if (/^\/admin(\/|$)/.test(path)) request.url = "/app/admin.html";
        else if (/^\/portal(\/|$)/.test(path)) request.url = "/app/portal.html";
        next();
      });
    },
  };
}

export default defineConfig({
  root: "src/admin",
  base: "/app/",
  plugins: [react(), appShells()],
  build: {
    outDir: resolve(root, "dist/admin"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        admin: resolve(root, "src/admin/admin.html"),
        portal: resolve(root, "src/admin/portal.html"),
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": serverUrl,
      "/uploads": serverUrl,
      "/images": serverUrl,
      "/css": serverUrl,
    },
  },
});
