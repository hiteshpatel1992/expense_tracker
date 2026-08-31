import { NextResponse } from "next/server";
import { requireUser, userIsAdmin } from "@/lib/api-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  try {
    const gate = await requireUser(request);
    if ("error" in gate) return gate.error;

    const body = (await request.json()) as {
      name?: string;
      opening_balance?: number;
      first_account_name?: string;
    };
    const name = body.name?.trim() ?? "";
    const accountName = (body.first_account_name?.trim() || "Main account").trim();
    const opening = Number(body.opening_balance ?? 0);
    if (name.length < 2) {
      return NextResponse.json({ error: "Enter a company name." }, { status: 400 });
    }
    if (accountName.length < 2) {
      return NextResponse.json({ error: "Enter a bank account name." }, { status: 400 });
    }
    if (!Number.isFinite(opening)) {
      return NextResponse.json({ error: "Enter a valid opening balance." }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const now = new Date().toISOString();
    const rounded = Math.round(opening * 100) / 100;
    const { data, error } = await admin
      .from("companies")
      .insert({
        name,
        opening_balance: rounded,
        created_by: gate.user.id,
        updated_by: gate.user.id,
        updated_at: now,
      })
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const { error: accountError } = await admin.from("bank_accounts").insert({
      company_id: data.id,
      name: accountName,
      opening_balance: rounded,
      created_by: gate.user.id,
      updated_by: gate.user.id,
      updated_at: now,
    });
    if (accountError) {
      await admin.from("companies").delete().eq("id", data.id);
      return NextResponse.json({ error: accountError.message }, { status: 400 });
    }
    return NextResponse.json({ company: data });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const gate = await requireUser(request);
    if ("error" in gate) return gate.error;

    const body = (await request.json()) as {
      id?: string;
      name?: string;
    };
    const id = body.id?.trim() ?? "";
    const name = body.name?.trim() ?? "";
    if (!id) {
      return NextResponse.json({ error: "Missing company." }, { status: 400 });
    }
    if (name.length < 2) {
      return NextResponse.json({ error: "Enter a company name." }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("companies")
      .update({
        name,
        updated_by: gate.user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ company: data });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const gate = await requireUser(request);
    if ("error" in gate) return gate.error;

    const url = new URL(request.url);
    const id = url.searchParams.get("id")?.trim() ?? "";
    if (!id) {
      return NextResponse.json({ error: "Missing company." }, { status: 400 });
    }

    if (!(await userIsAdmin(gate.user))) {
      return NextResponse.json({ error: "Admin only." }, { status: 403 });
    }

    const admin = getSupabaseAdmin();
    const { error: entryError } = await admin.from("entries").delete().eq("company_id", id);
    if (entryError) return NextResponse.json({ error: entryError.message }, { status: 400 });
    const { error: accountError } = await admin
      .from("bank_accounts")
      .delete()
      .eq("company_id", id);
    if (accountError) {
      return NextResponse.json({ error: accountError.message }, { status: 400 });
    }
    const { error } = await admin.from("companies").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
