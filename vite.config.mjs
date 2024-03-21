import { loadEnv } from "vite";

const env = loadEnv("development", process.cwd());

export default {
  server: {
    proxy: {
      "/api": {
        target: env.VITE_API_URL,
        changeOrigin: true,
        rewrite: (path) => path.replace(/\/api$/, ""),
      },
    },
  },
  test: {
    environment: "jsdom",
    include: ["**/*.{test,spec}.ts"],
  },
};
