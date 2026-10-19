import { redirect } from "next/navigation";

/** Analytics merged into History. Kept so old links and bookmarks still work. */
export default function AnalyticsRedirect() {
  redirect("/history");
}
