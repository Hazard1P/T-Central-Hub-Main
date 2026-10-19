import { writeFile } from 'node:fs/promises';
import { LEGAL_DRAFT_NOTICE, LEGAL_REVISION, LEGAL_UPDATED, legalDocuments, legalDocumentOrder } from '../lib/legalContent.js';

// Regenerate after editing the shared website/access-panel source.
const lines = [
  '# T-Central community legal documents', '',
  'Michael Rybaltowicz, operating as Central Synaptic Intelligence Systems, British Columbia, Canada.', '',
  `Draft revision: ${LEGAL_REVISION}. Updated ${LEGAL_UPDATED}.`, '',
  LEGAL_DRAFT_NOTICE, '',
  'Generated from `lib/legalContent.js` with `node scripts/export-legal-documents.mjs`. See [the review record](LEGAL-REVIEW.md) for outstanding facts and implementation checks.', '',
];
for (const key of legalDocumentOrder) {
  const document = legalDocuments[key];
  lines.push(`## ${document.title}`, '', `Website route: \`${document.route}\``, '', document.summary, '');
  for (const section of document.sections) {
    lines.push(`### ${section.title}`, '', ...section.paragraphs.flatMap((paragraph) => [paragraph, '']));
    if (section.items.length) lines.push(...section.items.map((item) => `- ${item}`), '');
  }
}
await writeFile(new URL('../docs/COMMUNITY-LEGAL-DRAFT.md', import.meta.url), lines.join('\n'));
console.log(`Exported ${legalDocumentOrder.length} draft documents (${LEGAL_REVISION}).`);
