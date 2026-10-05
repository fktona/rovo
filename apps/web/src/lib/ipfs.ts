const PINATA_GATEWAY = "https://gateway.pinata.cloud/ipfs/";

export function ipfsUrl(value: string | null | undefined) {
  const cid = ipfsCid(value);
  return cid ? `${PINATA_GATEWAY}${cid}` : value || "";
}

function ipfsCid(value: string | null | undefined) {
  if (!value) return null;
  if (value.startsWith("ipfs://")) {
    return value.slice("ipfs://".length).replace(/^ipfs\//, "");
  }
  try {
    const match = new URL(value).pathname.match(/\/ipfs\/([^/?#]+)/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}
