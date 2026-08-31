import { NextResponse } from "next/server";
import { requireUser, userIsAdmin } from "@/lib/api-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

function parseOpening(value: unknown): number | null {
  const opening = Number(value);
  if (!Number.isFinite(opening)) return null;
  return Math.round(opening * 100) / 100;
}

export async function POST(request: Request) {
  try {
    const gate = await requireUser(request);
    if ("error" in gate) return gate.error;

    const body = (await request.json()) as {
      company_id?: string;
      name?: string;
      opening_balance?: number;
      notes?: string;
    };
    const companyId = body.company_id?.trim() ?? "";
    const name = body.name?.trim() ?? "";
    const opening = parseOpening(body.opening_balance);
    const notes = body.notes?.trim() || null;
    if (!companyId) {
      return NextResponse.json({ error: "Missing company." }, { status: 400 });
    }
    if (name.length < 2) {
      return NextResponse.json({ error: "Enter a bank account name." }, { status: 400 });
    }
    if (opening == null) {
      return NextResponse.json({ error: "Enter a valid opening balance." }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { data: company, error: companyError } = await admin
      .from("companies")
      .select("id")
      .eq("id", companyId)
      .maybeSingle();
    if (companyError) {
      return NextResponse.json({ error: companyError.message }, { status: 400 });
    }
    if (!company) {
      return NextResponse.json({ error: "Company not found." }, { status: 404 });
    }

    const now = new Date().toISOString();
    const { data, error } = await admin
      .from("bank_accounts")
      .insert({
        company_id: companyId,
        name,
        opening_balance: opening,
        notes,
        created_by: gate.user.id,
        updated_by: gate.user.id,
        updated_at: now,
      })
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ account: data });
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
      opening_balance?: number;
      notes?: string;
    };
    const id = body.id?.trim() ?? "";
    const name = body.name?.trim() ?? "";
    const opening = parseOpening(body.opening_balance);
    const notes = body.notes?.trim() || null;
    if (!id) {
      return NextResponse.json({ error: "Missing bank account." }, { status: 400 });
    }
    if (name.length < 2) {
      return NextResponse.json({ error: "Enter a bank account name." }, { status: 400 });
    }
    if (opening == null) {
      return NextResponse.json({ error: "Enter a valid opening balance." }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("bank_accounts")
      .update({
        name,
        opening_balance: opening,
        notes,
        updated_by: gate.user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ account: data });
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
      return NextResponse.json({ error: "Missing bank account." }, { status: 400 });
    }
    if (!(await userIsAdmin(gate.user))) {
      return NextResponse.json({ error: "Admin only." }, { status: 403 });
    }

    const admin = getSupabaseAdmin();
    const { count, error: countError } = await admin
      .from("entries")
      .select("id", { count: "exact", head: true })
      .eq("bank_account_id", id)
      .is("deleted_at", null);
    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 400 });
    }
    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: "Move or delete this account’s records before deleting the account." },
        { status: 400 },
      );
    }

    const { error } = await admin.from("bank_accounts").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
