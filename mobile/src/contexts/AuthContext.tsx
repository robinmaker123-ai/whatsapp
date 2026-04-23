import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";

import { clearSession, loadSession, saveSession } from "../services/authStorage";
import { fetchProfile, pingServer, refreshSessionRequest } from "../services/api";
import { socketService } from "../services/socketService";
import type { AuthSession, ThemePreference, User } from "../types/models";

type AuthContextValue = {
  session: AuthSession | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  serverReachable: boolean;
  lastConnectionCheckAt: string | null;
  appMode: "loading" | "login" | "home";
  themePreference: ThemePreference;
  signIn: (nextSession: AuthSession) => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: (user: User) => void;
  refreshConnection: (sessionToValidate?: AuthSession | null) => Promise<boolean>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const isAuthError = (error: unknown) => {
  const status = (error as { response?: { status?: number } } | null)?.response
    ?.status;

  return status === 401 || status === 403;
};

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [serverReachable, setServerReachable] = useState(false);
  const [lastConnectionCheckAt, setLastConnectionCheckAt] = useState<string | null>(null);
  const sessionRef = useRef<AuthSession | null>(null);
  const serverReachableRef = useRef(false);
  const refreshInFlightRef = useRef(false);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    serverReachableRef.current = serverReachable;
  }, [serverReachable]);

  const refreshConnection = useCallback(
    async (sessionToValidate: AuthSession | null = sessionRef.current) => {
      if (refreshInFlightRef.current) {
        return serverReachableRef.current;
      }

      refreshInFlightRef.current = true;

      try {
        const reachable = await pingServer();
        setServerReachable(reachable);
        setLastConnectionCheckAt(new Date().toISOString());

        if (!reachable) {
          return false;
        }

        if (sessionToValidate?.token && sessionToValidate.user?.id) {
          try {
            const validatedUser = await fetchProfile(sessionToValidate.token);
            const nextSession = {
              ...sessionToValidate,
              user: validatedUser,
            };

            sessionRef.current = nextSession;
            setSession(nextSession);
            void saveSession(nextSession);
          } catch (error) {
            if (isAuthError(error)) {
              if (sessionToValidate.refreshToken) {
                try {
                  const refreshedSession = await refreshSessionRequest(
                    sessionToValidate.refreshToken
                  );
                  const normalizedSession = {
                    ...refreshedSession,
                    token: refreshedSession.accessToken || refreshedSession.token,
                  };

                  sessionRef.current = normalizedSession;
                  setSession(normalizedSession);
                  await saveSession(normalizedSession);
                  return true;
                } catch (refreshError) {
                  sessionRef.current = null;
                  setSession(null);
                  await clearSession();
                }
              } else {
                sessionRef.current = null;
                setSession(null);
                await clearSession();
              }
            }
          }
        }

        return true;
      } finally {
        refreshInFlightRef.current = false;
      }
    },
    []
  );

  useEffect(() => {
    let isMounted = true;

    const bootstrapSession = async () => {
      const storedSession = await loadSession();

      if (storedSession?.token && storedSession.user?.id) {
        sessionRef.current = storedSession;

        if (isMounted) {
          setSession(storedSession);
        }
      }

      await refreshConnection(storedSession?.token ? storedSession : null);

      if (isMounted) {
        setIsBootstrapping(false);
      }
    };

    void bootstrapSession();

    return () => {
      isMounted = false;
    };
  }, [refreshConnection]);

  useEffect(() => {
    if (serverReachable && session?.token && session.user?.id) {
      socketService.connect(session.token, session.user.id);

      return () => {
        socketService.disconnect();
      };
    }

    socketService.disconnect();
    return undefined;
  }, [session?.token, session?.user?.id, serverReachable]);

  useEffect(() => {
    if (isBootstrapping) {
      return undefined;
    }

    const intervalId = setInterval(() => {
      void refreshConnection();
    }, 120000);

    return () => {
      clearInterval(intervalId);
    };
  }, [isBootstrapping, refreshConnection]);

  const signIn = useCallback(async (nextSession: AuthSession) => {
    const normalizedSession = {
      ...nextSession,
      token: nextSession.accessToken || nextSession.token,
    };

    sessionRef.current = normalizedSession;
    setSession(normalizedSession);
    setServerReachable(true);
    setIsBootstrapping(false);
    await saveSession(normalizedSession);
  }, []);

  const signOut = useCallback(async () => {
    sessionRef.current = null;
    setSession(null);
    socketService.disconnect();
    await clearSession();
  }, []);

  const updateUser = useCallback((user: User) => {
    setSession((currentSession) => {
      if (!currentSession) {
        return currentSession;
      }

      const nextSession = {
        ...currentSession,
        user,
      };

      sessionRef.current = nextSession;
      void saveSession(nextSession);
      return nextSession;
    });
  }, []);

  const themePreference = session?.user.themePreference || "system";
  const appMode = isBootstrapping ? "loading" : session ? "home" : "login";

  return (
    <AuthContext.Provider
      value={{
        session,
        isAuthenticated: Boolean(session),
        isBootstrapping,
        serverReachable,
        lastConnectionCheckAt,
        appMode,
        themePreference,
        signIn,
        signOut,
        updateUser,
        refreshConnection,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }

  return context;
};
