import { readFileSync } from "node:fs";

const mode = process.argv[2];
const prd = readFileSync(
  new URL("../PRD-ENGINEERING.md", import.meta.url),
  "utf8",
);

function requireText(fragment, message) {
  if (!prd.includes(fragment)) throw new Error(message);
}

function rejectText(fragment, message) {
  if (prd.includes(fragment)) throw new Error(message);
}

function verifyStructure() {
  const fences = prd.match(/^```/gm) ?? [];
  if (fences.length % 2 !== 0)
    throw new Error("Markdown code fences are unbalanced");

  const sections = [...prd.matchAll(/^## (\d+)\./gm)].map((match) =>
    Number(match[1]),
  );
  const expected = Array.from(
    { length: sections.length },
    (_, index) => index + 1,
  );
  if (JSON.stringify(sections) !== JSON.stringify(expected)) {
    throw new Error(
      `top-level sections are not sequential: ${sections.join(",")}`,
    );
  }
}

verifyStructure();

if (mode === "economics") {
  requireText("100–500 bps (1%–5%)", "creator tax range is missing");
  requireText(
    "total Rovo-controlled revenue",
    "combined Pons revenue definition is missing",
  );
  requireText(
    "Pons creator allocation + full creator tax",
    "creator tax aggregation rule is missing",
  );
  requireText(
    "persistent scout royalty",
    "persistent Rover royalty is missing",
  );
  requireText(
    "Rover 15",
    "claimed Scout example must preserve the Rover royalty",
  );
  requireText(
    "one X user ID → one Rovo profile token",
    "profile uniqueness invariant is missing",
  );
  requireText(
    "| **Total** | **100%** | **100%** |",
    "base split tables do not declare balanced totals",
  );
  rejectText(
    "Rover 0 (Rover only at launch-time bounty path",
    "obsolete Rover-zero example remains",
  );
  rejectText(
    "creator share only",
    "obsolete creator-share-only description remains",
  );
  rejectText("Claim: OAuth", "obsolete custom OAuth claim flow remains");
  rejectText("xUserId` if resolvable", "unbound Scout identity path remains");
  console.log("economics verification passed");
} else if (mode === "pons") {
  requireText("LaunchFeeCollectorFactory", "collector factory is missing");
  requireText(
    "one `LaunchFeeCollector` per profile token",
    "per-launch collector rule is missing",
  );
  requireText("previewLaunchEconomics", "economics pinning is missing");
  requireText("canLaunch", "Pons launch eligibility check is missing");
  requireText("buybackEnabled = false", "Pons buyback policy is missing");
  requireText("unswept", "unswept fee state is missing");
  requireText("swept but unclaimed", "escrow fee state is missing");
  requireText(
    "factory; FeeEscrow; MemeHook",
    "per-launch Pons stack storage is missing",
  );
  console.log("pons verification passed");
} else if (mode === "identity") {
  requireText("Privy", "Privy is missing");
  requireText("X/Twitter", "linked X identity is missing");
  requireText(
    "Privy access token",
    "server-side Privy verification is missing",
  );
  requireText(
    "linked-account webhooks",
    "Privy webhook synchronization is missing",
  );
  requireText("numeric X user ID", "stable X identifier is missing");
  requireText("EIP-712", "identity attestation is missing");
  console.log("identity verification passed");
} else if (mode === "stack") {
  for (const item of [
    "pnpm workspaces",
    "Turborepo",
    "Foundry",
    "Next.js",
    "Fastify",
    "PostgreSQL",
    "Drizzle ORM",
    "Ponder",
    "BullMQ",
    "WalletConnect",
    "Wagmi",
    "Viem",
  ])
    requireText(item, `${item} is missing from the selected stack`);
  requireText("Pons integration spike", "risk-first Pons milestone is missing");
  requireText("apps/web", "repository layout is missing");
  console.log("stack verification passed");
} else {
  throw new Error(
    "usage: node scripts/verify-prd.mjs economics|pons|identity|stack",
  );
}
