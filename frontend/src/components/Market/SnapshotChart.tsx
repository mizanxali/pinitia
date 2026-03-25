"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { type PlaceSnapshot } from "@/lib/supabase";

interface SnapshotChartProps {
  snapshots: PlaceSnapshot[];
  metric: "rating" | "review_count";
  targetLine?: number;
}

export default function SnapshotChart({
  snapshots,
  metric,
  targetLine,
}: SnapshotChartProps) {
  const data = snapshots.map((s) => ({
    time: new Date(s.fetched_at).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
    }),
    value: metric === "rating" ? s.rating : s.review_count,
  }));

  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center border-2 border-border bg-muted">
        <p className="font-body text-sm text-muted-foreground">
          No snapshot data yet
        </p>
      </div>
    );
  }

  return (
    <div className="border-2 border-border bg-card pr-4 pt-4 pl-2">
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data}>
          <XAxis
            dataKey="time"
            tick={{ fontSize: 11, fontWeight: 600 }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fontWeight: 600 }}
            tickLine={false}
            domain={["auto", "auto"]}
          />
          <Tooltip
            contentStyle={{
              border: "2px solid black",
              borderRadius: 0,
              fontWeight: 700,
              fontSize: 12,
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="hsl(30, 100%, 55%)"
            strokeWidth={3}
            dot={{ fill: "black", strokeWidth: 2, r: 3 }}
            connectNulls
          />
          {targetLine !== undefined && (
            <ReferenceLine
              y={targetLine}
              stroke="red"
              strokeDasharray="6 3"
              strokeWidth={2}
              label={{
                value: "Target",
                position: "right",
                fontSize: 11,
                fontWeight: 700,
                fill: "red",
              }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
