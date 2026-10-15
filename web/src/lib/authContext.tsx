import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserProfile, CompanyProfile } from '../types';

interface AuthContextType {
  user: UserProfile | null;
  company: CompanyProfile | null;
  companyId: string;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  registerCompany: (payload: {
    companyName: string;
    adminName: string;
    adminEmail: string;
    password: string;
    phone?: string;
    gstin?: string;
  }) => Promise<any>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  company: null,
  companyId: 'company_vivexa',
  loading: true,
  login: async () => {},
  registerCompany: async () => {},
  logout: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
      if (fbUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', fbUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data() as UserProfile;
            setUser(userData);

            const cId = userData.companyId || 'company_vivexa';
            const companyDoc = await getDoc(doc(db, 'companies', cId));
            if (companyDoc.exists()) {
              setCompany(companyDoc.data() as CompanyProfile);
            }
          }
        } catch (err) {
          console.error('[AuthContext] Error loading user profile:', err);
        }
      } else {
        setUser(null);
        setCompany(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const registerCompany = async (payload: {
    companyName: string;
    adminName: string;
    adminEmail: string;
    password: string;
    phone?: string;
    gstin?: string;
  }) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
    const endpoint = `${apiUrl}/api/register-company`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to register company workspace.');
    }
    // Automatically log in with new credentials
    await signInWithEmailAndPassword(auth, payload.adminEmail, payload.password);
    return data;
  };

  const logout = async () => {
    await signOut(auth);
  };

  const companyId = user?.companyId || 'company_vivexa';

  return (
    <AuthContext.Provider
      value={{
        user,
        company,
        companyId,
        loading,
        login,
        registerCompany,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
