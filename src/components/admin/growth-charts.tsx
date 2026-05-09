"use client";

import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface TimeseriesPoint {
  date: string;
  advertisers: number;
  affiliates: number;
  campaigns: number;
  leads: number;
  conversions: number;
}

type Period = "7d" | "30d" | "90d" | "all";

const periodLabels: Record<Period, string> = {
  "7d": "7 days",
  "30d": "30 days",
  "90d": "90 days",
  all: "All time",
};

const metrics = [
  { key: "advertisers", label: "Advertisers", color: "hsl(220, 70%, 55%)", description: "New advertiser registrations" },
  { key: "affiliates", label: "Affiliates", color: "hsl(160, 60%, 45%)", description: "New affiliate registrations" },
  { key: "campaigns", label: "Campaigns", color: "hsl(280, 60%, 55%)", description: "New campaigns created" },
  { key: "leads", label: "Leads", color: "hsl(35, 80%, 55%)", description: "New leads submitted" },
  { key: "conversions", label: "Conversions", color: "hsl(0, 70%, 55%)", description: "New verified conversions" },
] as const;

export function GrowthCharts() {
  const [period, setPeriod] = useState<Period>("30d");
  const [data, setData] = useState<TimeseriesPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- show a loading state immediately when the selected period changes.
    setLoading(true);
    fetch(`/api/admin/stats/timeseries?period=${period}`)
      .then((res) => res.json())
      .then((json) => {
        setData(json.data?.points ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [period]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as Period)}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {(Object.keys(periodLabels) as Period[]).map((p) => (
            <option key={p} value={p}>
              {periodLabels[p]}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric) => {
          const config = {
            [metric.key]: { label: metric.label, color: metric.color },
          } satisfies ChartConfig;

          return (
            <Card key={metric.key}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{metric.label}</CardTitle>
                <CardDescription>{metric.description}</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                    Loading...
                  </div>
                ) : data.length === 0 ? (
                  <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                    No data
                  </div>
                ) : (
                  <ChartContainer config={config} className="h-40 w-full">
                    <AreaChart data={data}>
                      <CartesianGrid vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        tickFormatter={(v: string) => {
                          const d = new Date(v + "T00:00:00");
                          return d.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          });
                        }}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        allowDecimals={false}
                        width={30}
                      />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            labelFormatter={(label) => {
                              const d = new Date(String(label) + "T00:00:00");
                              return d.toLocaleDateString("en-US", {
                                month: "long",
                                day: "numeric",
                                year: "numeric",
                              });
                            }}
                          />
                        }
                      />
                      <Area
                        dataKey={metric.key}
                        type="monotone"
                        fill={`var(--color-${metric.key})`}
                        fillOpacity={0.2}
                        stroke={`var(--color-${metric.key})`}
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
