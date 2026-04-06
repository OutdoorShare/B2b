import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { Customer, HostInfo } from "@/lib/api";
import { api } from "@/lib/api";

interface AuthContextValue {
  customer: Customer | null;
  hostInfo: HostInfo | null;
  isHost: boolean;
  login: (c: Customer) => void;
  logout: () => void;
  setHostInfo: (info: HostInfo | null) => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  customer: null,
  hostInfo: null,
  isHost: false,
  login: () => {},
  logout: () => {},
  setHostInfo: () => {},
  loading: true,
});

const STORAGE_KEY = "os_marketplace_customer";
const HOST_STORAGE_KEY = "os_marketplace_host";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [hostInfo, setHostInfoState] = useState<HostInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const c = JSON.parse(raw) as Customer;
        setCustomer(c);
        const rawHost = localStorage.getItem(HOST_STORAGE_KEY);
        if (rawHost) {
          setHostInfoState(JSON.parse(rawHost));
        } else {
          api.host.me(c.id)
            .then(me => {
              const info: HostInfo = { hostTenantId: me.id, slug: me.slug, name: me.name };
              setHostInfoState(info);
              localStorage.setItem(HOST_STORAGE_KEY, JSON.stringify(info));
            })
            .catch(() => {});
        }
      }
    } catch {}
    setLoading(false);
  }, []);

  const login = useCallback((c: Customer) => {
    setCustomer(c);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
    api.host.me(c.id)
      .then(me => {
        const info: HostInfo = { hostTenantId: me.id, slug: me.slug, name: me.name };
        setHostInfoState(info);
        localStorage.setItem(HOST_STORAGE_KEY, JSON.stringify(info));
      })
      .catch(() => {});
  }, []);

  const logout = useCallback(() => {
    setCustomer(null);
    setHostInfoState(null);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(HOST_STORAGE_KEY);
  }, []);

  const setHostInfo = useCallback((info: HostInfo | null) => {
    setHostInfoState(info);
    if (info) {
      localStorage.setItem(HOST_STORAGE_KEY, JSON.stringify(info));
    } else {
      localStorage.removeItem(HOST_STORAGE_KEY);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ customer, hostInfo, isHost: !!hostInfo, login, logout, setHostInfo, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
