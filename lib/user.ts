import type { User } from "@supabase/supabase-js";
import { isAdminEmail } from "./admin";
import type { Profile } from "./types";

export function userName(user: User, profile?: Profile | null): string {
  if (profile?.full_name?.trim()) return profile.full_name.trim();
  const meta = user.user_metadata ?? {};
  return String(meta.full_name || meta.name || "").trim();
}

export function isAdmin(profile?: Profile | null, user?: User | null): boolean {
  if (profile?.role === "admin") return true;
  return isAdminEmail(profile?.email ?? user?.email);
}

export function displayName(
  userId: string | null,
  profiles: Map<string, Profile>,
): string {
  if (!userId) return "Unknown";
  const profile = profiles.get(userId);
  return profile?.full_name?.trim() || profile?.email || "Unknown";
}
