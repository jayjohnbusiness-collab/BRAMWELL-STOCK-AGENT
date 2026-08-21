/*
 * Deployment configuration.
 *
 * UNDERSTAND_PROXY — the URL of your deployed "understanding" proxy (see
 * /proxy). Set it to turn on MANAGED AI understanding for every user: the
 * proxy holds one Anthropic key server-side, so no one needs their own. Leave
 * it empty to keep the bring-your-own-key mode (each user adds their own key in
 * Account). Can also be provided at build time via VITE_UNDERSTAND_PROXY
 * without editing this file.
 */
export const UNDERSTAND_PROXY = (import.meta.env.VITE_UNDERSTAND_PROXY ?? "").trim();
