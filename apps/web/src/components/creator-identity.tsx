"use client";

import { useState } from "react";
import { useXAccount } from "@/hooks/useRovoQueries";
import { ScoutedBy } from "@/components/scout-by";
import type { ScoutProfile } from "@/lib/api";

export function telegramLink(description: string | null | undefined) {
  if (!description) return null;
  const match = description.match(
    /https?:\/\/(?:t\.me|telegram\.me)\/[A-Za-z0-9_]+/i,
  );
  return match?.[0] ?? null;
}

function shortAddress(value: string) {
  return value.length < 12 ? value : `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function xAvatarUrl(url: string | null | undefined) {
  if (!url) return null;
  return url.replace("_normal", "_400x400");
}

function formatFollowers(count: number) {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return count.toLocaleString("en-US");
}

export function TokenProfileCard({
  token,
  name,
  handle,
  image,
  status,
  pairLabel,
  pairIcon,
  scout,
  stats,
}: {
  token: string;
  name: string;
  handle: string;
  image: string;
  status: string | null;
  pairLabel: string;
  pairIcon?: string;
  scout: ScoutProfile | null;
  stats: Array<{ label: string; value: string; tone?: string }>;
}) {
  const account = useXAccount(handle.replace(/^@/, "") || undefined);
  const profile = account.data;
  const [copied, setCopied] = useState(false);
  const displayName = profile?.displayName?.trim() || name;
  const avatar = xAvatarUrl(profile?.imageUrl) || image;
  const telegram = telegramLink(profile?.description);
  const username = (profile?.handle || handle).replace(/^@/, "");

  const copyContract = async () => {
    try {
      await navigator.clipboard.writeText(token);
    } catch {
      // Clipboard can be blocked; the button still confirms the tap.
    }
    setCopied(true);
  };

  return (
    <section className="overflow-hidden rounded-[20px] bg-surface">
      <div className="relative">
        {profile?.bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.bannerUrl}
            alt=""
            className="h-36 w-full object-cover sm:h-44"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="h-28 w-full bg-surface sm:h-36" />
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatar}
          alt=""
          width={88}
          height={88}
          referrerPolicy="no-referrer"
          className="absolute bottom-0 left-5 size-20 translate-y-1/2 rounded-full object-cover ring-4 ring-surface sm:left-7 sm:size-[88px]"
        />
      </div>

      <div className="px-5 pb-6 pt-12 sm:px-7 sm:pt-14">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-2">
          <h1 className="min-w-0 truncate text-[26px] font-bold leading-none tracking-tight text-foreground sm:text-[32px]">
            {displayName}
          </h1>
          {profile?.verified ? <VerifiedMark /> : null}
          {status ? (
            <span className="shrink-0 rounded-full bg-surface-raised px-2.5 py-1 text-[11px] font-medium leading-none text-muted">
              {status}
            </span>
          ) : null}
        </div>

        <p className="mt-2 text-sm text-muted">
          @{username}
          {profile?.followers != null
            ? ` · ${formatFollowers(profile.followers)} followers`
            : ""}
        </p>

        {profile?.description ? (
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
            {profile.description}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted">
          <span className="inline-flex items-center gap-1.5">
            Paired with
            {pairIcon ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={pairIcon}
                alt=""
                width={20}
                height={20}
                className="size-5 rounded-full object-cover"
              />
            ) : null}
            <span className="font-medium text-foreground">{pairLabel}</span>
          </span>
          <button
            type="button"
            onClick={copyContract}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-xs text-foreground"
          >
            {copied ? "Copied" : `CA ${shortAddress(token)}`}
          </button>
          {scout ? <ScoutedBy scout={scout} /> : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {username ? (
            <SocialLink href={`https://x.com/${username}`} label="X" />
          ) : null}
          {profile?.website ? (
            <SocialLink href={profile.website} label="Web" />
          ) : null}
          {telegram ? <SocialLink href={telegram} label="Tg" /> : null}
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-line pt-5 sm:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="min-w-0">
              <dt className="text-sm text-muted">{stat.label}</dt>
              <dd
                className={`mt-1 truncate text-xl font-bold tracking-tight ${stat.tone ?? "text-foreground"}`}
              >
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function VerifiedMark() {
  return (
    <span
      className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-[#1d9bf0]"
      title="Verified"
    >
      <svg viewBox="0 0 12 12" className="size-3 fill-white" aria-hidden="true">
        <path d="M4.6 8.2 2.4 6l.85-.85L4.6 6.5l4.15-4.15.85.85z" />
      </svg>
    </span>
  );
}

export function CreatorIdentity({ handle }: { handle: string }) {
  const account = useXAccount(handle.replace(/^@/, "") || undefined);
  const profile = account.data;
  if (!profile) return null;
  const telegram = telegramLink(profile.description);
  return (
    <div className="mt-4">
      {profile.bannerUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={profile.bannerUrl}
          alt=""
          className="mb-4 h-28 w-full rounded-xl object-cover sm:h-36"
          referrerPolicy="no-referrer"
        />
      ) : null}
      {profile.description ? (
        <p className="max-w-2xl text-sm leading-6 text-muted">
          {profile.description}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        <SocialLink href={`https://x.com/${profile.handle}`} label="X" />
        {profile.website ? (
          <SocialLink href={profile.website} label="Web" />
        ) : null}
        {telegram ? <SocialLink href={telegram} label="Tg" /> : null}
      </div>
    </div>
  );
}

function SocialLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex h-8 items-center rounded-[10px] bg-surface-raised px-3 text-xs font-medium text-foreground"
    >
      {label}
    </a>
  );
}
