import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const REPORTS_DIR = path.join(root, 'public', 'reports');
const OUTPUT_PDF = path.join(REPORTS_DIR, 'entropy-release-latest.pdf');
const OUTPUT_META = path.join(REPORTS_DIR, 'entropy-release-latest.meta.json');

async function readJson(relPath) {
  const raw = await fs.readFile(path.join(root, relPath), 'utf8');
  return JSON.parse(raw);
}

async function loadContinuitySnapshots() {
  const entries = await fs.readdir(path.join(root, 'data'));
  const snapshotFiles = entries
    .filter((name) => /^dyson-state\.snapshot\.v\d+\.json$/i.test(name))
    .sort((a, b) => {
      const av = Number(a.match(/v(\d+)/i)?.[1] || 0);
      const bv = Number(b.match(/v(\d+)/i)?.[1] || 0);
      return bv - av;
    });

  const snapshots = [];
  for (const file of snapshotFiles) {
    const payload = await readJson(path.join('data', file));
    snapshots.push({ file, payload });
  }

  return snapshots;
}

function hashSha256(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function buildSignature({ generatedAt, ring3Releases, continuitySnapshots }) {
  const signatureKey = process.env.ENTROPY_RELEASE_SIGNING_KEY || 'local-dev-signing-key';
  const payload = JSON.stringify({ generatedAt, ring3Releases, continuitySnapshots });
  return hashSha256(`${signatureKey}:${payload}`);
}

function escapePdfText(input) {
  return String(input)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function buildPdfDocument(lines) {
  const pageHeight = 792;
  const startY = 750;
  const lineHeight = 14;
  const contentLines = lines.map((line, index) => {
    const y = startY - index * lineHeight;
    return `BT /F1 11 Tf 50 ${y} Td (${escapePdfText(line)}) Tj ET`;
  });

  const contentStream = `${contentLines.join('\n')}\n`;

  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj',
    `4 0 obj << /Length ${Buffer.byteLength(contentStream, 'utf8')} >> stream\n${contentStream}endstream endobj`,
    '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];

  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += `${obj}\n`;
  }

  const xrefStart = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }

  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefStart}\n%%EOF\n`;

  return Buffer.from(pdf, 'utf8');
}

async function main() {
  const progression = await readJson('data/dyson-progression.manifest.json');
  const continuityManifest = await readJson('data/dyson-continuity.manifest.json');
  const continuitySnapshots = await loadContinuitySnapshots();

  const generatedAt = new Date().toISOString();
  const ring3Releases = Object.entries(progression?.spheres || {}).map(([sphereId, sphere]) => ({
    sphereId,
    stateVersion: sphere?.stateVersion ?? 'missing',
    contentDelta: sphere?.contentDelta ?? 'missing',
    simulationMilestone: sphere?.simulationMilestone ?? 'missing',
    ring3Health: String(sphere?.contentDelta || '').toLowerCase().includes('ring3') ? 'ring3-verified' : 'ring3-monitor',
  }));

  const latestContinuity = continuitySnapshots[0] || null;
  const gateState = continuityManifest?.releaseChannel === 'stable' ? 'gate-open-stable' : 'gate-review';

  const signature = buildSignature({ generatedAt, ring3Releases, continuitySnapshots });

  const lines = [
    'Entropy Release Bulletin',
    `Generated: ${generatedAt}`,
    `Build: ${progression?.buildId || 'unknown'}   Release: ${progression?.releaseVersion || 'unknown'}`,
    `Gate State Marker: ${gateState}`,
    `Continuity Policy: ${continuityManifest?.policyVersion || 'unknown'} (${continuityManifest?.releaseChannel || 'unknown'})`,
    `Signature (sha256): ${signature}`,
    '',
    'Ring3 Entropy Release Markers:',
    ...ring3Releases.flatMap((release) => [
      `- ${release.sphereId} | state=${release.stateVersion} | delta=${release.contentDelta}`,
      `  milestone=${release.simulationMilestone} | marker=${release.ring3Health}`,
    ]),
    '',
    'Continuity Snapshot Health:',
    ...continuitySnapshots.flatMap((snapshot) => {
      const schemaVersion = snapshot?.payload?.schemaVersion ?? 'missing';
      const release = snapshot?.payload?.release ?? 'unknown';
      const rollbackSafe = snapshot?.payload?.rollbackSafe === true ? 'rollback-safe' : 'rollback-unknown';
      const spheres = Object.entries(snapshot?.payload?.spheres || {});
      const sphereLines = spheres.map(([stateKey, sphere]) => (
        `  ${stateKey}: v${sphere?.stateVersion ?? 'missing'} | ${sphere?.lastMilestone || 'unknown'} | ${sphere?.updatedAt || 'n/a'}`
      ));

      return [
        `- ${snapshot.file} | schema=${schemaVersion} | release=${release} | ${rollbackSafe}`,
        ...sphereLines,
      ];
    }),
    '',
    `Latest Continuity Snapshot: ${latestContinuity?.file || 'none'}`,
    `Canonical spheres: ${(continuityManifest?.canonicalSphereIds || []).join(', ') || 'none'}`,
  ];

  const pdfBuffer = buildPdfDocument(lines);
  const sha256 = hashSha256(pdfBuffer);

  await fs.mkdir(REPORTS_DIR, { recursive: true });
  await fs.writeFile(OUTPUT_PDF, pdfBuffer);

  const metadata = {
    url: '/reports/entropy-release-latest.pdf',
    sha256,
    generatedAt,
    signature,
    gateState,
    ring3Releases,
    continuitySnapshots: continuitySnapshots.map(({ file, payload }) => ({
      file,
      schemaVersion: payload?.schemaVersion ?? null,
      release: payload?.release ?? null,
      rollbackSafe: payload?.rollbackSafe === true,
      updatedAt: Object.values(payload?.spheres || {})
        .map((sphere) => sphere?.updatedAt)
        .filter(Boolean)
        .sort()
        .at(-1) || null,
    })),
  };

  await fs.writeFile(OUTPUT_META, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');

  console.log(`Generated ${path.relative(root, OUTPUT_PDF)} (${sha256})`);
  console.log(`Metadata ${path.relative(root, OUTPUT_META)}`);
}

main().catch((error) => {
  console.error('[generate-entropy-frontpage-pdf] failed');
  console.error(error);
  process.exitCode = 1;
});
