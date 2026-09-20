import { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/admin/guards";
import { Container } from "@/components/ui/container";
import { OwnerCandidatesList } from "./candidates-list";

export const metadata: Metadata = {
  title: "Candidates - Owner Talent",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function OwnerCandidatesPage() {
  try {
    await requireOwner();
  } catch {
    redirect("/login?next=%2Fowner%2Ftalent%2Fcandidates");
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Candidates</h1>
          <p className="mt-1 text-sm text-muted">View and manage candidate profiles.</p>
        </div>
      </div>
      <Container className="mt-6">
        <OwnerCandidatesList />
      </Container>
    </div>
  );
}

