import { NotFoundContent } from "@/components/site/not-found-content";

// Already inside the (site) layout, so no site frame here (the root not-found adds its own).
export default function NotFound() {
  return <NotFoundContent />;
}
