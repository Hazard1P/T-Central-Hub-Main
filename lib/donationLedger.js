import { cookies } from 'next/headers';
import { decryptJson, encryptJson, signValue } from '@/lib/security';
import { shouldUseSecureCookies } from '@/lib/runtimeConfig';

const COOKIE_NAME = 'tcentral_donations';

export function readDonationLedger() {
  const raw = cookies().get(COOKIE_NAME)?.value;
  try {
    const ledger = raw ? decryptJson(raw) : [];
    return Array.isArray(ledger) ? ledger : [];
  } catch {
    return [];
  }
}

export function summarizeDonationLedger(ledger) {
  const confirmed = ledger.filter((entry) => entry.status === 'CONFIRMED');
  const totalAmount = confirmed.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  return {
    total: ledger.length,
    confirmed: confirmed.length,
    totalAmount: totalAmount.toFixed(2),
    latest: ledger[0] || null,
  };
}

export function createDonationIntent({ steamUser, amount, currency, anchorSlug, solarSystemKey, orderId }) {
  return {
    id: signValue(`${steamUser.steamid}:${orderId}:${Date.now()}`),
    orderId,
    steamid: steamUser.steamid,
    personaname: steamUser.personaname || null,
    amount,
    currency,
    anchorSlug: anchorSlug || 'deep_blackhole',
    solarSystemKey: solarSystemKey || 'solar_system',
    status: 'CREATED',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function upsertDonationRecord(ledger, record) {
  const index = ledger.findIndex((entry) => entry.orderId === record.orderId || entry.id === record.id);
  if (index >= 0) {
    const merged = { ...ledger[index], ...record, updatedAt: new Date().toISOString() };
    const next = [...ledger];
    next[index] = merged;
    return next.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }
  return [{ ...record, updatedAt: new Date().toISOString() }, ...ledger].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

export function persistDonationLedger(response, request, ledger) {
  response.cookies.set({
    name: COOKIE_NAME,
    value: encryptJson(ledger.slice(0, 40)),
    httpOnly: true,
    secure: shouldUseSecureCookies(request),
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 180,
  });
  return response;
}
