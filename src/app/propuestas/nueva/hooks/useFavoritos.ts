"use client";
import { useState, useCallback, useEffect, useTransition } from "react";
import type { SeccionFavorita, Seccion } from "../types";
import { getFavoritos, toggleFavoritoAction } from "@/actions/propuestas_favoritos";

function useFavoritos() {
  const [favs, setFavs] = useState<SeccionFavorita[]>([]);
  const [, startTransition] = useTransition();

  useEffect(() => {
    getFavoritos().then(setFavs);
  }, []);

  const toggleFav = useCallback((seccion: Seccion) => {
    // Optimistic update
    setFavs(prev => {
      const exists = prev.find(f => f.favId === seccion.uid);
      return exists
        ? prev.filter(f => f.favId !== seccion.uid)
        : [...prev, { ...seccion, favId: seccion.uid, savedAt: Date.now() }];
    });

    startTransition(async () => {
      const { favs: updated } = await toggleFavoritoAction(seccion);
      setFavs(updated);
    });
  }, []);

  const isFav = useCallback((uid: string) => favs.some(f => f.favId === uid), [favs]);

  return { favs, toggleFav, isFav };
}

export { useFavoritos };
