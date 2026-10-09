declare module "../scripts/check-secrets.mjs" {
  export function findingsIn(
    filename: string,
    text: string,
  ): Array<{ file: string; name: string }>;
  export function scanTracked(
    root?: string,
  ): Array<{ file: string; name: string }>;
}

declare module "../scripts/check-client-bundle.mjs" {
  export function findingsInBundle(
    directory: string,
  ): Array<{ file: string; name: string }>;
}
