import { insforge } from "@/integrations/insforge/client";

export { insforge };

export const supabase = {
  from(table: string) {
    const postgrest = insforge.database.from(table);
    return new Proxy(postgrest, {
      get(target, prop, receiver) {
        if (prop === "insert") {
          return (values: any, options?: any) => {
            const normalized = Array.isArray(values) ? values : [values];
            return (target as any).insert(normalized, options);
          };
        }
        const val = Reflect.get(target, prop, receiver);
        return typeof val === "function" ? val.bind(target) : val;
      },
    });
  },

  rpc(fnName: string, args?: Record<string, any>) {
    return insforge.database.rpc(fnName, args);
  },

  auth: {
    async signInWithPassword(credentials: { email: string; password: string }) {
      const res = await insforge.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });
      if (res.data?.accessToken) {
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("insforge_auth_token", res.data.accessToken);
          } catch {}
        }
        insforge.setAccessToken(res.data.accessToken);
      }
      return {
        data: res.data
          ? {
              user: res.data.user,
              session: {
                user: res.data.user,
                access_token: res.data.accessToken,
              },
            }
          : { user: null, session: null },
        error: res.error,
      };
    },

    async signUp(credentials: {
      email: string;
      password: string;
      options?: {
        data?: { full_name?: string; name?: string; [key: string]: any };
        emailRedirectTo?: string;
      };
    }) {
      const res = await insforge.auth.signUp({
        email: credentials.email,
        password: credentials.password,
        name: credentials.options?.data?.full_name || credentials.options?.data?.name,
      });
      if ((res.data as any)?.accessToken) {
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("insforge_auth_token", (res.data as any).accessToken);
          } catch {}
        }
        insforge.setAccessToken((res.data as any).accessToken);
      }
      return {
        data: res.data
          ? {
              user: res.data.user,
              session: (res.data as any).accessToken
                ? {
                    user: res.data.user,
                    access_token: (res.data as any).accessToken,
                  }
                : null,
            }
          : { user: null, session: null },
        error: res.error,
      };
    },

    async signOut() {
      if (typeof window !== "undefined") {
        try {
          localStorage.removeItem("insforge_auth_token");
        } catch {}
      }
      insforge.setAccessToken(undefined as any);
      return insforge.auth.signOut();
    },

    async getUser() {
      if (typeof window !== "undefined") {
        const storedToken = localStorage.getItem("insforge_auth_token");
        if (storedToken) {
          insforge.setAccessToken(storedToken);
        }
      }
      const res = await insforge.auth.getCurrentUser();
      return {
        data: { user: res.data?.user ?? null },
        error: res.error,
      };
    },

    async getSession() {
      if (typeof window !== "undefined") {
        const storedToken = localStorage.getItem("insforge_auth_token");
        if (storedToken) {
          insforge.setAccessToken(storedToken);
        }
      }
      const res = await insforge.auth.getCurrentUser();
      const user = res.data?.user ?? null;
      const accessToken =
        (typeof window !== "undefined" ? localStorage.getItem("insforge_auth_token") : null) ||
        (typeof (insforge as any).tokenManager?.getAccessToken === "function"
          ? (insforge as any).tokenManager.getAccessToken()
          : null);
      return {
        data: {
          session: user
            ? {
                user,
                access_token: accessToken || "",
              }
            : null,
        },
        error: res.error,
      };
    },

    async setSession(tokens: { access_token?: string; refresh_token?: string }) {
      if (tokens.access_token) {
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("insforge_auth_token", tokens.access_token);
          } catch {}
        }
        insforge.setAccessToken(tokens.access_token);
      }
      return { data: { session: null }, error: null };
    },

    onAuthStateChange(callback: (event: string, session: any) => void) {
      const unsubscribe = insforge.auth.onAuthStateChange(async (event) => {
        const { data } = await insforge.auth.getCurrentUser();
        const user = data?.user ?? null;
        callback(event, user ? { user } : null);
      });
      return {
        data: {
          subscription: {
            unsubscribe,
          },
        },
      };
    },
  },
};
