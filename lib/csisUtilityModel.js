export const CSIS_CANONICAL_NAME = 'Canada Strings of Intelligence Dispersal';

export const CSIS_RING_RESPONSIBILITIES = {
  ring1: 'intelligence dispersal outputs',
  ring2: 'ingress/egress server + external system database routing',
  ring3: 'entropy regeneration for star singularity state',
};

export const CSIS_INTEGRITY_LABELS = {
  reinforced: 'integrity:reinforced',
  guarded: 'integrity:guarded',
  stable: 'integrity:stable',
};

export function createCsisUtilityPayload({
  ring,
  utilityClass,
  dispersalTier,
  infrastructureTarget,
  integrityAttestation,
  integrityLabel,
} = {}) {
  return {
    canonicalName: CSIS_CANONICAL_NAME,
    ring,
    responsibility: CSIS_RING_RESPONSIBILITIES[ring] || 'unassigned',
    utilityClass: utilityClass || 'core-utility',
    dispersalTier: dispersalTier || 'tier-standard',
    infrastructureTarget: infrastructureTarget || 'foundation-internal',
    integrityAttestation: integrityAttestation || 'attestation:pending',
    integrityLabel: integrityLabel || CSIS_INTEGRITY_LABELS.stable,
  };
}

export function createCsisRingUtilityModel() {
  return {
    canonicalName: CSIS_CANONICAL_NAME,
    ringResponsibilities: CSIS_RING_RESPONSIBILITIES,
    utilityPayloadSchema: {
      utilityClass: 'string',
      dispersalTier: 'string',
      infrastructureTarget: 'string',
      integrityAttestation: 'string',
    },
    rings: {
      ring1: createCsisUtilityPayload({
        ring: 'ring1',
        utilityClass: 'dispersal-output-core',
        dispersalTier: 'tier-1-output',
        infrastructureTarget: 'intelligence-stream',
        integrityAttestation: 'attestation:validated-output',
        integrityLabel: CSIS_INTEGRITY_LABELS.reinforced,
      }),
      ring2: createCsisUtilityPayload({
        ring: 'ring2',
        utilityClass: 'routing-gateway-core',
        dispersalTier: 'tier-2-routing',
        infrastructureTarget: 'ingress-egress + external-db',
        integrityAttestation: 'attestation:routing-validated',
        integrityLabel: CSIS_INTEGRITY_LABELS.guarded,
      }),
      ring3: createCsisUtilityPayload({
        ring: 'ring3',
        utilityClass: 'entropy-regeneration-core',
        dispersalTier: 'tier-3-regeneration',
        infrastructureTarget: 'star-singularity-state',
        integrityAttestation: 'attestation:singularity-regenerated',
        integrityLabel: CSIS_INTEGRITY_LABELS.stable,
      }),
    },
  };
}
