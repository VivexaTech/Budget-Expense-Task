import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/services/firebase';
import { UserProfile, UserRole } from '@/types';
import {
  fetchUserProfile,
  loginWithEmail,
  logout as authLogout,
} from '@/services/authService';
import { registerForPushNotificationsAsync } from '@/services/notificationService';
import { getCurrentMonthKey } from '@/utils/formatters';

interface AuthContextType {
  user: UserProfile | null;
  firebaseUser: User | null;
  role: UserRole | null;
  isAdmin: boolean;
  isEmployee: boolean;
  isLoading: boolean;
  selectedMonthKey: string;
  setSelectedMonthKey: (monthKey: string) => void;
  login: (email: string, password: string) => Promise<UserProfile>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(getCurrentMonthKey());

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        try {
          const profile = await fetchUserProfile(fbUser.uid);
          setUser(profile);
          // Register push notifications (silently handles Expo Go vs native builds)
          registerForPushNotificationsAsync(fbUser.uid).catch(() => {});
        } catch (err) {
          console.error('[AuthContext] Error loading user profile:', err);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, pass: string): Promise<UserProfile> => {
    setIsLoading(true);
    try {
      const profile = await loginWithEmail(email, pass);
      setUser(profile);
      return profile;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await authLogout();
      setUser(null);
      setFirebaseUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshProfile = async (): Promise<void> => {
    if (firebaseUser) {
      const p = await fetchUserProfile(firebaseUser.uid);
      setUser(p);
    }
  };

  const role = user?.role || null;
  const isAdmin = role === 'admin';
  const isEmployee = role === 'employee';

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        role,
        isAdmin,
        isEmployee,
        isLoading,
        selectedMonthKey,
        setSelectedMonthKey,
        login,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
