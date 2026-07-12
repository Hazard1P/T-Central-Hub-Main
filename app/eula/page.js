import PageShell from '@/components/PageShell';
import { legalDocuments } from '@/lib/legalContent';

export const metadata = { title: 'EULA' };

const eulaDocument = legalDocuments.eula;

export default function EulaPage() {
  return (
    <PageShell eyebrow={eulaDocument.eyebrow} title={eulaDocument.title} text={eulaDocument.summary}>
      <div className="arma-brief-grid">
        {eulaDocument.sections.map((section) => (
          <article className="content-card" id={section.id} key={section.id}>
            <p className="eyebrow">{section.eyebrow}</p>
            <h3>{section.title}</h3>
            <p className="muted">{section.text}</p>
          </article>
        ))}
      </div>
    </PageShell>
  );
}
