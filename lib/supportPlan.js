// Only present a simple, verified monthly price. Complex/trial plans need their
// own disclosure before they can be offered by this interface.
export function publicMonthlyPlan(plan) {
  const cycles = plan?.billing_cycles;
  if (plan?.status !== 'ACTIVE' || !Array.isArray(cycles) || cycles.length !== 1) return null;
  const cycle = cycles[0], price = cycle.pricing_scheme?.fixed_price;
  if (cycle.tenure_type !== 'REGULAR' || cycle.frequency?.interval_unit !== 'MONTH' || cycle.frequency?.interval_count !== 1 || cycle.total_cycles !== 0) return null;
  if (!price || !/^[A-Z]{3}$/.test(price.currency_code) || !Number.isFinite(Number(price.value)) || Number(price.value) <= 0) return null;
  if (Number(plan.payment_preferences?.setup_fee?.value || 0) !== 0 || Number(plan.taxes?.percentage || 0) !== 0) return null;
  return { amount: Number(price.value).toFixed(2), currency: price.currency_code, interval: 'month' };
}
