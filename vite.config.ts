import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vite";
import path from "node:path";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "favicon.svg",
        "blaze_dark_icon_152x152.png",
        "blaze_dark_icon_180x180.png",
        "blaze_dark_icon_192x192.png",
        "blaze_dark_icon_512x512.png",
        "blaze_dark_icon_1024x1024.png",
      ],
      manifest: {
        id: "/",
        name: "Blaze",
        short_name: "Blaze",
        description: "Blaze nutrition intelligence app",
        theme_color: "#0d1117",
        background_color: "#0d1117",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "/blaze_dark_icon_192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/blaze_dark_icon_512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,webp,json}"],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === "document",
            handler: "NetworkFirst",
            options: {
              cacheName: "pages-cache",
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@/app": path.resolve(__dirname, "./src/app"),
      "@/features": path.resolve(__dirname, "./src/features"),
      "@/shared": path.resolve(__dirname, "./src/shared"),
    },
  },
  server: {
    port: 3000,
    open: true,
    allowedHosts: true,
  },
  build: {
    outDir: "dist",
    minify: "terser",
    sourcemap: true,
  },
});
