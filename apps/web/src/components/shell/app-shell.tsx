"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useRovoIdentity } from "@/hooks/useRovoIdentity";
import { useXAccount } from "@/hooks/useRovoQueries";
import { useFeeAdmin } from "@/hooks/useRovoQueries";
import type { Address } from "viem";
import { onboardingSeen } from "@/lib/onboarding";
import { useToast } from "@/components/toast/toast-provider";
import { AssetIcon, icons, RovoWordmark } from "../home/assets";
import { styles } from "../home/styles";
import { DocsIcon, HomeIcon, LaunchIcon, ProfileIcon, RewardsIcon } from "./icon";

const navigation = [
  { label: "Home", href: "/", icon: HomeIcon },
  { label: "Launch", href: "/launch", icon: LaunchIcon },
  { label: "Rewards", href: "/rewards", icon: RewardsIcon },
  { label: "Profile", href: "/profile", icon: ProfileIcon },
];

const rail = "w-[4.5rem]";
const tooltip =
  "pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-md border border-[#383838] bg-[#191919] px-2.5 py-1 text-xs font-medium text-white opacity-0 shadow-lg group-hover:opacity-100 group-focus-visible:opacity-100";

type SearchContextValue = {
  search: string;
  setSearch: (value: string) => void;
};
const SearchContext = createContext<SearchContextValue | null>(null);

export function useAppSearch() {
  const context = useContext(SearchContext);
  if (!context) throw new Error("useAppSearch must be used within AppShell");
  return context;
}

function LoginControl({ className }: { className: string }) {
  const { authenticated, login, logout } = useRovoIdentity();
  return (
    <button
      type="button"
      onClick={() => (authenticated ? logout() : login())}
      className={className}
    >
      {authenticated ? "Log out" : "Log in"}
    </button>
  );
}
function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
}

function viewportKind() {
  if (window.matchMedia("(max-width: 767px)").matches) return "mobile";
  if (window.matchMedia("(max-width: 1023px)").matches) return "tablet";
  return "desktop";
}

