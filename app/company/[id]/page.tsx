"use client";

import { Suspense, use } from "react";
import { useSearchParams } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { SignedIn } from "@/components/SignedIn";
import { Tracker } from "@/components/Tracker";
import type { Profile } from "@/lib/types";

function CompanyTracker({
  companyId,
  user,
  profile,
}: {
  companyId: string;
  user: User;
  profile: Profile;
}) {
  const searchParams = useSearchParams();
  const initialAccount = searchParams.get("account") ?? "all";
  return (
    <Tracker
      key={initialAccount}
      user={user}
      profile={profile}
      companyId={companyId}
      initialAccount={initialAccount}
    />
  );
}

export default function CompanyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <SignedIn>
      {({ user, profile }) => (
        <Suspense fallback={<p className="empty">Loading…</p>}>
          <CompanyTracker companyId={id} user={user} profile={profile} />
        </Suspense>
      )}
    </SignedIn>
  );
}
