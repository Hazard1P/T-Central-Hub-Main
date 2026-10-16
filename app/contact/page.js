import PageShell from '@/components/PageShell';
import ContactUsForm from '@/components/ContactUsForm';
import CopyAddressButton from '@/components/CopyAddressButton';
import Link from 'next/link';
import { CONTACT_EMAIL } from '@/lib/contact';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Contact',
  description: 'Contact T-Central for server help, account questions and partnerships, or find the right community and support route.',
};

export default function ContactPage() {
  return (
    <PageShell
      eyebrow="Here to help"
      title="Talk to the T-Central team."
      text="Stuck joining a server? Have an idea for the hub? Tell us what’s on your mind and we’ll help you find the next step."
    >
      <div className="contact-layout">
        <ContactUsForm enabled={process.env.CONTACT_FORM_ENABLED === 'true'} />
        <aside className="contact-sidebar" aria-label="Contact options and help">
          <article className="content-card contact-direct">
            <p className="eyebrow">Prefer email?</p>
            <h2>A direct line to the team.</h2>
            <p className="muted">For support, account questions or a potential partnership, reach us here.</p>
            <a className="contact-email" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
            <CopyAddressButton value={CONTACT_EMAIL} label="Copy email address" className="button secondary" />
          </article>
          <article className="content-card contact-help">
            <p className="eyebrow">Find your next step</p>
            <h2>Need something specific?</h2>
            <div className="contact-route-list">
              <Link href="/status"><strong>Check service status <RouteArrow /></strong><span>Look for a wider issue before troubleshooting.</span></Link>
              <Link href="/report-player"><strong>Report a player <RouteArrow /></strong><span>Use the dedicated form for moderation issues.</span></Link>
              <Link href="/hub-form"><strong>Join the conversation <RouteArrow /></strong><span>Share feedback and ideas on the community board.</span></Link>
            </div>
          </article>
          <div className="contact-checklist">
            <h2>Help us help you.</h2>
            <p>Include the server or page, what you expected to happen, and any error message. A little context makes a big difference.</p>
          </div>
        </aside>
      </div>
    </PageShell>
  );
}

function RouteArrow() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>;
}
