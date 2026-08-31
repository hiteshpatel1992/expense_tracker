"use client";

import { SignedIn } from "@/components/SignedIn";
import { UsersAdmin } from "@/components/UsersAdmin";

export default function UsersPage() {
  return (
    <SignedIn>
      {({ user, profile }) => <UsersAdmin user={user} profile={profile} />}
    </SignedIn>
  );
}
