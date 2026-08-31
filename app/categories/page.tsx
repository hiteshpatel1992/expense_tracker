"use client";

import { SignedIn } from "@/components/SignedIn";
import { CategoriesAdmin } from "@/components/CategoriesAdmin";

export default function CategoriesPage() {
  return (
    <SignedIn>
      {({ user, profile }) => <CategoriesAdmin user={user} profile={profile} />}
    </SignedIn>
  );
}
