"use client";

import { useMemo, useState } from "react";
import { AssetIcon } from "../home/assets";

const asset = (name: string) => `/figma-launch/${name}`;
const icons = {
  search: asset("search.svg"),
  avatar: asset("avatar-placeholder.svg"),
  scoutAvatar: asset("scout-avatar.svg"),
  apple: asset("aaplx.png"),
  usdg: asset("usdg.png"),
};

type Mode = "self" | "scout";
type Category = "All" | "xStocks" | "Crypto";

const steps = ["Identity", "Pair", "First Buy", "Review"];
const card =
  "w-full max-w-3xl rounded-[20px] bg-surface px-4 py-6 sm:px-8 sm:py-8";
const field =
  "w-full rounded-[8px] border border-line bg-surface-raised px-4 py-3 text-base text-foreground outline-none placeholder:text-muted focus:border-accent";
const primary =
  "flex items-center justify-center rounded-[10px] bg-action px-6 py-3 text-base font-semibold text-ink transition hover:bg-action-hover disabled:cursor-not-allowed disabled:opacity-50";
const secondary =
  "flex items-center justify-center rounded-[8px] border border-line px-6 py-3 text-base font-medium text-foreground transition hover:border-line";

function ModeSwitch({
  mode,
  onChange,
}: {
  mode: Mode;
  onChange: (mode: Mode) => void;
}) {
  return (
    <div
      className="flex w-full max-w-xs rounded-[5px] bg-surface-raised p-1"
      role="tablist"
      aria-label="Launch type"
    >
      <button
        type="button"
        role="tab"
        aria-selected={mode === "self"}
        onClick={() => onChange("self")}
        className={`flex-1 rounded-[5px] px-3 py-2 text-base font-medium ${mode === "self" ? "border border-accent bg-action text-ink" : "bg-surface-raised text-muted"}`}
      >
        Self-Rove
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === "scout"}
        onClick={() => onChange("scout")}
        className={`flex-1 rounded-[5px] px-3 py-2 text-base font-medium ${mode === "scout" ? "border border-accent bg-action text-ink" : "bg-surface-raised text-muted"}`}
      >
        Scout
      </button>
    </div>
  );
}

function Intro({ mode }: { mode: Mode }) {
  return (
    <div className="mt-[18px]">
      <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
        {mode === "self" ? (
          <>
            Put a person
            <br />
            on the market.
          </>
        ) : (
          <>
            Scout someone
            <br />
            before they launch.
          </>
        )}
      </h1>
      <p className="mt-[5px] text-[16px] font-medium tracking-[0.32px] text-muted">
        {mode === "self"
          ? "Launch yourself or discover someone before they do."
          : "Launch a public X profile and become its Rover."}
      </p>
    </div>
  );
}

function StepIndicator({ step }: { step: number }) {
  return (
    <ol
      className="mt-[35px] flex flex-wrap gap-x-[24px] gap-y-2"
      aria-label="Self-Rove progress"
    >
      {steps.map((label, index) => (
        <li
          key={label}
          className={`whitespace-nowrap text-[14px] ${index + 1 === step ? "text-accent" : "text-muted"}`}
        >
          {String(index + 1).padStart(2, "0")} {label}
        </li>
      ))}
    </ol>
  );
}

function FlowActions({
  back,
  next,
  nextLabel = "Continue",
  disabled = false,
}: {
  back?: () => void;
  next: () => void;
  nextLabel?: string;
  disabled?: boolean;
}) {
  return (
    <div className="mt-[32px] flex gap-[14px]">
      {back && (
        <button type="button" onClick={back} className={`${secondary} px-6`}>
          Back
        </button>
      )}
      <button
        type="button"
        onClick={next}
        disabled={disabled}
        className={`${primary} flex-1`}
      >
        {nextLabel}
      </button>
    </div>
  );
}

function ProfileIdentity({
  scout = false,
  handle,
}: {
  scout?: boolean;
  handle?: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <AssetIcon
        src={scout ? icons.scoutAvatar : icons.avatar}
        width={58}
        height={58}
      />
      <div className="min-w-0">
        <div className="text-[18px] font-semibold">
          {scout
            ? (handle?.replace(/^@/, "") || "Elonmusk2").replace(
                /^./,
                (letter) => letter.toUpperCase(),
              )
            : "Jules Moreau"}
        </div>
        <div className="mt-0.5 break-words text-sm text-muted">
          {scout
            ? `${handle || "@elonmusk2"} · ${handle?.toLowerCase() === "@elonmusk2" ? "217.9K followers" : "Profile preview"}`
            : "@jules_trades · 12.5K followers"}
        </div>
      </div>
    </div>
  );
}

