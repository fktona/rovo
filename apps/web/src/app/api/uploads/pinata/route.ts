import { readFileSync } from "node:fs";
import path from "node:path";

const maxBytes = 5 * 1024 * 1024;

function pinataJwt() {
  const fromEnv = process.env.PINATA_JWT?.trim();
  if (fromEnv) return fromEnv;
  try {
    const file = readFileSync(path.join(process.cwd(), "../../.env"), "utf8");
    const line = file.split("\n").find((row) => row.startsWith("PINATA_JWT="));
    return line?.slice("PINATA_JWT=".length).trim().replace(/^"|"$/g, "") ?? "";
  } catch {
    return "";
  }
}

async function imageFile(form: FormData) {
  const image = form.get("image");
  if (image instanceof File) {
    if (!image.type.startsWith("image/"))
      throw new Error("Upload an image file.");
    if (image.size > maxBytes)
      throw new Error("Image must be 5 MB or smaller.");
    return image;
  }
  const raw = String(form.get("imageUrl") || "");
  if (!raw) throw new Error("An image file is required.");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Image URL is invalid.");
  }
  if (url.protocol !== "https:") throw new Error("Image URL must be https.");
  const response = await fetch(url);
  if (!response.ok) throw new Error("Could not download the token image.");
  const type =
    (response.headers.get("content-type") ?? "image/png").split(";")[0] ??
    "image/png";
  if (!type.startsWith("image/"))
    throw new Error("The token image URL is not an image.");
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > maxBytes)
    throw new Error("Image must be 5 MB or smaller.");
  return new File([bytes], "token-image", { type });
}

export async function POST(request: Request) {
  const jwt = pinataJwt();
  if (!jwt) {
    return Response.json(
      { error: "PINATA_JWT is not configured" },
      { status: 503 },
    );
  }
  try {
    const form = await request.formData();
    const image = await imageFile(form);
    const imageForm = new FormData();
    const filename = image.name || "token-image";
    imageForm.append("file", image, filename);
    imageForm.append("pinataMetadata", JSON.stringify({ name: filename }));
    const imageResponse = await fetch(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${jwt}` },
        body: imageForm,
      },
    );
    if (!imageResponse.ok)
      throw new Error(`Pinata image upload failed (${imageResponse.status})`);
    const imageJson = await imageResponse.json();
    const imageCid = imageJson.IpfsHash || imageJson.data?.cid;
    if (!imageCid) throw new Error("Pinata did not return an image CID");
    const imageUri = `https://gateway.pinata.cloud/ipfs/${imageCid}`;
    const website = String(form.get("website") || "") || undefined;
    let pairedAsset: Record<string, string> | undefined;
    const pairedAssetJson = String(form.get("pairedAsset") || "");
    if (pairedAssetJson) {
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(pairedAssetJson) as Record<string, unknown>;
      } catch {
        throw new Error("Invalid paired asset data");
      }
      if (typeof parsed.ticker === "string" && typeof parsed.name === "string") {
        pairedAsset = {
          ticker: parsed.ticker,
          name: parsed.name,
          group: typeof parsed.group === "string" ? parsed.group : "",
          image: typeof parsed.image === "string" ? parsed.image : "",
          mint: typeof parsed.mint === "string" ? parsed.mint : "",
        };
      }
    }
    const metadata = {
      name: String(form.get("name") || ""),
      symbol: String(form.get("symbol") || ""),
      description: String(form.get("description") || ""),
      image: imageUri,
      website,
      external_url: website,
      twitter: String(form.get("xLink") || "") || undefined,
      telegram: String(form.get("telegram") || "") || undefined,
      paired_asset: pairedAsset,
    };
    const metadataResponse = await fetch(
      "https://api.pinata.cloud/pinning/pinJSONToIPFS",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${jwt}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pinataContent: metadata,
          pinataMetadata: {
            name: `${metadata.symbol || metadata.name}-metadata`,
          },
        }),
      },
    );
    if (!metadataResponse.ok)
      throw new Error(
        `Pinata metadata upload failed (${metadataResponse.status})`,
      );
    const metadataJson = await metadataResponse.json();
    const metadataCid = metadataJson.IpfsHash;
    if (!metadataCid) throw new Error("Pinata did not return a metadata CID");
    return Response.json({
      imageUri,
      metadataUri: `ipfs://${metadataCid}`,
      metadata,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Pinata upload failed";
    const status = message === "Invalid paired asset data" ? 400 : 500;
    return Response.json({ error: message }, { status });
  }
}
