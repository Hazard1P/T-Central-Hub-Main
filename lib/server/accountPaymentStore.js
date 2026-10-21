import { getPayPalEnv } from '@/lib/paypal';
import { getSupabaseAdmin } from '@/lib/server/supabaseAdmin';
import { createAccountPaymentRepository } from './accountPaymentRepository.js';
export function accountPayments() { return createAccountPaymentRepository(getSupabaseAdmin(), { environment: getPayPalEnv() }); }