function AssetPicker({
  selected,
  onSelect,
  category,
  onCategory,
  search,
  onSearch,
}: {
  selected: number;
  onSelect: (index: number) => void;
  category: Category;
  onCategory: (value: Category) => void;
  search: string;
  onSearch: (value: string) => void;
}) {
  const visible = useMemo(
    () =>
      category !== "Crypto" &&
      "aaplx apple".includes(search.trim().toLowerCase()),
    [category, search],
  );
  return (
    <section aria-label="Choose pair asset">
      <p className="text-base">Pair with</p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-center gap-2 rounded-[10px] bg-surface p-2">
          {(["All", "xStocks", "Crypto"] as Category[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onCategory(option)}
              aria-pressed={category === option}
              className={`rounded-[5px] border px-3 py-1.5 text-sm sm:text-base ${category === option ? "border-accent bg-surface-raised text-muted" : "border-transparent bg-surface-raised text-muted"}`}
            >
              {option}
            </button>
          ))}
        </div>
        <label className="flex min-w-0 flex-1 items-center gap-1 rounded-[10px] bg-surface-raised px-3 py-2.5 sm:max-w-xs">
          <AssetIcon src={icons.search} width={16} height={16} />
          <span className="sr-only">Search assets</span>
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Search..."
            className="min-w-0 w-full bg-transparent text-[12px] outline-none placeholder:text-muted"
          />
        </label>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible ? (
          Array.from({ length: 9 }, (_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => onSelect(index)}
              aria-pressed={selected === index}
              className={`flex items-center gap-3 rounded-[10px] border bg-surface-raised px-4 py-3 text-left transition hover:border-accent ${selected === index ? "border-accent" : "border-transparent"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={icons.apple} alt="" width={34} height={34} />
              <span>
                <strong className="block text-[16px] font-normal">AAPLx</strong>
                <span className="text-[16px] text-muted">Apple</span>
              </span>
            </button>
          ))
        ) : (
          <p className="col-span-full py-7 text-center text-muted">
            No assets match your search.
          </p>
        )}
      </div>
    </section>
  );
}

function IdentityStep({ next }: { next: () => void }) {
  return (
    <div className="mt-[8px]">
      <h2 className="text-xl font-bold leading-snug sm:text-2xl">
        Verify your identity
      </h2>
      <div className="mb-[33px] mt-[14px] h-px bg-surface-raised" />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <ProfileIdentity />
        <span className="text-[14px] text-positive">Identity verified ✓</span>
      </div>
      <div className="mt-[10px]">
        <FlowActions next={next} />
      </div>
    </div>
  );
}

function PairStep(
  props: Parameters<typeof AssetPicker>[0] & {
    back: () => void;
    next: () => void;
  },
) {
  return (
    <div className="mt-[37px]">
      <h2 className="text-xl font-bold leading-snug sm:text-2xl">
        Choose your Stock Token
      </h2>
      <p className="mt-[7px] text-[15px] text-muted">
        Your profile token will trade against this asset.
      </p>
      <div className="mt-[36px]">
        <AssetPicker {...props} />
      </div>
      <FlowActions back={props.back} next={props.next} />
    </div>
  );
}

function FirstBuyStep({
  amount,
  onAmount,
  back,
  next,
}: {
  amount: string;
  onAmount: (value: string) => void;
  back: () => void;
  next: () => void;
}) {
  return (
    <div className="mt-[39px]">
      <h2 className="text-[22px] font-semibold">Start your market</h2>
      <p className="mt-[7px] text-[15px] text-muted">Optional first buy.</p>
      <div className="mt-[54px]">
        <label
          htmlFor="first-buy"
          className="mb-[13px] block text-[16px] font-medium"
        >
          Initial Buy
        </label>
        <input
          id="first-buy"
          inputMode="decimal"
          value={amount}
          onChange={(event) => onAmount(event.target.value)}
          placeholder="e.g 0.01 ETH"
          className={field}
        />
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {["0.05", "0.1", "1", "5"].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onAmount(value)}
              className={`rounded-[7px] border px-2 py-2 text-sm ${amount === value ? "border-accent text-accent" : "border-line bg-surface-raised text-muted"}`}
            >
              {value} ETH
            </button>
          ))}
        </div>
      </div>
      <div className="mt-[61px] flex items-center justify-between border-t border-line pt-[17px] text-[14px]">
        <span className="text-muted">Estimated profile tokens</span>
        <strong>0 @jules_trades</strong>
      </div>
      <FlowActions back={back} next={next} />
    </div>
  );
}

function FeeDistribution() {
  return (
    <div className="mt-8 rounded-[8px] border border-line bg-surface-raised px-4 py-4 sm:px-5">
      <div className="mb-[13px] text-[14px] font-medium">Fee distribution</div>
      <div className="flex h-[9px] overflow-hidden rounded-full">
        <span className="w-[70%] bg-action" />
        <span className="w-[20%] bg-[#9a68ff]" />
        <span className="w-[10%] bg-[#ff8d42]" />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3 sm:text-sm">
        <span>
          <i className="mr-2 inline-block h-[9px] w-[9px] rounded-full bg-action" />
          Creators <strong>70%</strong>
        </span>
        <span>
          <i className="mr-2 inline-block h-[9px] w-[9px] rounded-full bg-[#9a68ff]" />
          Holders <strong>20%</strong>
        </span>
        <span>
          <i className="mr-2 inline-block h-[9px] w-[9px] rounded-full bg-[#ff8d42]" />
          Platform <strong>10%</strong>
        </span>
      </div>
    </div>
  );
}

function ReviewStep({
  amount,
  back,
  next,
  done,
}: {
  amount: string;
  back: () => void;
  next: () => void;
  done: boolean;
}) {
  return (
    <div className="mt-[40px]">
      <div className="flex min-w-0 items-center gap-4">
        <AssetIcon src={icons.avatar} width={58} height={58} />
        <strong className="min-w-0 truncate text-xl font-bold tracking-tight sm:text-2xl">
          @jules_trades
        </strong>
      </div>
      <div className="my-[36px] h-px bg-surface-raised" />
      <div className="flex items-center justify-between py-[5px] text-[15px]">
        <span className="text-muted">Pair</span>
        <span className="flex items-center gap-[9px] font-medium">
          <AssetIcon src={icons.usdg} width={39} height={39} /> USDG
        </span>
      </div>
      <div className="mt-[15px] flex items-center justify-between text-[15px]">
        <span className="text-muted">First buy</span>
        <strong>
          {amount && Number(amount) > 0 ? `${amount} ETH` : "Skipped"}
        </strong>
      </div>
      <div className="mt-[31px] h-px bg-surface-raised" />
      <FeeDistribution />
      {done && (
        <p
          role="status"
          className="mt-5 text-center text-[14px] text-accent"
        >
          Your launch details are ready.
        </p>
      )}
      <FlowActions back={back} next={next} />
    </div>
  );
}

function ScoutStart({
  handle,
  onHandle,
  next,
}: {
  handle: string;
  onHandle: (value: string) => void;
  next: () => void;
}) {
  return (
    <div className="mt-[41px]">
      <label
        htmlFor="scout-handle"
        className="mb-[13px] block text-[16px] font-medium"
      >
        Enter X handle
      </label>
      <input
        id="scout-handle"
        value={handle}
        onChange={(event) => onHandle(event.target.value)}
        placeholder="@SAMA"
        className={field}
      />
      <FlowActions next={next} />
    </div>
  );
}

function ScoutDetails(
  props: Parameters<typeof AssetPicker>[0] & {
    handle: string;
    onHandle: (value: string) => void;
    back: () => void;
  },
) {
  const [foundHandle, setFoundHandle] = useState(props.handle || "@elonmusk2");
  return (
    <div className="mt-[39px]">
      <label
        htmlFor="scout-find"
        className="mb-[13px] block text-[16px] font-medium"
      >
        Enter X handle
      </label>
      <input
        id="scout-find"
        value={props.handle}
        onChange={(event) => props.onHandle(event.target.value)}
        placeholder="@elonmusk2"
        className={field}
      />
      <button
        type="button"
        onClick={() => setFoundHandle(props.handle.trim() || "@elonmusk2")}
        className="mt-3 w-full rounded-[8px] border border-accent px-4 py-2.5 text-[15px] font-semibold text-accent"
      >
        Find profile
      </button>
      <div className="mt-[24px]">
        <ProfileIdentity scout handle={foundHandle} />
      </div>
      <div className="mt-[33px]">
        <AssetPicker {...props} />
      </div>
      <div className="mt-10 grid gap-8 sm:grid-cols-2">
        <div>
          <h2 className="text-[16px] font-medium">Your Rover Royalty</h2>
          <strong className="mt-1 block text-4xl font-bold leading-tight tracking-tight text-accent">
            15%
          </strong>
          <p className="mt-1 max-w-xs text-xs text-muted">
            You earn the Rover share for discovering this market.
          </p>
        </div>
        <div>
          <h2 className="text-[16px] font-medium">Creator Nottingham Vault</h2>
          <strong className="mt-1 block text-4xl font-bold leading-tight tracking-tight text-accent">
            60%
          </strong>
          <p className="mt-[4px] text-[12px] text-muted">
            The creator’s share accumulates until they claim their market.
          </p>
        </div>
      </div>
      <div className="mt-8 flex flex-wrap items-center gap-4 text-xs">
        <span>Pair</span>
        <span className="text-muted">@salmapara</span>
      </div>
      <button
        type="button"
        onClick={props.back}
        className="mt-[32px] text-[13px] text-muted hover:text-foreground"
      >
        Back
      </button>
    </div>
  );
}

export function LaunchFlow() {
  const [mode, setMode] = useState<Mode>("self");
  const [selfStep, setSelfStep] = useState(1);
  const [scoutStep, setScoutStep] = useState(1);
  const [category, setCategory] = useState<Category>("All");
  const [pairSearch, setPairSearch] = useState("");
  const [selectedPair, setSelectedPair] = useState(0);
  const [firstBuy, setFirstBuy] = useState("");
  const [handle, setHandle] = useState("");
  const [reviewDone, setReviewDone] = useState(false);
  const picker = {
    selected: selectedPair,
    onSelect: setSelectedPair,
    category,
    onCategory: setCategory,
    search: pairSearch,
    onSearch: setPairSearch,
  };
  const scrollToTop = () =>
    document
      .getElementById("app-content")
      ?.scrollTo({ top: 0, behavior: "smooth" });
  const changeMode = (next: Mode) => {
    setMode(next);
    scrollToTop();
  };
  const changeSelfStep = (next: number) => {
    setSelfStep(next);
    scrollToTop();
  };
  const changeScoutStep = (next: number) => {
    setScoutStep(next);
    scrollToTop();
  };
  return (
    <main className="mx-auto flex w-full max-w-5xl justify-center px-4 py-6 sm:px-6 lg:py-10">
      <div className={card}>
        <ModeSwitch mode={mode} onChange={changeMode} />
        <Intro mode={mode} />
        <div
          key={`${mode}-${mode === "self" ? selfStep : scoutStep}`}
          className="motion-content"
        >
          {mode === "self" ? (
            <>
              <StepIndicator step={selfStep} />
              {selfStep === 1 && (
                <IdentityStep next={() => changeSelfStep(2)} />
              )}
              {selfStep === 2 && (
                <PairStep
                  {...picker}
                  back={() => changeSelfStep(1)}
                  next={() => changeSelfStep(3)}
                />
              )}
              {selfStep === 3 && (
                <FirstBuyStep
                  amount={firstBuy}
                  onAmount={setFirstBuy}
                  back={() => changeSelfStep(2)}
                  next={() => changeSelfStep(4)}
                />
              )}
              {selfStep === 4 && (
                <ReviewStep
                  amount={firstBuy}
                  back={() => changeSelfStep(3)}
                  next={() => setReviewDone(true)}
                  done={reviewDone}
                />
              )}
            </>
          ) : scoutStep === 1 ? (
            <ScoutStart
              handle={handle}
              onHandle={setHandle}
              next={() => {
                if (!handle.trim()) setHandle("@elonmusk2");
                changeScoutStep(2);
              }}
            />
          ) : (
            <ScoutDetails
              {...picker}
              handle={handle}
              onHandle={setHandle}
              back={() => changeScoutStep(1)}
            />
          )}
        </div>
      </div>
    </main>
  );
}
