import test from 'node:test';
import assert from 'node:assert/strict';
import { publicMonthlyPlan } from '../lib/supportPlan.js';
const plan = () => ({ status: 'ACTIVE', billing_cycles: [{ tenure_type: 'REGULAR', total_cycles: 0, frequency: { interval_unit: 'MONTH', interval_count: 1 }, pricing_scheme: { fixed_price: { value: '15.0', currency_code: 'CAD' } } }] });
test('monthly disclosure uses the verified plan price and currency', () => {
  assert.deepEqual(publicMonthlyPlan(plan()), { amount: '15.00', currency: 'CAD', interval: 'month' });
});
test('inactive, trial, non-monthly and extra-fee plans cannot be shown as simple monthly support', () => {
  const inactive = plan(); inactive.status = 'INACTIVE';
  const trial = plan(); trial.billing_cycles.push({ tenure_type: 'TRIAL' });
  const annual = plan(); annual.billing_cycles[0].frequency.interval_unit = 'YEAR';
  const setup = plan(); setup.payment_preferences = { setup_fee: { value: '10.00' } };
  const taxed = plan(); taxed.taxes = { percentage: '5' };
  for (const item of [null, inactive, trial, annual, setup, taxed]) assert.equal(publicMonthlyPlan(item), null);
});
