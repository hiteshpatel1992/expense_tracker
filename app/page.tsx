"use client";

import { CompanyList } from "@/components/CompanyList";
import { SignedIn } from "@/components/SignedIn";

export default function HomePage() {
  return <SignedIn>{({ user, profile }) => <CompanyList user={user} profile={profile} />}</SignedIn>;
}
