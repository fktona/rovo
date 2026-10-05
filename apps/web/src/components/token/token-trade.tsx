"use client";

import { PumpTradePanel } from "./pump-trade-panel";

export function TokenTradePanel({ token }: { token: string }) {
  return <PumpTradePanel mint={token} />;
}
