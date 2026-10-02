"use client";

import { useId, useState, type PointerEvent } from "react";
import { formatUsd } from "@/lib/token-market";

export type ChartPoint = { t: number; price: number; volumeQuote?: number };

export function chartSeries(
  points: ChartPoint[],
  quoteUsd: number | null,
  supply: number | null,
) {
  return points.map((point) => {
    const usd =
      quoteUsd != null && quoteUsd > 0 ? point.price * quoteUsd : point.price;
    return supply != null && supply > 0 ? usd * supply : usd;
  });
}

function toDate(timestamp: number) {
  return new Date(timestamp > 1e12 ? timestamp : timestamp * 1000);
}

function formatTick(timestamp: number, spanSeconds: number) {
  const date = toDate(timestamp);
  if (spanSeconds > 36 * 60 * 60) {
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  }
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatHoverDate(timestamp: number) {
  const date = toDate(timestamp);
  const day = date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const time = date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${day}, ${time}`;
}

export function TokenPriceChart({
  points,
  quoteUsd,
  supply,
  loading,
  range = "1d",
}: {
  points: ChartPoint[];
  quoteUsd: number | null;
  supply: number | null;
  loading: boolean;
  range?: string;
}) {
  const gradientId = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  if (loading) {
    return <div className="shimmer h-[340px] w-full rounded-[11px]" aria-busy="true" />;
  }
  const values = chartSeries(points, quoteUsd, supply);
  if (values.length === 0) {
    return (
      <p className="flex h-[340px] items-center justify-center text-sm text-muted">
        No trades in this range yet.
      </p>
    );
  }

  const width = 640;
  const height = 248;
  const padX = 8;
  const padTop = 12;
  const padBottom = 8;
  const min = 2_000;
  const peak = Math.max(...values);
  const max = peak > min ? peak : min + Math.max(min, 1) * 0.08;
  const span = max - min;
  const coords = values.map((value, index) => {
    const x =
      values.length === 1
        ? width / 2
        : padX + (index / (values.length - 1)) * (width - padX * 2);
    const plotBottom = height - padBottom;
    const rawY = padTop + (1 - (value - min) / span) * (plotBottom - padTop);
    const y = Math.min(plotBottom, Math.max(padTop, rawY));
    return { x, y, value, t: points[index]?.t };
  });
  const line = coords.map((point) => `${point.x},${point.y}`).join(" ");
  const first = coords[0]!;
  const last = coords[coords.length - 1]!;
  const linePath = coords
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`)
    .join(" ");
  const area =
    values.length === 1
      ? `M 0 ${first.y} L ${width} ${first.y} L ${width} ${height} L 0 ${height} Z`
      : `${linePath} L ${last.x} ${height} L ${first.x} ${height} Z`;
  const times = points.map((point) => point.t).filter((time) => Number.isFinite(time));
  const start = times[0];
  const end = times[times.length - 1];
  const spanSeconds =
    start != null && end != null ? Math.abs(toDate(end).getTime() - toDate(start).getTime()) / 1000 : 0;
  const ticks =
    start == null || end == null
      ? []
      : start === end
        ? [start]
        : [0, 1, 2, 3].map((index) => start + ((end - start) * index) / 3);
  const yTicks = [0, 1, 2, 3].map((index) => ({
    value: max - (span * index) / 3,
    y: padTop + (index / 3) * (height - padTop - padBottom),
  }));
  const active = hover != null && coords[hover] ? coords[hover] : last;
  const tooltipLeft = active.x / width > 0.62;

  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * width;
    let nearest = 0;
    let best = Infinity;
    coords.forEach((point, index) => {
      const distance = Math.abs(point.x - x);
      if (distance < best) {
        best = distance;
        nearest = index;
      }
    });
    setHover(nearest);
  };

  return (
    <div>
      <div className="mb-3">
        <p className="text-[32px] font-semibold leading-none tracking-tight text-foreground">
          {formatUsd(active.value)}
        </p>
        <p className="mt-1.5 text-sm text-positive">
          {typeof active.t === "number" ? formatHoverDate(active.t) : "—"}
        </p>
      </div>
      <div className="flex gap-3">
        <div className="min-w-0 flex-1">
          <div
            className="relative h-[248px] cursor-crosshair"
            onPointerMove={move}
            onPointerLeave={() => setHover(null)}
          >
            <svg
              viewBox={`0 0 ${width} ${height}`}
              role="img"
              aria-label={`Market cap chart, ${range}, ${formatUsd(last.value)}`}
              className="h-full w-full"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.55" />
                  <stop offset="55%" stopColor="#14f195" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="var(--surface)" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[0.22, 0.44, 0.66, 0.88].map((ratio) => (
                <line
                  key={ratio}
                  x1="0"
                  x2={width}
                  y1={height * ratio}
                  y2={height * ratio}
                  stroke="var(--line)"
                  strokeDasharray="1.2 6"
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              <path d={area} fill={`url(#${gradientId})`} />
              {values.length === 1 ? (
                <line
                  x1="0"
                  x2={width}
                  y1={first.y}
                  y2={first.y}
                  stroke="var(--accent)"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                />
              ) : (
                <polyline
                  points={line}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </svg>
            {hover != null && (
              <span
                className="pointer-events-none absolute top-0 h-full w-px bg-foreground/35"
                style={{ left: `${(active.x / width) * 100}%` }}
              />
            )}
            <span
              className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-action shadow-[0_0_0_4px_rgba(153,69,255,0.18)]"
              style={{ left: `${(active.x / width) * 100}%`, top: `${(active.y / height) * 100}%` }}
            />
            {hover != null && (
              <div
                className="pointer-events-none absolute z-20 w-[132px] rounded-lg border border-foreground/10 bg-surface-raised px-3 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
                style={{
                  left: tooltipLeft
                    ? `calc(${(active.x / width) * 100}% - 144px)`
                    : `calc(${(active.x / width) * 100}% + 12px)`,
                  top: `max(8px, calc(${(active.y / height) * 100}% - 28px))`,
                }}
              >
                <p className="text-[11px] text-muted">Market cap</p>
                <p className="mt-0.5 text-sm font-semibold text-foreground">{formatUsd(active.value)}</p>
                <p className="mt-0.5 text-[11px] text-muted">
                  {typeof active.t === "number" ? formatHoverDate(active.t) : "—"}
                </p>
              </div>
            )}
          </div>
          {ticks.length > 0 && (
            <div className="mt-2 flex justify-between px-1 text-[11px] text-muted">
              {ticks.map((tick) => (
                <span key={tick}>{formatTick(tick, spanSeconds)}</span>
              ))}
            </div>
          )}
        </div>
        <div className="relative h-[248px] w-14 shrink-0 text-[11px] text-muted">
          {yTicks.map((tick) => (
            <span
              key={tick.y}
              className="absolute right-0 -translate-y-1/2 whitespace-nowrap"
              style={{ top: `${(tick.y / height) * 100}%` }}
            >
              {formatUsd(tick.value)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
