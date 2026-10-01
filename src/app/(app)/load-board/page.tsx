import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const COLUMNS = [
  {
    key: "future",
    title: "Future Loads",
    description: "Jobs scheduled after today",
    accent: "border-t-sky-500",
  },
  {
    key: "today",
    title: "Today's Loads",
    description: "Current day — not fully dispatched",
    accent: "border-t-amber-500",
  },
  {
    key: "dispatched",
    title: "Dispatched Loads",
    description: "Trucks actively moving",
    accent: "border-t-emerald-500",
  },
] as const;

export default function LoadBoardPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Load Board</h1>
          <p className="text-sm text-slate-500">
            Operational home — Future · Today · Dispatched. Multi-truck jobs aggregate here.
          </p>
        </div>
        <Badge variant="warning">Jobs module in Phase 3–4</Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {COLUMNS.map((col) => (
          <Card key={col.key} className={`border-t-4 ${col.accent}`}>
            <CardHeader>
              <CardTitle className="text-base">{col.title}</CardTitle>
              <p className="text-xs text-slate-500">{col.description}</p>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-8 text-center text-sm text-slate-400">
                No loads yet — create jobs after Phase 3.
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
