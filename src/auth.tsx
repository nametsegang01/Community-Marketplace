import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import {
  getUserProfile,
  watchAuthState,
  watchUserProfile,
  type UserProfile,
} from "./firebase";

type AuthState = {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string;
  reloadProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadProfile = useCallback(async (currentUser: User) => {
    setLoading(true);
    setError("");
    try {
      const currentProfile = await getUserProfile(currentUser.uid);
      setProfile(currentProfile);
    } catch (reason) {
      setProfile(null);
      setError(reason instanceof Error ? reason.message : "Could not load your account profile.");
    } finally {
      setLoading(false);
    }
  }, []);

  const reloadProfile = useCallback(async () => {
    if (user) await loadProfile(user);
  }, [loadProfile, user]);

  useEffect(() => {
    let stopProfile: (() => void) | null = null;
    const stopAuth = watchAuthState((currentUser) => {
      stopProfile?.();
      stopProfile = null;
      setUser(currentUser);
      if (currentUser) {
        setLoading(true);
        setError("");
        stopProfile = watchUserProfile(currentUser.uid, (currentProfile) => {
          setProfile(currentProfile);
          setLoading(false);
        }, (reason) => {
          setProfile(null);
          setError(reason.message);
          setLoading(false);
        });
      } else {
        setProfile(null);
        setError("");
        setLoading(false);
      }
    }, (reason) => {
      stopProfile?.();
      stopProfile = null;
      setUser(null);
      setProfile(null);
      setError(reason.message);
      setLoading(false);
    });
    return () => {
      stopProfile?.();
      stopAuth();
    };
  }, []);

  const value = useMemo(() => ({ user, profile, loading, error, reloadProfile }), [user, profile, loading, error, reloadProfile]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider.");
  return context;
}
