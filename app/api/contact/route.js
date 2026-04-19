import { NextResponse } from 'next/server';
import { signValue } from '@/lib/security';
import { persistContactSubmission } from '@/lib/serverPersistence';

function createReference(email) {
  return `CT-${signValue(`${email}:${Date.now()}`).slice(0, 10).toUpperCase()}`;
}

export async function POST(request) {
  const contactEnabled = process.env.CONTACT_FORM_ENABLED === 'true';

  if (!contactEnabled) {
    return NextResponse.json({
      ok: false,
      unavailable: true,
      code: 'CONTACT_FORM_DISABLED',
      error: 'Contact form delivery is currently disabled. Please use direct email instead.',
      directEmail: 'BrainandBodyai@gmail.com',
    }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const name = String(body?.name || '').trim().slice(0, 120);
  const email = String(body?.email || '').trim().slice(0, 160);
  const subject = String(body?.subject || '').trim().slice(0, 160);
  const message = String(body?.message || '').trim().slice(0, 5000);
  const phone = String(body?.phone || '').trim().slice(0, 40);
  const company = String(body?.company || '').trim().slice(0, 120);

  if (company) {
    return NextResponse.json({ ok: true, message: 'Message received.', reference: createReference(email || 'honeypot') });
  }

  if (!name || !email || !subject || !message) {
    return NextResponse.json({ error: 'Name, email, subject, and message are required.' }, { status: 400 });
  }

  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailLooksValid) {
    return NextResponse.json({ error: 'Please provide a valid email address.' }, { status: 400 });
  }

  const reference = createReference(email);
  const record = {
    reference,
    name,
    email,
    subject,
    message,
    phone: phone || null,
    receivedAt: new Date().toISOString(),
    source: 'contact-form',
  };

  const persistence = await persistContactSubmission(record);

  if (!persistence.ok) {
    return NextResponse.json({
      ok: false,
      error: 'Durable contact storage is not configured.',
      code: 'CONTACT_STORAGE_UNAVAILABLE',
      directEmail: 'BrainandBodyai@gmail.com',
    }, { status: 503 });
  }

  return NextResponse.json({
    ok: true,
    message: 'Message received and queued for follow-up through email.',
    reference,
    storage: persistence.storage,
    contact: {
      name,
      email,
      subject,
      phone: phone || null,
      receivedAt: record.receivedAt,
    },
  });
}
