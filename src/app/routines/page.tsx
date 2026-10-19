import { redirect } from "next/navigation";

/** Routines now live in Plan. Kept so old links and bookmarks still work. */
export default function RoutinesRedirect() {
  redirect("/plan?tab=routines");
}
