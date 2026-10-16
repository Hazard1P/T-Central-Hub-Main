import PageShell from '@/components/PageShell';
import ContactUsForm from '@/components/ContactUsForm';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Contact' };

export default function ContactPage() {
  return (
    <PageShell
      eyebrow="Contact"
      title="Reach the T-Central team"
      text="Get help with a server, ask a question, or discuss a partnership with the T-Central team."
    >
      <ContactUsForm enabled={process.env.CONTACT_FORM_ENABLED === 'true'} />
    </PageShell>
  );
}
