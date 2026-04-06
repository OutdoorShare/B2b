import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { Customer } from "@/lib/api";

interface AuthContextValue {
  customer: Customer | null;
  login: (c: Customer) => void;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  customer: null,
  login: () => {},
  logout: () => {},
  loading: true,
});

const STORAGE_KEY = "os_marketplace_customer";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setCustomer(JSON.parse(raw));
    } catch {}
    setLoading(false);
  }, []);

  const login = useCallback((c: Customer) => {
    setCustomer(c);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
  }, []);

  const logout = useCallback(() => {
    setCustomer(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <AuthContext.Provider value={{ customer, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
