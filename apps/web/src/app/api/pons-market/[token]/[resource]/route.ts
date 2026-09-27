const tokenPattern = /^0x[a-fA-F0-9]{40}$/;
const resources = new Set(["chart", "trades", "holders"]);
const chartRanges = new Set(["5m", "1h", "6h", "1d", "all"]);

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string; resource: string }> },
) {
  const { token, resource } = await context.params;
  if (!tokenPattern.test(token) || !resources.has(resource)) {
    return Response.json({ error: "invalid market request" }, { status: 400 });
  }
  const range = new URL(request.url).searchParams.get("range") ?? "all";
  if (resource === "chart" && !chartRanges.has(range)) {
    return Response.json({ error: "invalid chart range" }, { status: 400 });
  }
  const path =
    resource === "chart"
      ? `chart?range=${range}`
      : resource;
  const upstream = await fetch(
    `https://www.ponsfamily.com/api/pons-v2-market/${token}/${path}`,
    { cache: "no-store" },
  );
  if (!upstream.ok) {
    return Response.json(
      { error: "market data unavailable" },
      { status: upstream.status },
    );
  }
  return Response.json(await upstream.json());
}
