import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ASSIGNMENT =
  /\b(?:SECRET|PASSWORD|TOKEN|API_KEY|PRIVATE_KEY)\b\s*[:=]\s*["']([^"']{20,})["']/gi;

const PATTERNS = [
  {
    name: "private-key",
    regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  },
  { name: "aws-access-key", regex: /AKIA[0-9A-Z]{16}/ },
  { name: "github-token", regex: /ghp_[A-Za-z0-9]{20,}/ },
  { name: "openai-key", regex: /sk-(?:proj|ant)-[A-Za-z0-9_-]{20,}/ },
  {
    name: "database-url",
    regex: /postgres(?:ql)?:\/\/[^:\s"'`]+:([^@\s"'`]{8,})@/gi,
  },
];

const BENIGN_PASSWORDS = new Set([
  "placeholder",
  "password",
  "changeme",
  "example",
  "secret",
]);

export function findingsIn(filename, text) {
  const findings = [];
  if (
    /(^|\/)\.env(\.|$)/.test(filename) &&
    !filename.endsWith(".env.example")
  ) {
    findings.push({ file: filename, name: "env-file" });
    return findings;
  }

  if (filename.endsWith(".env.example")) {
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = /^([A-Z0-9_]+)=(.*)$/.exec(trimmed);
      if (match && match[2].trim() !== "") {
        findings.push({ file: filename, name: match[1] });
      }
    }
    return findings;
  }

  if (filename === "package-lock.json") return findings;

  for (const pattern of PATTERNS) {
    pattern.regex.lastIndex = 0;
    let match = pattern.regex.exec(text);
    while (match) {
      const secret = match[1] ?? "";
      if (!BENIGN_PASSWORDS.has(secret)) {
        findings.push({ file: filename, name: pattern.name });
      }
      if (!pattern.regex.global) break;
      match = pattern.regex.exec(text);
    }
  }

  ASSIGNMENT.lastIndex = 0;
  let assigned = ASSIGNMENT.exec(text);
  while (assigned) {
    if (!BENIGN_PASSWORDS.has(assigned[1])) {
      findings.push({ file: filename, name: "assigned-secret" });
    }
    assigned = ASSIGNMENT.exec(text);
  }

  return findings;
}

export function scanTracked(root = process.cwd()) {
  const listed = execFileSync("git", ["ls-files", "-z"], {
    cwd: root,
    encoding: "utf8",
  });
  const files = listed.split("\0").filter(Boolean);
  const findings = [];
  for (const file of files) {
    let text = "";
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    findings.push(...findingsIn(file, text));
  }
  return findings;
}

function main() {
  const findings = scanTracked();
  if (findings.length > 0) {
    const names = [...new Set(findings.map((finding) => finding.name))].join(", ");
    console.error(`Secret scan failed. Names only: ${names}`);
    for (const finding of findings) {
      console.error(`- ${finding.file}: ${finding.name}`);
    }
    process.exit(1);
  }
  console.log("Secret scan passed.");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
