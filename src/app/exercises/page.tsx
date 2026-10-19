import { redirect } from "next/navigation";

/** The exercise catalog now lives in Plan. Kept so old links and bookmarks still work. */
export default function ExercisesRedirect() {
  redirect("/plan?tab=exercises");
}
