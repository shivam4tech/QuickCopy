/// <reference types="vite/client" />
/// <reference types="@crxjs/vite-plugin" />

declare module '*.json' {
  const value: unknown;
  export default value;
}
