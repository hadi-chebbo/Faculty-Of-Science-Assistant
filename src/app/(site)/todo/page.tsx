import type { Metadata } from "next";
import { Suspense } from "react";
import { Crumbs } from "@/components/site/crumbs";
import { PageTitle } from "@/components/site/page-title";
import { TodoSkeleton } from "@/components/site/skeletons";
import { SignedOutState } from "@/components/site/signed-out-state";
import { getSignedInPageViewer } from "@/lib/auth/page-guard";
import { listBoard } from "@/services/todos/todos";
import { TodoBoard } from "./todo-board";

export const metadata: Metadata = { title: "To-do", robots: { index: false, follow: false } };

// Private: the board belongs to the signed-in user. Everything that reads the session happens inside
// Suspense, at request time, and the response is sent no-store (next.config.ts). Without a valid
// session the page shows the in-page sign-in state (no personal data) instead of redirecting.
export default function TodoPage() {
  return (
    <main className="page-container py-6 md:py-8">
      <Crumbs items={[{ label: "Home", href: "/" }, { label: "To-do" }]} />
      <PageTitle>To-do</PageTitle>
      <Suspense fallback={<TodoSkeleton />}>
        <TodoContent />
      </Suspense>
    </main>
  );
}

async function TodoContent() {
  const session = await getSignedInPageViewer();
  if (!session) return <SignedOutState page="todo" />;
  const { viewer } = session;
  const cards = await listBoard(viewer);
  return <TodoBoard initialCards={cards} serverNow={new Date().toISOString()} />;
}
