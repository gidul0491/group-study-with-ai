/// <reference types="@solidjs/start/env" />

declare module "som-style/solid" {
  export * from "som-style";
}

declare module "@style/theme.js" {
  export const theme: Record<string, string>;
}
