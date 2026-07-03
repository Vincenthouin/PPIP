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
  hoursToDays,
  initialsOf,
  lineHoursInSprint,
  resolveWorkdayHours,
} from "./pi-types";

// v1.2 — chiffres exprimés en jours par designer (chacun peut avoir son propre workdayHours)

export function ProductionSummary({
  sprints,
  categories,
  users,
  visibleUserIds,
  weeksPerSprint,
  workdayHours, // fallback si un designer n'a pas de workdayHours perso
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

  // Chart data en jours de production par designer par sprint
  const chartData = sprints.map((s, i) => {
    const row: any = { name: `S${s.index + 1}` };
    shownUsers.forEach((u) => {
      const uwh = resolveWorkdayHours(u, workdayHours);
      const meetingHours = categories
        .filter((c) => c.userId === u.id && c.sprintIds.includes(s.id))
        .reduce(
          (sum, c) =>
            sum + c.lines.reduce((x, l) => x + lineHoursInSprint(l, weeksPerSprint), 0),
          0,
        );
      const capacityHours = sprintDays[i] * uwh;
      const productionHours = Math.max(0, capacityHours - meetingHours);
      const productionDays = uwh > 0 ? productionHours / uwh : 0;
      row[u.id] = +productionDays.toFixed(2);
      row[`__meet_${u.id}`] = meetingHours;
      row[`__hours_${u.id}`] = +productionHours.toFixed(1);
    });
    return row;
  });

  const perUserTotals = shownUsers.map((u) => {
    const uwh = resolveWorkdayHours(u, workdayHours);
    const capacityHours = sprintDays.reduce((a, b) => a + b, 0) * uwh;
    const meetingHours = sprints.reduce((sum, s) => {
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
    const productionHours = Math.max(0, capacityHours - meetingHours);
    return { user: u, uwh, capacityHours, meetingHours, productionHours };
  });

  return (
    <Card className="p-4 gap-4">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <div>
          <h3>Production time by designer</h3>
          <p className="text-xs text-muted-foreground">
            Available production days per sprint, after recurring meetings.
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_320px]">
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.4} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} unit="j" width={40} />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  fontSize: 12,
                }}
                formatter={(value: any, _name: any, ctx: any) => {
                  const uid = ctx?.dataKey as string;
                  const hours = ctx?.payload?.[`__hours_${uid}`];
                  return [
                    `${(+value).toFixed(1)}j${hours != null ? ` (${(+hours).toFixed(1)}h)` : ""}`,
                    ctx?.name,
                  ];
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {shownUsers.map((u, i) => (
                <Bar
                  key={u.id}
                  dataKey={u.id}
                  name={displayNames[i]}
                  fill={u.color}
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-2">
          {perUserTotals.map(({ user, uwh, capacityHours, meetingHours, productionHours }) => {
            const pct = capacityHours ? (productionHours / capacityHours) * 100 : 0;
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
                  <span className="text-sm flex-1 min-w-0 truncate">{user.name}</span>
                  <span className="text-sm text-emerald-600 shrink-0">
                    {hoursToDays(productionHours, uwh)}
                  </span>
                </div>
                <Progress value={pct} />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{hoursToDays(meetingHours, uwh)} meetings</span>
                  <span>{hoursToDays(capacityHours, uwh)} capacity</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
