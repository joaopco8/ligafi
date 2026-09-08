"use client";

import { useEffect } from "react";
import { useCofre } from "@/lib/cofre-store";
import { useLigaFi } from "@/lib/store";

/** Rehidrata o store do localStorage depois da montagem (skipHydration). */
export function StoreHydration() {
  useEffect(() => {
    useLigaFi.persist?.rehydrate();
    useCofre.persist?.rehydrate();
  }, []);
  return null;
}
