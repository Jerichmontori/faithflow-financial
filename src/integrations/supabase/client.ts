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
      return insforge.auth.signOut();
    },

    async getUser() {
      const res = await insforge.auth.getCurrentUser();
      return {
        data: { user: res.data?.user ?? null },
        error: res.error,
      };
    },

    async getSession() {
      const res = await insforge.auth.getCurrentUser();
      const user = res.data?.user ?? null;
      const accessToken =
        typeof (insforge as any).tokenManager?.getAccessToken === "function"
          ? (insforge as any).tokenManager.getAccessToken()
          : null;
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
