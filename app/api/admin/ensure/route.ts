import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { ADMIN_EMAIL } from "@/lib/admin";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const auth = request.headers.get("authorization") ?? "";
  if (!url || !anon) {
    return NextResponse.json({ error: "Missing Supabase config." }, { status: 500 });
  }

  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user?.email) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  if (authData.user.email.toLowerCase() !== ADMIN_EMAIL) {
    return NextResponse.json({ ok: true, role: "unchanged" });
  }

  try {
    const admin = getSupabaseAdmin();
    const meta = authData.user.user_metadata ?? {};
    const fullName = String(meta.full_name || meta.name || "").trim();
    const { error } = await admin.from("profiles").upsert({
      id: authData.user.id,
      email: authData.user.email,
      full_name: fullName,
      role: "admin",
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, role: "admin" });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
