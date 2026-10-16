export const CONTACT_EMAIL = 'BrainandBodyai@gmail.com';

export const CONTACT_TOPICS = ['General question', 'Server or simulation help', 'Account or billing', 'Partnership'];

export function buildContactDraft({ name = '', email = '', topic = CONTACT_TOPICS[0], subject = '', message = '' } = {}) {
  // Keep all user text inside encoded query values; email headers stay on one line.
  const singleLine = (value) => String(value).replace(/[\r\n]+/g, ' ').trim();
  const title = `[T-Central] ${singleLine(subject)}`;
  const sender = [name && `Name: ${singleLine(name)}`, email && `Reply email: ${singleLine(email)}`].filter(Boolean);
  const body = [`Topic: ${singleLine(topic)}`, String(message).trim(), sender.join('\n')].filter(Boolean).join('\n\n');
  return {
    subject: title,
    body,
    href: `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`,
  };
}