function Chevron({ left = false }: { left?: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={left ? "rotate-180" : undefined}
    >
      <path
        d="M6 3.5 10.5 8 6 12.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Sidebar({
  pinnedOpen,
  overlayOpen,
  onToggle,
  onNavigate,
}: {
  pinnedOpen: boolean;
  overlayOpen: boolean;
  onToggle: () => void;
  onNavigate: () => void;
}) {
  const pathname = usePathname();
  const { wallets } = useRovoIdentity();
  const admin = useFeeAdmin(wallets[0]?.address as Address | undefined);
  const [desktop, setDesktop] = useState(true);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const sync = () => setDesktop(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  const expanded = overlayOpen || (pinnedOpen && desktop);
  const labelClass = overlayOpen
    ? "whitespace-nowrap"
    : pinnedOpen
      ? "max-lg:sr-only whitespace-nowrap lg:inline"
      : "sr-only";
  const tooltipClass = overlayOpen
    ? "hidden"
    : pinnedOpen
      ? `${tooltip} lg:hidden`
      : tooltip;
  const itemAlign = overlayOpen
    ? "justify-start px-3"
    : `justify-center px-2 ${pinnedOpen ? "lg:justify-start lg:px-3" : ""}`;
  const railWidth = overlayOpen || !pinnedOpen ? rail : `${rail} lg:w-60`;

  return (
    <div
      className={`relative z-30 hidden h-full shrink-0 md:block ${railWidth}`}
    >
      {overlayOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={onToggle}
        />
      )}
      <aside
        aria-label="Main navigation"
        className={`flex h-full flex-col bg-black pb-4 ${
          overlayOpen
            ? "fixed inset-y-0 left-0 z-40 w-60 px-3 shadow-2xl"
            : "w-full px-2"
        } ${pinnedOpen ? "lg:px-3" : ""}`}
      >
        <Link
          href="/"
          aria-label="Rovo home"
          className={`group relative flex h-16 shrink-0 items-center lg:h-20 ${itemAlign}`}
        >
          <span
            className={
              overlayOpen ? "hidden" : pinnedOpen ? "lg:hidden" : "inline-flex"
            }
          >
            <AssetIcon src={icons.logoMark} alt="" width={34} height={34} className="block size-[34px]" />
          </span>
          <span
            className={
              overlayOpen
                ? "inline-flex"
                : pinnedOpen
                  ? "hidden lg:inline-flex"
                  : "hidden"
            }
          >
            <RovoWordmark className="h-[34px] w-auto" />
          </span>
          <span aria-hidden="true" className={tooltipClass}>
            Rovo
          </span>
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          {navigation.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  onClick={onNavigate}
                  className={`group relative flex items-center gap-2.5 rounded-[15px] py-2.5 text-sm font-medium tracking-[.02em] hover:bg-[#191919] lg:py-3 lg:text-base ${itemAlign} ${
                    active ? styles.navLinkActive : ""
                  }`}
                >
                  <span
                    className={`flex size-6 shrink-0 items-center justify-center ${active ? "text-[#ccff00]" : "text-white"}`}
                  >
                    <item.icon />
                  </span>
                  <span className={labelClass}>{item.label}</span>
                  <span aria-hidden="true" className={tooltipClass}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          {admin.data && (
            <Link
              href="/admin"
              aria-current={isActive(pathname, "/admin") ? "page" : undefined}
              onClick={onNavigate}
              className={`group relative flex items-center gap-2.5 rounded-[15px] py-2.5 text-sm font-medium tracking-[.02em] hover:bg-[#191919] lg:py-3 lg:text-base ${itemAlign} ${isActive(pathname, "/admin") ? styles.navLinkActive : ""}`}
            >
              <span className="flex size-6 shrink-0 items-center justify-center text-xl" aria-hidden="true">⚙</span>
              <span className={labelClass}>Admin</span>
              <span aria-hidden="true" className={tooltipClass}>Admin</span>
            </Link>
          )}
          <Link
            href="/docs"
            aria-current={isActive(pathname, "/docs") ? "page" : undefined}
            onClick={onNavigate}
            className={`group relative flex items-center gap-2.5 rounded-[15px] py-2.5 text-sm font-medium tracking-[.02em] hover:bg-[#191919] lg:py-3 lg:text-base ${itemAlign} ${isActive(pathname, "/docs") ? styles.navLinkActive : ""}`}
          >
            <span
              className={`flex size-6 shrink-0 items-center justify-center ${isActive(pathname, "/docs") ? "text-[#ccff00]" : "text-white"}`}
            >
              <DocsIcon />
            </span>
            <span className={labelClass}>Docs</span>
            <span aria-hidden="true" className={tooltipClass}>
              Docs
            </span>
          </Link>
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
            className="mt-auto flex items-center justify-center rounded-[15px] py-3 text-white/70 hover:bg-[#191919] hover:text-white"
          >
            <span className={overlayOpen ? "hidden" : "lg:hidden"}>
              <Chevron />
            </span>
            <span
              className={overlayOpen ? "inline-flex" : "hidden lg:inline-flex"}
            >
              <Chevron left={pinnedOpen || overlayOpen} />
            </span>
          </button>
        </nav>
      </aside>
    </div>
  );
}

function BottomNav() {
  const pathname = usePathname();
  const { authenticated } = useRovoIdentity();
  return (
    <nav
      aria-label="Main navigation"
      className="flex h-[68px] shrink-0 items-center border-t border-[#252525] bg-black pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {navigation
        .filter((item) => authenticated || item.label !== "Profile")
        .map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.label}
              href={item.href}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className={`flex min-w-0 flex-1 items-center justify-center ${item.label === "Home" ? "order-1" : item.label === "Profile" ? "order-2" : item.label === "Launch" ? "order-3" : item.label === "Rewards" ? "order-4" : "order-5"}`}
            >
              {item.label === "Launch" ? (
                <span className="flex size-12 items-center justify-center rounded-xl bg-[#ccff00] text-3xl font-light leading-none text-black">
                  +
                </span>
              ) : (
                <span
                  className={`flex size-11 items-center justify-center ${active ? "text-[#ccff00]" : "text-white/50"}`}
                >
                  <item.icon />
                </span>
              )}
            </Link>
          );
        })}
      <Link
        href="/docs"
        aria-label="Docs"
        aria-current={isActive(pathname, "/docs") ? "page" : undefined}
        className={`order-5 flex min-w-0 flex-1 items-center justify-center ${isActive(pathname, "/docs") ? "text-[#ccff00]" : "text-white/50"}`}
      >
        <span className="flex size-11 items-center justify-center">
          <DocsIcon />
        </span>
      </Link>
      {!authenticated && (
        <LoginControl className="order-2 min-w-0 flex-1 text-xs font-semibold text-[#ccff00]" />
      )}
    </nav>
  );
}

