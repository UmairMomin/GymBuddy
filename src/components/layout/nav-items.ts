import { Dumbbell, Calendar, BarChart3, Users, Settings, ListChecks, type LucideIcon } from "lucide-react";

export type NavItem = { label: string; href: string; icon: LucideIcon; match?: string[] };

export const NAV_ITEMS: NavItem[] = [
  { label: "Workout", href: "/", icon: Dumbbell, match: ["/session"] },
  { label: "Routines", href: "/routines", icon: Calendar },
  { label: "Group", href: "/group", icon: Users },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Settings", href: "/settings", icon: Settings },
];

/** Desktop header also exposes the exercise catalog (reachable from Routines on mobile). */
export const DESKTOP_NAV_ITEMS: NavItem[] = [
  NAV_ITEMS[0],
  NAV_ITEMS[1],
  { label: "Exercises", href: "/exercises", icon: ListChecks },
  ...NAV_ITEMS.slice(2),
];

export function isNavActive(pathname: string, item: NavItem): boolean {
  if (item.href === "/") return pathname === "/" || (item.match ?? []).some((m) => pathname.startsWith(m));
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
