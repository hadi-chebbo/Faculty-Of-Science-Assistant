// PROTOTYPE ONLY (branch prototype/todo-board). Never merge to main.
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { TodoPrototype } from "./todo-prototype";

export const metadata = { title: "To-do (prototype)", robots: { index: false } };

export default function TodoPrototypePage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <Suspense>
      <TodoPrototype />
    </Suspense>
  );
}
