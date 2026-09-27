import {
  encodeAbiParameters,
  keccak256,
  stringToBytes,
  zeroAddress,
  type Address,
  type Hex,
} from "viem";
import type { IssuedAttestation } from "../api";
import {
  asAddress,
  asBytes32,
  asSignature,
  asUint,
  requireDeadline,
} from "../validation";
import type { TokenMetadata, TradeInput } from "./types";

function requiredMessage(
  attestation: IssuedAttestation,
  field: string,
): string {
  const value = attestation.message[field];
  if (!value) throw new Error(`Attestation missing ${field}`);
  return value;
}

export function hashTokenMetadata(metadata: TokenMetadata): Hex {
  const socials = metadata.socials;
  const values = [
    metadata.name,
    metadata.symbol,
    metadata.logo,
    metadata.description,
    socials.twitter,
    socials.telegram,
    socials.discord,
    socials.website,
    socials.farcaster,
  ];
  for (const value of values)
    if (typeof value !== "string") throw new Error("Invalid token metadata");
  return keccak256(
    encodeAbiParameters(
      [
        "bytes32",
        "bytes32",
        "bytes32",
        "bytes32",
        "bytes32",
        "bytes32",
        "bytes32",
        "bytes32",
        "bytes32",
        "bytes32",
      ].map((type) => ({ type: type as "bytes32" })),
      [
        ...values.map((value) => keccak256(stringToBytes(value))),
        asBytes32(metadata.salt),
      ] as [Hex, Hex, Hex, Hex, Hex, Hex, Hex, Hex, Hex, Hex],
    ),
  );
}

function checkAttestation(
  attestation: IssuedAttestation,
  kind: IssuedAttestation["kind"],
  contract: Address,
  metadataHash?: Hex,
) {
  if (
    attestation.kind !== kind ||
    attestation.domain.chainId !== 4663 ||
    attestation.domain.verifyingContract.toLowerCase() !==
      contract.toLowerCase() ||
    attestation.domain.name !== "Rovo Identity" ||
    attestation.domain.version !== "1"
  ) {
    throw new Error("Attestation does not match this Rovo contract");
  }
  if (
    metadataHash &&
    attestation.message.metadataHash?.toLowerCase() !==
      metadataHash.toLowerCase()
  ) {
    throw new Error("Attestation metadata does not match the launch");
  }
  requireDeadline(
    asUint(requiredMessage(attestation, "deadline"), 256, "deadline"),
  );
  return {
    xUserId: asUint(requiredMessage(attestation, "xUserId"), 64, "X user ID"),
    nonce: asUint(requiredMessage(attestation, "nonce"), 256, "nonce"),
    deadline: asUint(requiredMessage(attestation, "deadline"), 256, "deadline"),
    handle: requiredMessage(attestation, "handle"),
    signature: asSignature(attestation.signature),
  };
}

export function selfRoveAttestationArgs(
  attestation: IssuedAttestation,
  wrapper: Address,
  metadata: TokenMetadata,
  account: Address,
) {
  const fields = checkAttestation(
    attestation,
    "self_rove",
    wrapper,
    hashTokenMetadata(metadata),
  );
  if (
    attestation.primaryType !== "SelfRoveAttestation" ||
    attestation.message.recipient?.toLowerCase() !== account.toLowerCase()
  )
    throw new Error("Attestation wallet mismatch");
  return {
    xUserId: fields.xUserId,
    handle: fields.handle,
    metadataHash: asBytes32(requiredMessage(attestation, "metadataHash")),
    recipient: asAddress(requiredMessage(attestation, "recipient")),
    nonce: fields.nonce,
    deadline: fields.deadline,
    signature: fields.signature,
  };
}

export function scoutAttestationArgs(
  attestation: IssuedAttestation,
  wrapper: Address,
  metadata: TokenMetadata,
) {
  const fields = checkAttestation(
    attestation,
    "scout",
    wrapper,
    hashTokenMetadata(metadata),
  );
  if (attestation.primaryType !== "ScoutProfileAttestation")
    throw new Error("Wrong attestation type");
  return {
    xUserId: fields.xUserId,
    handle: fields.handle,
    metadataHash: asBytes32(requiredMessage(attestation, "metadataHash")),
    nonce: fields.nonce,
    deadline: fields.deadline,
    signature: fields.signature,
  };
}

export function claimAttestationArgs(
  attestation: IssuedAttestation,
  nottingham: Address,
  token: Address,
  account: Address,
) {
  const fields = checkAttestation(attestation, "claim", nottingham);
  if (
    attestation.primaryType !== "ClaimAttestation" ||
    attestation.message.profileToken?.toLowerCase() !== token.toLowerCase() ||
    attestation.message.recipient?.toLowerCase() !== account.toLowerCase()
  )
    throw new Error("Claim attestation target mismatch");
  return {
    xUserId: fields.xUserId,
    handle: fields.handle,
    recipient: account,
    profileToken: token,
    nonce: fields.nonce,
    deadline: fields.deadline,
    signature: fields.signature,
  };
}

export function tradeValue(input: TradeInput): bigint {
  if (
    input.amountIn <= 0n ||
    input.minPairOut <= 0n ||
    input.minProfileOut <= 0n
  )
    throw new Error("Invalid trade amounts");
  requireDeadline(input.deadline);
  return input.inputToken.toLowerCase() === zeroAddress ? input.amountIn : 0n;
}
