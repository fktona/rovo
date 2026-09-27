import Link from "next/link";
import type { ScoutProfile } from "@/lib/api";

export function ScoutedBy({ scout }: { scout: ScoutProfile }) {
  const name = scout.displayName || `@${scout.handle}`;
  const face = (
    <>
      <ScoutAvatar src={scout.imageUrl} label={name} />
      <span className="text-xs text-[#8a8a8a]">Scouted by</span>
      <span className="truncate text-sm font-medium text-white">{name}</span>
    </>
  );
  const className = "inline-flex min-w-0 max-w-full items-center gap-2 active:opacity-70";
  if (scout.token) {
    return (
      <Link href={`/token/${scout.token}`} className={className}>
        {face}
      </Link>
    );
  }
  return (
    <a
      href={`https://x.com/${scout.handle.replace(/^@/, "")}`}
      target="_blank"
      rel="noreferrer"
      className={className}
    >
      {face}
    </a>
  );
}

function ScoutAvatar({ src, label }: { src: string | null; label: string }) {
  const image = src?.replace("_normal", "_bigger") ?? null;
  if (image) {
    return (
      <img
        src={image}
        alt=""
        referrerPolicy="no-referrer"
        className="size-6 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#2a2a2a] text-[11px] font-semibold uppercase">
      {label.replace(/^@/, "").slice(0, 1) || "?"}
    </span>
  );
}
