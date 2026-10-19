import LegalDocumentPage from '@/components/LegalDocumentPage';

export const metadata = { title: 'End User License Agreement' };

export default function EulaPage() {
  return <LegalDocumentPage documentKey="eula" />;
}
