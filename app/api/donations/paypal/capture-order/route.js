import { isSameOriginPaymentRequest } from '@/lib/paymentRequest';
import { cookies } from 'next/headers';
import { resolveGameAuthContext } from '@/lib/auth/resolveGameAuthContext';
import { accountPayments } from '@/lib/server/accountPaymentStore';
import { minorToMoney, verifiedCapture, verifyOrderPayment } from '@/lib/accountPayments';
import { capturePayPalOrder, getPayPalOrderDetails, isPayPalConfigured } from '@/lib/paypal';

export async function POST(request) {
  if (!isSameOriginPaymentRequest(request)) return Response.json({ ok: false, error: 'Open checkout from T-Central to continue.' }, { status: 403 });
  const auth = resolveGameAuthContext(cookies());
  if (!auth.authenticated) return Response.json({ ok: false, error: 'Sign in to verify your contribution.' }, { status: 401 });
  if (!isPayPalConfigured()) return Response.json({ ok: false, error: 'Payment verification is unavailable.' }, { status: 503 });
  const body = await request.json().catch(() => null);
  if (!/^[A-Z0-9-]{8,64}$/i.test(body?.orderId || '')) return Response.json({ ok: false, error: 'Invalid order reference.' }, { status: 400 });
  try {
    const store = accountPayments();
    const intent = await store.find(body.orderId, auth);
    if (!intent || intent.mode !== 'order') return Response.json({ ok: false, error: 'This order is not linked to your current account.' }, { status: 404 });
    // Check verified ownership, amount and opaque binding BEFORE any capture.
    let order = await getPayPalOrderDetails(body.orderId);
    verifyOrderPayment(order, intent);
    if (order.status === 'APPROVED') order = await capturePayPalOrder(body.orderId, `capture-${intent.id}`);
    const capture = verifiedCapture(order, intent);
    if (!capture) return Response.json({ ok: true, pending: true, capture: { status: 'PENDING' } }, { status: 202 });
    const saved = await store.record(intent, capture);
    const analytics = await store.summary(auth);
    return Response.json({ ok: true, capture: { id: capture.id, status: 'COMPLETED', amount: minorToMoney(capture.amountMinor, capture.currency), currency: capture.currency }, analytics, idempotentReplay: saved.replay }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch { return Response.json({ ok: false, pending: true, error: 'Payment verification is pending. Check your account history or retry this order; do not submit another payment.' }, { status: 503 }); }
}
