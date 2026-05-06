import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribe to any postgres change on a table and call onChange.
 * Cleans up on unmount.
 */
export function useRealtimeRefetch(table: string, onChange: () => void) {
  useEffect(() => {
    const channel = supabase
      .channel(`rt-${table}-${Math.random().toString(36).slice(2, 8)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => onChange()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table]);
}
