import { createClient } from "@insforge/sdk";

const INSFORGE_URL =
  (typeof import.meta !== "undefined" && import.meta.env["VITE_INSFORGE_URL"]) ||
  (typeof process !== "undefined" && process.env["INSFORGE_URL"]) ||
  "https://p3xb6izj.ap-southeast.insforge.app";

const INSFORGE_ANON_KEY =
  (typeof import.meta !== "undefined" && import.meta.env["VITE_INSFORGE_ANON_KEY"]) ||
  (typeof process !== "undefined" && process.env["INSFORGE_ANON_KEY"]) ||
  "ik_04d91bd8acfa41e22df2bbe955dc981a";

const getInitialToken = (): string | null => {
  if (typeof window !== "undefined") {
    try {
      return localStorage.getItem("insforge_auth_token");
    } catch {}
  }
  return null;
};

const initialToken = getInitialToken();

export const insforge = createClient({
  baseUrl: INSFORGE_URL,
  anonKey: INSFORGE_ANON_KEY,
  ...(initialToken ? { accessToken: initialToken } : {}),
});

export const anonInsforge = createClient({
  baseUrl: INSFORGE_URL,
  anonKey: INSFORGE_ANON_KEY,
});

