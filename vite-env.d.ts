/// <reference types="vite/client" />
/// <reference types="@crxjs/vite-plugin" />

declare module '*.json' {
  const value: unknown;
  export default value;
}

declare module 'pdfjs-dist/build/pdf.mjs' {
  export * from 'pdfjs-dist';
}
