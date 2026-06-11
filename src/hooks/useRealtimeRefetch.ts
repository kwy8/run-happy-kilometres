import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface RealtimeRefetchOptions {
  filter?: string;
  debounceMs?: number;
}

/**
 * Subscribe to any postgres change on a table and call onChange.
 * Uses a ref so the callback can change without re-subscribing.
 */
export function useRealtimeRefetch(table: string, onChange: () => void, options: RealtimeRefetchOptions = {}) {
  const cbRef = useRef(onChange);
  const debounceMs = options.debounceMs ?? 0;
  const filter = options.filter;

  useEffect(() => {
    cbRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      .channel(`rt-${table}-${Math.random().toString(36).slice(2, 8)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter },
        () => {
          if (!debounceMs) {
            cbRef.current();
            return;
          }
          if (timeout) clearTimeout(timeout);
          timeout = setTimeout(() => cbRef.current(), debounceMs);
        }
      )
      .subscribe();
    return () => {
      if (timeout) clearTimeout(timeout);
      supabase.removeChannel(channel);
    };
  }, [table, filter, debounceMs]);
}
