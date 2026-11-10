import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const localPort = Number(env.LOCAL_FRONTEND_PORT || 3000);
  return {
    plugins: [react()],
    envPrefix: "REACT_APP_",
    resolve: { alias: { "@": path.resolve(__dirname, "src") } },
    server: { host: "0.0.0.0", port: localPort, allowedHosts: true,
      hmr: { clientPort: env.LOCAL_DEV === "true" ? localPort : 443 } },
  };
});
