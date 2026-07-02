"use client";
import { useState, useCallback, useEffect } from "react";
import type { SeccionFavorita, Seccion } from "../types";
import { FAV_KEY } from "../constants";

function useFavoritos() {
  const [favs, setFavs] = useState<SeccionFavorita[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(FAV_KEY);
      if (stored) setFavs(JSON.parse(stored));
    } catch { /* noop */ }
  }, []);

  const toggleFav = useCallback((seccion: Seccion) => {
    setFavs(prev => {
      const exists = prev.find(f => f.favId === seccion.uid);
      const next = exists
        ? prev.filter(f => f.favId !== seccion.uid)
        : [...prev, { ...seccion, favId: seccion.uid, savedAt: Date.now() }];
      localStorage.setItem(FAV_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const isFav = useCallback((uid: string) => favs.some(f => f.favId === uid), [favs]);

  return { favs, toggleFav, isFav };
}

export { useFavoritos };
