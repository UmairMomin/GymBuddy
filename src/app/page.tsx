import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dumbbell, Users, Play, PlusCircle, History } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <div className="space-y-6">
      {/* Quick Status / Welcome banner */}
      <section className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Train Together</h1>
        <p className="text-sm text-zinc-400">
          Track individually. Review progress together.
        </p>
      </section>

      {/* Primary Action: Start Session */}
      <Card className="border-zinc-800 bg-zinc-900/60 shadow-lg">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center space-x-2">
            <Play className="h-5 w-5 text-emerald-400 fill-emerald-400" />
            <span>Active Workout</span>
          </CardTitle>
          <CardDescription className="text-zinc-400">
            No active session in progress. Start an empty session or select a routine.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <Button className="w-full justify-center bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-semibold gap-2">
            <Play className="h-4 w-4 fill-zinc-950" />
            Start Empty Workout
          </Button>
          <Button variant="outline" className="w-full justify-center gap-2 border-zinc-700">
            <PlusCircle className="h-4 w-4" />
            Start From Routine
          </Button>
        </CardContent>
      </Card>

      {/* Quick Access Grid */}
      <section className="grid grid-cols-2 gap-3">
        <Link href="/routines" className="block">
          <Card className="h-full border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900/80 transition-colors p-4 space-y-2">
            <Dumbbell className="h-5 w-5 text-zinc-300" />
            <div>
              <p className="font-semibold text-sm">Routines</p>
              <p className="text-xs text-zinc-400">Manage routines</p>
            </div>
          </Card>
        </Link>
        <Link href="/group" className="block">
          <Card className="h-full border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900/80 transition-colors p-4 space-y-2">
            <Users className="h-5 w-5 text-zinc-300" />
            <div>
              <p className="font-semibold text-sm">Group</p>
              <p className="text-xs text-zinc-400">Invite partners</p>
            </div>
          </Card>
        </Link>
      </section>

      {/* Recent Activity / Empty State */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
            Recent Workouts
          </h2>
          <Link href="/analytics" className="text-xs text-emerald-400 hover:underline">
            View all
          </Link>
        </div>
        <Card className="border-dashed border-zinc-800 bg-transparent text-center p-6">
          <History className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
          <p className="text-sm font-medium text-zinc-300">No recent workouts logged</p>
          <p className="text-xs text-zinc-500 mt-1">
            Complete your first session to see summaries and stats here.
          </p>
        </Card>
      </section>
    </div>
  );
}
