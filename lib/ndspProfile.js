const NDSP_GUEST_KEY = 'tcentral_ndsp_guest_identity';

export function getNDSPInstanceScope(lobbyMode = 'private') {
  return lobbyMode === 'hub' ? 'multi_player_instance' : 'single_player_instance';
}

function readOrCreateLocalGuestId() {
  if (typeof window === 'undefined' || !window.localStorage) return 'guest-server';

  try {
    const existing = window.localStorage.getItem(NDSP_GUEST_KEY);
    if (existing) return existing;

    const entropy = Math.random().toString(36).slice(2, 12);
    const created = `guest-${Date.now().toString(36)}-${entropy}`;
    window.localStorage.setItem(NDSP_GUEST_KEY, created);
    return created;
  } catch {
    return 'guest-session';
  }
}

function splitProviderScopedId(id = '') {
  const [provider, ...rest] = String(id).split(':');
  const accountId = rest.join(':');
  return accountId ? { provider, accountId } : null;
}

export function resolveNDSPAccountIdentity(authContext = null) {
  const context = authContext?.identity || authContext || {};
  const steamUser = authContext?.steamUser || context?.steamUser || (context?.steamid ? context : null);
  const googleUser = authContext?.googleUser || context?.googleUser || (context?.sub ? context : null);

  if (steamUser?.steamid) {
    return {
      provider: 'steam',
      accountId: String(steamUser.steamid),
      accountKey: `steam:${String(steamUser.steamid)}`,
      displayName: steamUser.personaname || context.displayName || 'Steam Pilot',
      authenticated: true,
    };
  }

  if (googleUser?.sub) {
    return {
      provider: 'google',
      accountId: String(googleUser.sub),
      accountKey: `google:${String(googleUser.sub)}`,
      displayName: googleUser.name || googleUser.email || context.displayName || 'Google Pilot',
      authenticated: true,
    };
  }

  if (context?.authenticated && (context?.provider || context?.kind || context?.id || context?.accountId)) {
    const scoped = splitProviderScopedId(context.id || context.accountId);
    const provider = String(context.provider || context.kind || scoped?.provider || '').toLowerCase();
    const accountId = String(context.accountId || scoped?.accountId || context.id || '').replace(/^([^:]+):/, '');

    if ((provider === 'steam' || provider === 'google') && accountId) {
      return {
        provider,
        accountId,
        accountKey: `${provider}:${accountId}`,
        displayName: context.displayName || context.name || `${provider} Pilot`,
        authenticated: true,
      };
    }
  }

  const guestScoped = splitProviderScopedId(context?.id || context?.accountId || '');
  const guestId = guestScoped?.provider === 'guest' && guestScoped.accountId
    ? guestScoped.accountId
    : String(context?.sessionId || context?.guestId || context?.id || readOrCreateLocalGuestId());

  return {
    provider: 'guest',
    accountId: guestId,
    accountKey: `guest:${guestId}`,
    displayName: context?.displayName || context?.name || 'Guest',
    authenticated: false,
  };
}

export function createNDSPProfileContext(authContext = null, lobbyMode = 'private') {
  const account = resolveNDSPAccountIdentity(authContext);
  const instanceScope = getNDSPInstanceScope(lobbyMode);

  return {
    ...account,
    steamId: account.provider === 'steam' ? account.accountId : null,
    personaName: account.displayName,
    lobbyMode,
    instanceScope,
    namespace: `ndsp:${account.accountKey}:${instanceScope}`,
    buildAnchorKey: `ndsp-anchor:${account.accountKey}:${instanceScope}`,
    profileLedgerKey: `ndsp-ledger:${account.accountKey}:${instanceScope}`,
    privateProfileLabel: `${account.displayName} ${instanceScope} profile`,
    description:
      'NDSP keeps the linked player profile discrete from other users by scoping the build anchor, ledger path, and profile namespace to the provider-linked account key and current instance type. Guests use an explicit session or local guest key.',
  };
}
