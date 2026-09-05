export * from "./event";
export * from "./tenancy";
export * from "./api";
export * from "./consent";
export * from "./transfer";
export * from "./authorisation";
export * from "./audit";
export * from "./analytics";
export * from "./consent-analytics";
export * from "./consent-quality";
export * from "./consent-intelligence";
export * from "./discovery";
export * from "./scan";
export * from "./consent-config";

// `consent-proof` is deliberately NOT re-exported here.
//
// It imports `node:crypto`, and this barrel is what the browser SDK pulls in.
// Re-exporting it put a dynamic `require("crypto")` into the production bundle
// and broke it at load - caught by `sdk/scripts/verify-global.mjs`, which is
// exactly the failure that gate exists for. Import it by subpath instead:
//
//   import { proofHash } from "@rift-cmp/shared/consent-proof";
