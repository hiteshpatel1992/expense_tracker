import type { User } from "@supabase/supabase-js";

export function userName(user: User): string {
  const meta = user.user_metadata ?? {};
  return String(meta.full_name || meta.name || "").trim();
}
