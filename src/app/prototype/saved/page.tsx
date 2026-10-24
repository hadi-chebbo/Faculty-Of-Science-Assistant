// PROTOTYPE ONLY (branch prototype/todo-board). Never merge to main.
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SavedPrototype } from "./saved-prototype";

export const metadata = { title: "Saved (prototype)", robots: { index: false } };

export default function SavedPrototypePage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <Suspense>
      <SavedPrototype />
    </Suspense>
  );
}
