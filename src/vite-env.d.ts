/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Finnhub API token. When present, the app runs against the live feed. */
  readonly VITE_FINNHUB_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
