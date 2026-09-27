import { createRequire } from "node:module";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const workspace = resolve(
  fileURLToPath(new URL("../..", import.meta.url)),
);
export const contractsRoot = join(workspace, "packages/contracts");
export const requireFromContracts = createRequire(
  join(contractsRoot, "package.json"),
);

function solidityFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? solidityFiles(path)
      : entry.name.endsWith(".sol")
        ? [path]
        : [];
  });
}

export function compileContracts() {
  const solc = requireFromContracts("solc");
  const sources = Object.fromEntries(
    [
      ...solidityFiles(join(contractsRoot, "src")),
      ...solidityFiles(join(contractsRoot, "test")),
    ].map((path) => [
      relative(contractsRoot, path),
      { content: readFileSync(path, "utf8") },
    ]),
  );
  const output = JSON.parse(
    solc.compile(
      JSON.stringify({
        language: "Solidity",
        sources,
        settings: {
          optimizer: { enabled: true, runs: 10_000 },
          viaIR: true,
          evmVersion: "cancun",
          outputSelection: {
            "*": {
              "*": [
                "abi",
                "evm.bytecode.object",
                "evm.deployedBytecode.object",
              ],
            },
          },
        },
      }),
      {
        import(path) {
          const candidates = [
            join(contractsRoot, path),
            join(contractsRoot, "node_modules", path),
          ];
          const match = candidates.find(existsSync);
          return match
            ? { contents: readFileSync(match, "utf8") }
            : { error: `Import not found: ${path}` };
        },
      },
    ),
  );
  const errors = (output.errors ?? []).filter(
    (entry) => entry.severity === "error",
  );
  if (errors.length)
    throw new Error(errors.map((entry) => entry.formattedMessage).join("\n"));
  return {
    output,
    sourceCount: Object.keys(sources).length,
    solcVersion: solc.version(),
  };
}

export function artifact(output, source, name) {
  const contract = output.contracts?.[source]?.[name];
  if (!contract?.evm?.bytecode?.object)
    throw new Error(`Missing artifact ${source}:${name}`);
  return { abi: contract.abi, bytecode: `0x${contract.evm.bytecode.object}` };
}
