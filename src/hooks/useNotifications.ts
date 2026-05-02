import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

export function useNotifications(userId: string) {
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`notifications-${userId}`)
      
      // ✅ ADD LISTENERS FIRST
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log("Realtime notification:", payload);
          // TODO: update state here
        }
      )

      // ✅ THEN SUBSCRIBE (LAST STEP)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);
}
