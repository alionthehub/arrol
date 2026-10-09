import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const PATTERNS = [
  { name: "private-key", regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: "openai-key", regex: /sk-(?:proj|ant)-[A-Za-z0-9_-]{20,}/ },
  { name: "database-url", regex: /postgres(?:ql)?:\/\/[^:\s"'`]+:[^@\s"'`]{8,}@/ },
  { name: "session-secret", regex: /ARROL_SESSION_SECRET/ },
  { name: "setup-token", regex: /ARROL_SETUP_TOKEN/ },
  { name: "encryption-key", regex: /ARROL_ENCRYPTION_KEY/ },
  { name: "api-token", regex: /arrol_[A-Za-z0-9_-]{40,}/ },
];

export function findingsInBundle(directory) {
  const findings = [];
  const files = [];
  function walk(dir) {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(js|css|json|html|txt)$/.test(entry)) files.push(full);
    }
  }
  walk(directory);
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const pattern of PATTERNS) {
      if (pattern.regex.test(text)) {
        findings.push({ file, name: pattern.name });
      }
      pattern.regex.lastIndex = 0;
    }
  }
  return findings;
}

function main() {
  const directory = join(process.cwd(), ".next", "static");
  let findings = [];
  try {
    findings = findingsInBundle(directory);
  } catch {
    console.error("Client bundle scan failed: .next/static is missing.");
    process.exit(1);
  }
  if (findings.length > 0) {
    const names = [...new Set(findings.map((finding) => finding.name))].join(", ");
    console.error(`Client bundle contains secret-looking data. Names only: ${names}`);
    process.exit(1);
  }
  console.log("Client bundle scan passed.");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
