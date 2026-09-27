type ErrorLike = {
  name?: string;
  message?: string;
  shortMessage?: string;
  details?: string;
  cause?: unknown;
};

const RULES: Array<{ test: RegExp; message: string }> = [
  {
    test: /user rejected|user denied|rejected the request|denied transaction signature|action_rejected|userrejectedrequest/i,
    message: "You cancelled this in your wallet.",
  },
  {
    test: /insufficient funds|exceeds the balance|insufficient balance|gas required exceeds/i,
    message: "Your wallet doesn't have enough to cover this and the network fee.",
  },
  {
    test: /does not match the target chain|chain mismatch|wrong network|switch chain|unsupported chain/i,
    message: "Switch your wallet to Robinhood Chain, then try again.",
  },
  {
    test: /nonce too low|replacement transaction underpriced|already known|transaction already imported/i,
    message: "A transaction is already waiting in your wallet. Finish or cancel it, then try again.",
  },
  {
    test: /connector not connected|provider not found|no ethereum provider/i,
    message: "Connect your wallet and try again.",
  },
  {
    test: /requested resource not available|eth_getBlockByNumber|rpc endpoint returned too many errors/i,
    message:
      "Robinhood Chain is temporarily unavailable. Check your wallet before retrying. The transaction may not have been sent.",
  },
  {
    test: /too little received|insufficient_output_amount|insufficient output amount|price slippage check/i,
    message: "The price moved past your slippage. Try again or raise slippage.",
  },
];

function unwrap(error: unknown): ErrorLike[] {
  const nodes: ErrorLike[] = [];
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === "object" && !seen.has(current) && nodes.length < 6) {
    seen.add(current);
    nodes.push(current as ErrorLike);
    const cause = (current as ErrorLike).cause;
    current = cause === current ? undefined : cause;
  }
  if (typeof error === "string" && error.trim()) nodes.push({ message: error });
  return nodes;
}

function textOf(node: ErrorLike) {
  return [node.name, node.shortMessage, node.details, node.message]
    .filter((part): part is string => typeof part === "string" && part.length > 0)
    .join("\n");
}

function isDump(value: string) {
  return /request arguments|version:\s*viem@|details:\s*|0x[a-fA-F0-9]{16,}/i.test(value);
}

function tidy(value: string) {
  const line = value.replace(/0x[a-fA-F0-9]{8,}/g, "").replace(/\s+/g, " ").trim().replace(/[.]+$/, "");
  if (!line || line.length > 160 || isDump(line)) return null;
  return `${line}.`;
}

function readableLine(node: ErrorLike) {
  const raw =
    node.shortMessage ||
    node.message
      ?.split("\n")
      .map((line) => line.trim())
      .find(Boolean) ||
    "";
  if (!raw || isDump(raw)) return null;
  return tidy(raw);
}

function contractMessage(text: string) {
  if (!/execution reverted|contract function [\s\S]* reverted|call revert/i.test(text)) return null;
  const reason = text.match(/(?:execution reverted|reverted with reason):\s*["']?([^"'\n]+)/i)?.[1]?.trim();
  if (reason) {
    const cleaned = tidy(reason.replace(/^with reason string\s*/i, ""));
    if (cleaned && !/^execution reverted/i.test(cleaned)) return cleaned;
  }
  return "The contract rejected this transaction.";
}

export function formatWalletMessage(
  error: unknown,
  fallback = "Something went wrong. Try again.",
) {
  const nodes = unwrap(error);
  if (nodes.length === 0) return fallback;
  const text = nodes.map(textOf).join("\n");
  const known = RULES.find((rule) => rule.test.test(text));
  if (known) return known.message;
  const reverted = contractMessage(text);
  if (reverted) return reverted;
  for (const node of nodes) {
    const line = readableLine(node);
    if (line) return line;
  }
  return fallback;
}
