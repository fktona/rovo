import catalogue from "../../../../../../packages/config/pons-pair-tokens.json";
import { isCatalogueIconPath } from "@/lib/pairs";

export async function GET(request: Request) {
  const path = new URL(request.url).searchParams.get("path") ?? "";
  if (!isCatalogueIconPath(path)) {
    return new Response(null, { status: 404 });
  }
  const upstream = await fetch(new URL(path, catalogue.iconBaseUrl), {
    next: { revalidate: 86_400 },
  });
  if (!upstream.ok) return new Response(null, { status: 502 });
  return new Response(await upstream.arrayBuffer(), {
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "image/svg+xml",
      "cache-control": "public, max-age=86400",
    },
  });
}
