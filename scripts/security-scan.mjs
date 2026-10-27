import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
// Never print matched credentials or inspect ignored environment/credential files.
const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);
const report = {
  trackedFiles: files.length,
  textFiles: 0,
  binaryFiles: 0,
  sourceFiles: 0,
  apiRoutes: [],
  findings: [],
};
for (const file of files) {
  const data = await readFile(file);
  if (data.includes(0)) {
    report.binaryFiles++;
    continue;
  }
  report.textFiles++;
  if (/\.(js|mjs|cjs)$/.test(file)) report.sourceFiles++;
  if (/^app\/api\/.+\/route\.js$/.test(file)) report.apiRoutes.push(file);
  if (
    /(^|\/)(node_modules|\.git)\//.test(file) ||
    /^tests\//.test(file) ||
    file.endsWith(".example") ||
    file === path.relative(process.cwd(), new URL(import.meta.url).pathname)
  )
    continue;
  const source = data.toString("utf8");
  for (const [rule, expression] of [
    [
      "private-key-material",
      /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
    ],
    [
      "literal-server-credential",
      /(?:SUPABASE_SERVICE_ROLE_KEY|PAYPAL_CLIENT_SECRET|GOOGLE_CLIENT_SECRET|SESSION_SECRET)\s*[:=]\s*["'][A-Za-z0-9_+\/-]{32,}["']/g,
    ],
  ]) {
    let match;
    while ((match = expression.exec(source))) {
      report.findings.push({
        file,
        line: source.slice(0, match.index).split("\n").length,
        rule,
      });
    }
  }
}
if (process.argv.includes("--json"))
  console.log(JSON.stringify(report, null, 2));
else
  console.log(
    `Scanned ${report.trackedFiles} tracked files (${report.textFiles} text, ${report.binaryFiles} binary), ${report.sourceFiles} JavaScript sources and ${report.apiRoutes.length} API routes; ${report.findings.length} credential-pattern findings.`,
  );
if (report.findings.length) process.exitCode = 1;
