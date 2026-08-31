import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/admin";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

function userClient(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const auth = request.headers.get("authorization") ?? "";
  if (!url || !anon) {
    throw new Error("Missing Supabase public env.");
  }
  return createClient(url, anon, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function requireAdmin(request: Request) {
  const supabase = userClient(request);
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return { error: NextResponse.json({ error: "Sign in required." }, { status: 401 }) };
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .single();
  if (profile?.role !== "admin" && !isAdminEmail(authData.user.email)) {
    return { error: NextResponse.json({ error: "Admin only." }, { status: 403 }) };
  }
  return { user: authData.user };
}

export async function GET(request: Request) {
  try {
    const gate = await requireAdmin(request);
    if ("error" in gate && gate.error) return gate.error;
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("profiles")
      .select("id, email, full_name, role, created_at")
      .order("created_at", { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({
      users: (data ?? []).map((row) => ({
        ...row,
        protected: isAdminEmail(row.email),
      })),
    });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const gate = await requireAdmin(request);
    if ("error" in gate && gate.error) return gate.error;

    const body = (await request.json()) as {
      email?: string;
      password?: string;
      full_name?: string;
    };
    const email = body.email?.trim().toLowerCase() ?? "";
    const password = body.password ?? "";
    const fullName = body.full_name?.trim() ?? "";
    if (!email || !fullName || password.length < 6) {
      return NextResponse.json(
        { error: "Name, email, and a password of at least 6 characters are required." },
        { status: 400 },
      );
    }
    if (isAdminEmail(email)) {
      return NextResponse.json(
        { error: "That admin account already exists and cannot be replaced." },
        { status: 403 },
      );
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    if (data.user) {
      await admin
        .from("profiles")
        .update({ full_name: fullName, email })
        .eq("id", data.user.id);
    }

    return NextResponse.json({ ok: true, userId: data.user?.id });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const gate = await requireAdmin(request);
    if ("error" in gate && gate.error) return gate.error;

    const url = new URL(request.url);
    const id = url.searchParams.get("id")?.trim() ?? "";
    if (!id) {
      return NextResponse.json({ error: "Missing user." }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { data: target, error: lookupError } = await admin
      .from("profiles")
      .select("id, email")
      .eq("id", id)
      .maybeSingle();
    if (lookupError) {
      return NextResponse.json({ error: lookupError.message }, { status: 400 });
    }
    if (!target) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }
    if (isAdminEmail(target.email)) {
      return NextResponse.json(
        { error: "Cannot delete the primary admin." },
        { status: 403 },
      );
    }

    const refs: Array<{ table: string; column: string }> = [
      { table: "companies", column: "created_by" },
      { table: "companies", column: "updated_by" },
      { table: "bank_accounts", column: "created_by" },
      { table: "bank_accounts", column: "updated_by" },
      { table: "entries", column: "created_by" },
      { table: "entries", column: "updated_by" },
      { table: "entries", column: "deleted_by" },
      { table: "entry_edits", column: "edited_by" },
      { table: "categories", column: "created_by" },
      { table: "categories", column: "updated_by" },
    ];
    for (const ref of refs) {
      const { error: detachError } = await admin
        .from(ref.table)
        .update({ [ref.column]: null })
        .eq(ref.column, id);
      if (detachError) {
        return NextResponse.json({ error: detachError.message }, { status: 400 });
      }
    }

    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
