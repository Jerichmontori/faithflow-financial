import { insforge } from "@/integrations/insforge/client";

export { insforge };

export const supabase = {
  from(table: string) {
    if (typeof window !== "undefined") {
      try {
        const storedToken = localStorage.getItem("insforge_auth_token");
        if (storedToken) {
          insforge.setAccessToken(storedToken);
        }
      } catch {}
    }
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
    if (typeof window !== "undefined") {
      try {
        const storedToken = localStorage.getItem("insforge_auth_token");
        if (storedToken) {
          insforge.setAccessToken(storedToken);
        }
      } catch {}
    }
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
            if (res.data.user) {
              localStorage.setItem("insforge_auth_user", JSON.stringify(res.data.user));
            }
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
            if (res.data?.user) {
              localStorage.setItem("insforge_auth_user", JSON.stringify(res.data.user));
            }
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
          localStorage.removeItem("insforge_auth_user");
        } catch {}
      }
      insforge.setAccessToken(undefined as any);
      return insforge.auth.signOut();
    },

    async getUser() {
      let storedUser: any = null;
      let storedToken: string | null = null;
      if (typeof window !== "undefined") {
        storedToken = localStorage.getItem("insforge_auth_token");
        const rawUser = localStorage.getItem("insforge_auth_user");
        if (rawUser) {
          try {
            storedUser = JSON.parse(rawUser);
          } catch {}
        }
        if (storedToken) {
          insforge.setAccessToken(storedToken);
        }
      }

      if (!storedToken && !storedUser) {
        return { data: { user: null }, error: null };
      }

      try {
        const res = await insforge.auth.getCurrentUser();
        if (res.data?.user) {
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem("insforge_auth_user", JSON.stringify(res.data.user));
            } catch {}
          }
          return { data: { user: res.data.user }, error: null };
        }
      } catch (err) {
        console.warn("Network notice on getUser:", err);
      }

      // Gunakan storedUser yang tersimpan di localStorage agar user tidak ter-kick out
      if (storedUser) {
        return { data: { user: storedUser }, error: null };
      }

      return { data: { user: null }, error: null };
    },

    async getSession() {
      let storedUser: any = null;
      let storedToken: string | null = null;
      if (typeof window !== "undefined") {
        storedToken = localStorage.getItem("insforge_auth_token");
        const rawUser = localStorage.getItem("insforge_auth_user");
        if (rawUser) {
          try {
            storedUser = JSON.parse(rawUser);
          } catch {}
        }
        if (storedToken) {
          insforge.setAccessToken(storedToken);
        }
      }

      try {
        const res = await insforge.auth.getCurrentUser();
        const user = res.data?.user ?? storedUser;
        if (user && res.data?.user && typeof window !== "undefined") {
          try {
            localStorage.setItem("insforge_auth_user", JSON.stringify(res.data.user));
          } catch {}
        }
        return {
          data: {
            session: user
              ? {
                  user,
                  access_token: storedToken || "",
                }
              : null,
          },
          error: res.error,
        };
      } catch {
        return {
          data: {
            session: storedUser
              ? {
                  user: storedUser,
                  access_token: storedToken || "",
                }
              : null,
          },
          error: null,
        };
      }
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
