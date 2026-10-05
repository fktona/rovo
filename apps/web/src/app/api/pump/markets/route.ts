import { fetchPumpMarkets } from "@/lib/pump/client";
import { pumpError, readMints } from "@/lib/pump/http";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid market request" }, { status: 400 });
  }
  const mints = readMints(body);
  if (!mints) {
    return Response.json({ error: "Invalid mint list" }, { status: 400 });
  }
  try {
    return Response.json(await fetchPumpMarkets(mints));
  } catch (error) {
    return pumpError(error);
  }
}
