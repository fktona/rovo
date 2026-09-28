import { readFileSync } from "node:fs";
import path from "node:path";

const maxBytes = 5 * 1024 * 1024;

function pinataJwt() {
  const fromEnv = process.env.PINATA_JWT?.trim();
  if (fromEnv) return fromEnv;
  try {
    const file = readFileSync(path.join(process.cwd(), "../../.env"), "utf8");
    const line = file
      .split("\n")
      .find((row) => row.startsWith("PINATA_JWT="));
    return line?.slice("PINATA_JWT=".length).trim().replace(/^"|"$/g, "") ?? "";
  } catch {
    return "";
  }
}

export async function POST(request: Request) {
  const jwt = pinataJwt();
  if (!jwt) {
    return Response.json(
      { error: "Image upload is not configured." },
      { status: 503 },
    );
  }
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Choose an image." }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return Response.json({ error: "Upload an image file." }, { status: 400 });
  }
  if (file.size > maxBytes) {
    return Response.json(
      { error: "Image must be 5 MB or smaller." },
      { status: 400 },
    );
  }

  const body = new FormData();
  body.append("file", file, file.name || "token-image");
  body.append("network", "public");
  const upstream = await fetch("https://uploads.pinata.cloud/v3/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}` },
    body,
  });
  const payload = (await upstream.json().catch(() => null)) as {
    data?: { cid?: string };
    error?: string;
  } | null;
  const cid = payload?.data?.cid;
  if (!upstream.ok || !cid) {
    return Response.json(
      { error: "Image upload failed." },
      { status: 502 },
    );
  }
  return Response.json({
    url: `https://gateway.pinata.cloud/ipfs/${cid}`,
  });
}
