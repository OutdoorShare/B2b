import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import { useAuth } from "@/context/auth";

interface FavoritesContextValue {
  favoriteIds: Set<number>;
  isFavorite: (listingId: number) => boolean;
  toggleFavorite: (listingId: number) => void;
  isLoading: boolean;
}

const FavoritesContext = createContext<FavoritesContextValue>({
  favoriteIds: new Set(),
  isFavorite: () => false,
  toggleFavorite: () => {},
  isLoading: false,
});

interface FavoritesProviderProps {
  children: ReactNode;
  onAuthOpen: () => void;
}

export function FavoritesProvider({ children, onAuthOpen }: FavoritesProviderProps) {
  const { customer } = useAuth();
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const onAuthOpenRef = useRef(onAuthOpen);
  onAuthOpenRef.current = onAuthOpen;

  useEffect(() => {
    if (!customer) {
      setFavoriteIds(new Set());
      return;
    }
    setIsLoading(true);
    fetch(`/api/marketplace/favorites?customerId=${customer.id}`)
      .then(r => r.ok ? r.json() : [])
      .then((ids: number[]) => setFavoriteIds(new Set(ids)))
      .catch(() => setFavoriteIds(new Set()))
      .finally(() => setIsLoading(false));
  }, [customer?.id]);

  const toggleFavorite = useCallback((listingId: number) => {
    if (!customer) {
      onAuthOpenRef.current();
      return;
    }
    const isFav = favoriteIds.has(listingId);
    setFavoriteIds(prev => {
      const next = new Set(prev);
      if (isFav) next.delete(listingId); else next.add(listingId);
      return next;
    });
    if (isFav) {
      fetch(`/api/marketplace/favorites/${listingId}?customerId=${customer.id}`, { method: "DELETE" })
        .catch(() => {
          setFavoriteIds(prev => { const next = new Set(prev); next.add(listingId); return next; });
        });
    } else {
      fetch(`/api/marketplace/favorites/${listingId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: customer.id }),
      }).catch(() => {
        setFavoriteIds(prev => { const next = new Set(prev); next.delete(listingId); return next; });
      });
    }
  }, [customer, favoriteIds]);

  return (
    <FavoritesContext.Provider value={{
      favoriteIds,
      isFavorite: (id) => favoriteIds.has(id),
      toggleFavorite,
      isLoading,
    }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  return useContext(FavoritesContext);
}