function AccountMenu({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  const { authenticated, login, logout, xAccount, wallets } = useRovoIdentity();
  const admin = useFeeAdmin(wallets[0]?.address as Address | undefined);
  const router = useRouter();
  const linked = useXAccount(xAccount?.username ?? undefined);
  const username = xAccount?.username ?? linked.data?.handle;
  const picture = xAvatarUrl(
    xAccount?.profilePictureUrl ?? linked.data?.imageUrl,
  );

  const rows = admin.data ? [{ label: "Admin console", href: "/admin" }] : [];

  return (
    <div
      data-open={open}
      inert={!open}
      className="motion-overlay fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 md:items-start md:justify-end md:p-6"
    >
      <button
        type="button"
        aria-label="Close menu"
        className="absolute inset-0"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Account menu"
        className="motion-panel relative max-h-[min(100%,40rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-[#383838] bg-[#111] p-4 text-white shadow-xl"
      >
        <ul className="flex flex-col">
          {rows.map((item) => (
            <li key={item.label}>
              <Link
                href={item.href}
                onClick={onClose}
                className="flex items-center justify-between py-3 text-base font-medium"
              >
                {item.label}
                <span aria-hidden="true" className="text-[#737373]">
                  ›
                </span>
              </Link>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => {
                onClose();
                if (authenticated) logout();
                else login();
              }}
              className="flex w-full items-center py-3 text-left text-base font-medium"
            >
              {authenticated ? "Log out" : "Log in"}
            </button>
          </li>
        </ul>
        {username ? (
          <div className="mt-2 flex items-center gap-3 rounded-xl border border-[#383838] bg-[#191919] p-3">
            {picture ? (
              <img
                src={picture}
                alt=""
                className="h-12 w-12 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#2a2a2a] text-sm font-semibold uppercase">
                {username.slice(0, 1)}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-base font-semibold">@{username}</p>
              {linked.data?.followers != null && (
                <p className="text-sm text-[#a3a3a3]">
                  {formatFollowers(linked.data.followers)} followers
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-2 rounded-xl border border-[#383838] bg-[#191919] p-3">
            <p className="text-sm text-[#a3a3a3]">
              Link X to launch your own profile token.
            </p>
            <button
              type="button"
              onClick={() => {
                onClose();
                if (authenticated) router.push("/onboarding");
                else login();
              }}
              className="mt-3 h-10 w-full rounded-lg bg-[#2a2a2a] text-sm font-semibold text-white"
            >
              {authenticated ? "Link X" : "Log in"}
            </button>
          </div>
        )}
        <div className="mt-4 border-t border-[#383838] pt-4 text-sm text-[#737373]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-wrap gap-x-3 gap-y-2">
              <Link href="/how-it-works" onClick={onClose}>
                About
              </Link>
              <Link href="/terms" onClick={onClose}>
                Terms
              </Link>
              <Link href="/terms" onClick={onClose}>
                Privacy
              </Link>
              <Link href="/docs" onClick={onClose}>
                Help
              </Link>
            </div>
            <a
              href="https://x.com/rovodotfun"
              aria-label="X"
              target="_blank"
              rel="noreferrer"
              className="inline-flex"
            >
              <AssetIcon src={icons.x} width={16} height={16} />
            </a>
          </div>
          <Link href="/docs" onClick={onClose} className="mt-3 inline-flex">
            Developers
          </Link>
          <p className="mt-3">© 2026 Rovo</p>
        </div>
      </div>
    </div>
  );
}

function xAvatarUrl(url: string | null | undefined) {
  if (!url) return null;
  return url.replace("_normal", "_bigger");
}

function formatFollowers(count: number) {
  if (count >= 1_000_000) {
    return `${trimCount(count / 1_000_000)}M`;
  }
  if (count >= 1_000) return `${trimCount(count / 1_000)}K`;
  return count.toLocaleString("en-US");
}

function trimCount(value: number) {
  return value.toFixed(1).replace(/\.0$/, "");
}

function sliceAddress(value: string) {
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <rect
        x="4.5"
        y="4.5"
        width="7"
        height="7"
        rx="1.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path
        d="M9.5 4.5V3.2A1.2 1.2 0 0 0 8.3 2H3.2A1.2 1.2 0 0 0 2 3.2v5.1A1.2 1.2 0 0 0 3.2 9.5H4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  );
}

function ChevronDown() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path
        d="M2.5 4.5 6 8l3.5-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const rovoTokenAddress = process.env.NEXT_PUBLIC_ROVO_TOKEN_ADDRESS;
const rovoCa =
  rovoTokenAddress && /^0x[a-fA-F0-9]{40}$/.test(rovoTokenAddress)
    ? rovoTokenAddress
    : null;

function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
  }, []);
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => {
        document.documentElement.dataset.theme = next;
        localStorage.setItem("rovo-theme", next);
        setTheme(next);
      }}
      className="flex size-10 shrink-0 items-center justify-center rounded-full text-white hover:bg-[#191919]"
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <circle cx="9" cy="9" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M9 1.8v1.8M9 14.4v1.8M1.8 9h1.8M14.4 9h1.8M3.7 3.7l1.3 1.3M13 13l1.3 1.3M13 5 14.3 3.7M3.7 14.3 5 13"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        d="M14.2 11.4A5.8 5.8 0 0 1 6.6 3.8 6.2 6.2 0 1 0 14.2 11.4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RovoAddress() {
  const toast = useToast();
  if (!rovoCa) return null;
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(rovoCa);
        toast.success("$ROVO address copied");
      }}
      className="hidden h-10 shrink-0 items-center gap-1.5 rounded-full px-2 text-xs font-medium text-white hover:bg-[#191919] sm:inline-flex sm:px-3 sm:text-sm"
    >
      $ROVO {sliceAddress(rovoCa)}
      <CopyIcon />
    </button>
  );
}

function Header({
  search,
  onSearch,
}: {
  search: string;
  onSearch: (value: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { authenticated, login, wallets, user, xAccount } = useRovoIdentity();
  const address = wallets[0]?.address ?? user?.wallet?.address;
  const linked = useXAccount(xAccount?.username ?? undefined);
  const picture = xAvatarUrl(
    xAccount?.profilePictureUrl ?? linked.data?.imageUrl,
  );
  const copyAddress = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };
  return (
    <>
      <header className={styles.header}>
        <Link
          href="/"
          aria-label="Rovo home"
          className="flex h-11 shrink-0 items-center md:hidden"
        >
          <RovoWordmark className="h-[22px] w-auto" />
        </Link>
        <div className="flex items-center justify-end gap-1 justify-self-end md:order-3">
          <RovoAddress />
          <ThemeToggle />
          {!authenticated && (
            <button
              type="button"
              aria-label="Open menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
              className="flex size-10 shrink-0 flex-col items-center justify-center gap-1 rounded-full hover:bg-[#191919] md:hidden"
            >
              <span className="h-0.5 w-4 rounded-full bg-white" />
              <span className="h-0.5 w-4 rounded-full bg-white" />
              <span className="h-0.5 w-4 rounded-full bg-white" />
            </button>
          )}
          {authenticated && address ? (
            <div className="flex items-center gap-1 rounded-full bg-[#191919] py-1 pl-1 pr-2.5 text-[13px] font-medium text-white md:gap-1.5 md:rounded-[10px] md:bg-[#ccff00] md:px-4 md:py-2 md:text-sm md:text-black">
              <button
                type="button"
                aria-label="Open account menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen(true)}
                className="flex items-center gap-1.5"
              >
                {picture ? (
                  <img
                    src={picture}
                    alt=""
                    className="size-7 rounded-full object-cover md:hidden"
                  />
                ) : null}
                {sliceAddress(address)}
                <ChevronDown />
              </button>
              <button
                type="button"
                aria-label={
                  copied ? "Wallet address copied" : "Copy wallet address"
                }
                onClick={copyAddress}
                className="hidden md:inline-flex"
              >
                <CopyIcon />
              </button>
            </div>
          ) : (
            <button
              className={styles.loginButton}
              type="button"
              onClick={() => login()}
            >
              Log in
            </button>
          )}
        </div>
        <label className={styles.searchBox}>
          <AssetIcon src={icons.search} width={16} height={16} />
          <span className={styles.srOnly}>Search tokens or creators</span>
          <input
            className={styles.searchInput}
            type="search"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Search for tokens creators..."
          />
        </label>
        <a
          href="https://x.com/rovodotfun"
          aria-label="X"
          target="_blank"
          rel="noreferrer"
          className="hidden size-10 shrink-0 items-center justify-center rounded-full hover:bg-[#191919] md:order-2 md:flex"
        >
          <AssetIcon src={icons.x} width={16} height={16} />
        </a>
      </header>
      <AccountMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}

function Footer() {
  return (
    <footer className={styles.footer} id="footer-links">
      <div className={styles.footerLinks}>
        <a href="https://x.com/rovodotfun" aria-label="X" target="_blank" rel="noreferrer">
          <AssetIcon src={icons.x} width={16} height={16} />
        </a>
        <a href="/rewards">Rewards</a>
        <a href="/how-it-works">How it works</a>
        <a href="/terms">Terms of Service</a>
        <a href="/docs">Docs</a>
      </div>
      <span className="shrink-0">© 2026 Rovo</span>
    </footer>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [search, setSearch] = useState("");
  const [pinnedOpen, setPinnedOpen] = useState(true);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { ready, authenticated, user, xAccount } = useRovoIdentity();
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    contentRef.current?.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    if (!ready || !authenticated || !user?.id || pathname === "/onboarding" || pathname.startsWith("/admin") || pathname.startsWith("/docs"))
      return;
    if (!xAccount && !onboardingSeen(user.id)) router.replace("/onboarding");
  }, [ready, authenticated, user?.id, xAccount, pathname, router]);

  useEffect(() => {
    if (!overlayOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOverlayOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [overlayOpen]);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const onChange = () => {
      if (desktop.matches) setOverlayOpen(false);
    };
    desktop.addEventListener("change", onChange);
    return () => desktop.removeEventListener("change", onChange);
  }, []);

  const toggleSidebar = () => {
    if (viewportKind() === "tablet") setOverlayOpen((open) => !open);
    else setPinnedOpen((open) => !open);
  };

  if (pathname.startsWith("/docs")) {
    return <div className="h-dvh overflow-y-auto bg-[#101110]">{children}</div>;
  }

  return (
    <SearchContext.Provider value={{ search, setSearch }}>
      <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-black">
        <div className="flex min-h-0 min-w-0 flex-1">
          <Sidebar
            pinnedOpen={pinnedOpen}
            overlayOpen={overlayOpen}
            onToggle={toggleSidebar}
            onNavigate={() => setOverlayOpen(false)}
          />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <Header search={search} onSearch={setSearch} />
            <div
              ref={contentRef}
              id="app-content"
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
            >
              {children}
            </div>
          </div>
        </div>
        <div className="max-md:hidden">
          <Footer />
        </div>
        <BottomNav />
      </div>
    </SearchContext.Provider>
  );
}
