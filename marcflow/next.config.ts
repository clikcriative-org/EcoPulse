import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Loaded from node_modules at runtime instead of bundled: audio-decode (voice note waveform for Baileys)
  // pulls in a web-worker shim with a dynamic import that Turbopack can't resolve.
  serverExternalPackages: ["sharp", "bcryptjs", "@whiskeysockets/baileys", "audio-decode"],
  // Media and voice notes go through server actions; default limit is 1 MB
  experimental: {
    serverActions: { bodySizeLimit: "16mb" },
  },
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
