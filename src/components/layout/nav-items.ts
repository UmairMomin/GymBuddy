import { Dumbbell, Calendar, BarChart3, Users, type LucideIcon } from "lucide-react";

export type NavItem = { label: string; href: string; icon: LucideIcon; match?: string[] };

/** Primary navigation, shared by the mobile bottom bar and the desktop header. Settings lives in the profile menu. */
export const NAV_ITEMS: NavItem[] = [
  { label: "Workout", href: "/", icon: Dumbbell, match: ["/session"] },
  { label: "Plan", href: "/plan", icon: Calendar },
  { label: "Buddy", href: "/buddy", icon: Users },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
];

export function isNavActive(pathname: string, item: NavItem): boolean {
  if (item.href === "/") return pathname === "/" || (item.match ?? []).some((m) => pathname.startsWith(m));
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
