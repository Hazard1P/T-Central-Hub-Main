export const HUB_POST_CATEGORIES = ['General', 'Server feedback', 'Bug report', 'Events', 'Feature idea', 'Moderation'];

function sanitizeText(value, fallback = '', maxLength = 3000) {
  return String(value || fallback).trim().slice(0, maxLength);
}

function normalizeCategory(value) {
  const candidate = sanitizeText(value, 'General', 80);
  return HUB_POST_CATEGORIES.includes(candidate) ? candidate : 'General';
}

export function getHubPostAuthIdentity(auth = {}) {
  if (auth?.steamUser?.steamid) {
    return {
      provider: 'steam',
      accountId: String(auth.steamUser.steamid),
      displayName: auth.steamUser.personaname || 'Steam Pilot',
      avatar: auth.steamUser.avatar || null,
      profileurl: auth.steamUser.profileurl || null,
      steamid: String(auth.steamUser.steamid),
    };
  }

  if (auth?.googleUser?.sub) {
    return {
      provider: 'google',
      accountId: String(auth.googleUser.sub),
      displayName: auth.googleUser.name || auth.googleUser.email || 'Google Pilot',
      avatar: auth.googleUser.picture || null,
      profileurl: null,
      googleSub: String(auth.googleUser.sub),
      email: auth.googleUser.email || null,
      emailVerified: Boolean(auth.googleUser.email_verified),
    };
  }

  return null;
}

export function normalizeHubPostPayload(body = {}) {
  const topic = sanitizeText(body?.topic, '', 120);
  const category = normalizeCategory(body?.category);
  const message = sanitizeText(body?.message, '', 3000);

  return {
    topic,
    category,
    message,
    valid: Boolean(topic && message),
  };
}

export function buildHubPostRecord({ body = {}, auth = {}, now = new Date(), reference = null } = {}) {
  const identity = getHubPostAuthIdentity(auth);
  if (!identity) {
    return { ok: false, error: 'AUTH_REQUIRED', record: null };
  }

  const payload = normalizeHubPostPayload(body);
  if (!payload.valid) {
    return { ok: false, error: 'CONTENT_REQUIRED', record: null };
  }

  const createdAt = now instanceof Date ? now.toISOString() : new Date(now).toISOString();
  const postReference = reference || `HB-${Date.now().toString(36).toUpperCase()}`;

  return {
    ok: true,
    record: {
      reference: postReference,
      topic: payload.topic,
      category: payload.category,
      message: payload.message,
      createdAt,
      author: {
        provider: identity.provider,
        accountId: identity.accountId,
        displayName: identity.displayName,
        personaname: identity.provider === 'steam' ? identity.displayName : null,
        steamid: identity.steamid || null,
        googleSub: identity.googleSub || null,
        email: identity.email || null,
        emailVerified: identity.emailVerified || false,
        avatar: identity.avatar,
        profileurl: identity.profileurl,
      },
      source: 'hub-community-form',
      visibility: 'community',
      status: 'published',
    },
  };
}
