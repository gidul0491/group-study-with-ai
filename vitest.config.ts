import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/** 단위 테스트 전용 설정. SolidStart 플러그인 없이 별칭만 맞춘다. */
export default defineConfig({
  resolve: {
    alias: {
      "@shared": here("./src/shared"),
      "@modules": here("./src/modules"),
      "@style": here("./som-style"),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
