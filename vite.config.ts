/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { nitro } from "nitro/vite";
import { solidStart } from "@solidjs/start/config";
import { somStyle } from "som-style/vite";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [
    somStyle(),
    // devOverlay: 개발 툴바가 @jridgewell 모듈 로딩 오류를 내므로 끈다 (기능과 무관).
    solidStart({ middleware: "src/middleware.ts", devOverlay: false }),
    nitro(),
  ],
  resolve: {
    alias: {
      "@shared": here("./src/shared"),
      "@modules": here("./src/modules"),
      "@style": here("./som-style"),
    },
  },
  server: { host: "0.0.0.0", port: 3000 },
  optimizeDeps: {
    // 개발 툴바가 쓰는 CJS 패키지. 미리 번들하지 않으면 브라우저에서 default export 오류가 난다.
    include: ["@jridgewell/trace-mapping", "@jridgewell/remapping", "@jridgewell/gen-mapping"],
  },
  ssr: {
    // 네이티브/Node 전용 패키지는 서버 번들에 넣지 않고 그대로 require 한다.
    external: ["pdfkit", "unpdf", "@google/genai", "qrcode"],
  },
});
