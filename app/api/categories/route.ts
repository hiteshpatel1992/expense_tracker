import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { EntryType } from "@/lib/types";

function parseType(value: unknown): EntryType | null {
  return value === "income" || value === "expense" ? value : null;
}

export async function GET(request: Request) {
  try {
    const gate = await requireUser(request);
    if ("error" in gate) return gate.error;
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("categories")
      .select("id, name, type, created_at")
      .order("type")
      .order("name");
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ categories: data ?? [] });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const gate = await requireUser(request);
    if ("error" in gate) return gate.error;

    const body = (await request.json()) as { name?: string; type?: string };
    const name = body.name?.trim() ?? "";
    const type = parseType(body.type);
    if (name.length < 2) {
      return NextResponse.json({ error: "Enter a category name." }, { status: 400 });
    }
    if (!type) {
      return NextResponse.json({ error: "Choose income or expense." }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("categories")
      .insert({
        name,
        type,
        created_by: gate.user.id,
        updated_by: gate.user.id,
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single();
    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "That category already exists for this type." },
          { status: 400 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ category: data });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const gate = await requireUser(request);
    if ("error" in gate) return gate.error;

    const body = (await request.json()) as { id?: string; name?: string };
    const id = body.id?.trim() ?? "";
    const name = body.name?.trim() ?? "";
    if (!id) {
      return NextResponse.json({ error: "Missing category." }, { status: 400 });
    }
    if (name.length < 2) {
      return NextResponse.json({ error: "Enter a category name." }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { data: current, error: lookupError } = await admin
      .from("categories")
      .select("id, name, type")
      .eq("id", id)
      .maybeSingle();
    if (lookupError) {
      return NextResponse.json({ error: lookupError.message }, { status: 400 });
    }
    if (!current) {
      return NextResponse.json({ error: "Category not found." }, { status: 404 });
    }

    const { data, error } = await admin
      .from("categories")
      .update({
        name,
        updated_by: gate.user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "That category already exists for this type." },
          { status: 400 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (current.name !== name) {
      await admin
        .from("entries")
        .update({ category: name })
        .eq("category", current.name)
        .eq("type", current.type);
    }

    return NextResponse.json({ category: data });
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
      return NextResponse.json({ error: "Missing category." }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { data: current, error: lookupError } = await admin
      .from("categories")
      .select("id, name, type")
      .eq("id", id)
      .maybeSingle();
    if (lookupError) {
      return NextResponse.json({ error: lookupError.message }, { status: 400 });
    }
    if (!current) {
      return NextResponse.json({ error: "Category not found." }, { status: 404 });
    }

    const { count, error: countError } = await admin
      .from("entries")
      .select("id", { count: "exact", head: true })
      .eq("category", current.name)
      .eq("type", current.type)
      .is("deleted_at", null);
    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 400 });
    }
    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: "This category is used on ledger records. Rename it instead of deleting." },
        { status: 400 },
      );
    }

    const { error } = await admin.from("categories").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
