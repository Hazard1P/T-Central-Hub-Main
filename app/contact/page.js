import PageShell from '@/components/PageShell';
import ContactUsForm from '@/components/ContactUsForm';

export const metadata = { title: 'Contact' };

export default function ContactPage() {
  return (
    <PageShell
      eyebrow="Contact"
      title="Reach the T-Central team"
      text="Use the contact form below for support, partnerships, or general questions. Messages are now persisted server-side when a storage target is available."
    >
      <ContactUsForm />
    </PageShell>
  );
}
