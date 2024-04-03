import { loadEnv } from "vite";

const env = loadEnv("development", process.cwd());

export default {
  test: {
    environment: "jsdom",
    include: ["**/*.{test,spec}.ts"],
  },
};
