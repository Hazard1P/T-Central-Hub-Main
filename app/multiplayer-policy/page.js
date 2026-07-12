import PageShell from '@/components/PageShell';
import { legalDocuments } from '@/lib/legalContent';

export const metadata = { title: 'Multiplayer Policy' };

const multiplayerPolicyDocument = legalDocuments['multiplayer-policy'];

export default function MultiplayerPolicyPage() {
  return (
    <PageShell eyebrow={multiplayerPolicyDocument.eyebrow} title={multiplayerPolicyDocument.title} text={multiplayerPolicyDocument.summary}>
      <div className="arma-brief-grid">
        {multiplayerPolicyDocument.sections.map((section) => (
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
