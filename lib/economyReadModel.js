const MICRO_EC = 1_000_000;

function formatEc(microEc) {
  return (microEc / MICRO_EC).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function getEconomyReadModel() {
  const snapshot = {
    wallet: {
      wallet_id: 'wallet-main-001',
      mode_scope: 'multiplayer:primary-cluster',
      status: 'active',
    },
    entropic_credit_balance: {
      available_micro_ec: 12_450_000_000,
      reserved_micro_ec: 1_900_000_000,
    },
    entropy_decay_rules: {
      rule_version: 'v1.0.0',
      profile: 'standard_decay_window',
    },
    settlement_state: {
      pending_count: 2,
      last_settlement_at: '2026-04-26T11:30:00Z',
    },
  };

  return {
    ...snapshot,
    ui: {
      available_ec: formatEc(snapshot.entropic_credit_balance.available_micro_ec),
      reserved_ec: formatEc(snapshot.entropic_credit_balance.reserved_micro_ec),
      currency_label: 'Entropic Credits',
    },
  };
}
