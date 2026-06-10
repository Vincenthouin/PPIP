import { useMemo } from "react";
import { differenceInCalendarDays } from "date-fns";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "./ui/card";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Progress } from "./ui/progress";
import {
  AssignedCategory,
  Sprint,
  User,
  initialsOf,
  lineHoursInSprint,
} from "./pi-types";

export function ProductionSummary({
  sprints,
  categories,
  users,
  visibleUserIds,
  weeksPerSprint,
  workdayHours,
}: {
  sprints: Sprint[];
  categories: AssignedCategory[];
  users: User[];
  visibleUserIds: string[];
  weeksPerSprint: number;
  workdayHours: number;
}) {
  const shownUsers = (() => {
    const seen = new Set<string>();
    return users.filter((u) => {
      if (!visibleUserIds.includes(u.id) || seen.has(u.id)) return false;
      seen.add(u.id);
      return true;
    });
  })();
  const displayNames = (() => {
    const counts = new Map<string, number>();
    return shownUsers.map((u) => {
      const n = counts.get(u.name) ?? 0;
      counts.set(u.name, n + 1);
      return n === 0 && shownUsers.filter((x) => x.name === u.name).length === 1
        ? u.name
        : `${u.name} (${u.initials ?? u.id.slice(0, 4)})`;
    });
  })();
  const sprintDays = useMemo(
    () =>
      sprints.map((s) =>
        Math.max(
          0,
          Math.round((differenceInCalendarDays(s.end, s.start) + 1) * (5 / 7)),
        ),
      ),
    [sprints],
  );

  const chartData = sprints.map((s, i) => {
    const capacity = sprintDays[i] * workdayHours;
    const row: any = { name: `S${s.index + 1}`, capacity };
    shownUsers.forEach((u) => {
      const meetings = categories
        .filter((c) => c.userId === u.id && c.sprintIds.includes(s.id))
        .reduce(
          (sum, c) =>
            sum + c.lines.reduce((x, l) => x + lineHoursInSprint(l, weeksPerSprint), 0),
          0,
        );
      row[u.id] = +Math.max(0, capacity - meetings).toFixed(1);
      row[`__meet_${u.id}`] = meetings;
    });
    return row;
  });

  const perUserTotals = shownUsers.map((u) => {
    const capacity = sprintDays.reduce((a, b) => a + b, 0) * workdayHours;
    const meetings = sprints.reduce((sum, s) => {
      return (
        sum +
        categories
          .filter((c) => c.userId === u.id && c.sprintIds.includes(s.id))
          .reduce(
            (x, c) =>
              x +
              c.lines.reduce((y, l) => y + lineHoursInSprint(l, weeksPerSprint), 0),
            0,
          )
      );
    }, 0);
    const production = Math.max(0, capacity - meetings);
    return { user: u, capacity, meetings, production };
  });

  return (
    <Card className="p-4 gap-4">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <div>
          <h3>Production time by designer</h3>
          <p className="text-xs text-muted-foreground">
            Available production hours per sprint, after recurring meetings.
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_320px]">
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.4} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} unit="h" width={40} />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {shownUsers.map((u, i) => (
                <Bar key={u.id} dataKey={u.id} name={displayNames[i]} fill={u.color} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-2">
          {perUserTotals.map(({ user, capacity, meetings, production }) => {
            const pct = capacity ? (production / capacity) * 100 : 0;
            return (
              <div key={user.id} className="rounded-lg border p-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Avatar className="size-6">
                    <AvatarFallback
                      style={{ background: user.color, color: "white", fontSize: 11 }}
                    >
                      {user.initials ?? initialsOf(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm flex-1">{user.name}</span>
                  <span className="text-sm text-emerald-600">
                    {production.toFixed(1)}h
                  </span>
                </div>
                <Progress value={pct} />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{meetings.toFixed(1)}h meetings</span>
                  <span>{capacity}h capacity</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
