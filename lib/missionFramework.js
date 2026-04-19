const DEFAULT_SET = [];

function includesMode(item, mode) {
  return !item.modes || item.modes.includes(mode) || item.modes.includes('all');
}

function withStatus(item, complete, detail) {
  return {
    ...item,
    complete: Boolean(complete),
    detail,
    statusLabel: complete ? 'Complete' : 'Pending',
  };
}

export function buildOperationsState({
  lobbyMode = 'hub',
  steamUser = null,
  activeNode = null,
  telemetry = null,
  presence = DEFAULT_SET,
  universe = null,
  progress = {},
} = {}) {
  const visitedNodes = Array.isArray(progress.visitedNodes) ? progress.visitedNodes : [];
  const presenceCount = Array.isArray(presence) ? presence.length : 0;
  const seedCount = Number(progress.seedCount || 0);
  const routeTrips = Number(progress.routeTrips || 0);
  const entropyMined = Number(progress.entropyMined || 0);
  const entropyResolved = Number(progress.entropyResolved || 0);
  const credits = Number(progress.credits || 0);
  const currency = { symbol: "E_s", label: "Entropic Scalar Credits", shortLabel: "E_s credits" };
  const unresolvedEntropy = Math.max(0, entropyMined - entropyResolved);
  const focusKey = activeNode?.key || visitedNodes[visitedNodes.length - 1] || null;
  const steamLinked = Boolean(steamUser?.steamid);
  const privateWorldReady = lobbyMode === 'private';
  const multiplayerReady = lobbyMode === 'hub';
  const hasAnchorCoverage = ['deep_blackhole', 'solar_system', 'arma3'].every((key) => visitedNodes.includes(key));
  const hasMotion = Number(telemetry?.speed || 0) >= 1.25;
  const pilotsNearby = presenceCount >= 2;
  const soloLaunchReady = visitedNodes.includes('deep_blackhole') && visitedNodes.includes('solar_system');
  const multiplayerTransitionReady = soloLaunchReady && Boolean(progress.multiplayerJumped || (lobbyMode === 'hub' && visitedNodes.includes('entropic_node')));
  const exchangeReturnReady = visitedNodes.includes('matrixcoinexchange');

  const independentSystems = [
    withStatus(
      {
        id: 'independent-access',
        title: 'Identity / access layer',
        description: 'Anchor the pilot identity into the universe so private and multiplayer systems can branch cleanly.',
      },
      privateWorldReady || steamLinked,
      steamLinked ? `${steamUser?.personaname || 'Steam pilot'} linked to the system.` : 'Guest-safe private world anchor active.'
    ),
    withStatus(
      {
        id: 'independent-private',
        title: 'Private world shell',
        description: 'Keep a private single-player lane available for personal missions, seeds, and route ownership whether Steam-linked or guest-fallback.',
      },
      privateWorldReady || soloLaunchReady,
      privateWorldReady ? (universe?.privacy?.storageKey || 'Private vault active.') : 'Switch to Private World to activate the sealed lane.'
    ),
    withStatus(
      {
        id: 'independent-hub',
        title: 'Shared hub shell',
        description: 'Expose a synchronized multiplayer route layer without breaking private profile separation.',
      },
      multiplayerReady && presenceCount >= 1,
      multiplayerReady ? `${presenceCount} live pilot${presenceCount === 1 ? '' : 's'} visible in the hub realm.` : 'Enter hub mode to join the shared realm.'
    ),
    withStatus(
      {
        id: 'independent-routing',
        title: 'Route command shell',
        description: 'Keep mission routing active between deep-space anchors, Dyson spheres, mining seams, and exchange settlement.',
      },
      routeTrips >= 1,
      routeTrips >= 1 ? `${routeTrips} route handoff${routeTrips === 1 ? '' : 's'} recorded.` : 'Open one live route to validate the shell.'
    ),
  ];

  const objectives = [
    withStatus(
      {
        id: 'objective-recon-blackhole',
        title: 'Recon the deep blackhole',
        description: 'Make the deep-space anchor the visual and tactical center of the game flow.',
      },
      visitedNodes.includes('deep_blackhole'),
      visitedNodes.includes('deep_blackhole') ? 'Deep blackhole inspected.' : 'Select the Deep Space Blackhole anchor.'
    ),
    withStatus(
      {
        id: 'objective-solo-launch',
        title: 'Singleplayer launch lane',
        description: 'Use the private world as the first mission shell before crossing into the hub universe.',
      },
      soloLaunchReady,
      soloLaunchReady ? 'Private launch route complete.' : 'In Private World, route through the deep blackhole and solar system.'
    ),
    withStatus(
      {
        id: 'objective-entropic-mining',
        title: 'Mine the entropic node',
        description: 'Jump into the multiplayer universe and extract entropic cargo from the shared seam.',
      },
      entropyMined > 0,
      entropyMined > 0 ? `${entropyMined} entropy unit${entropyMined === 1 ? '' : 's'} secured.` : 'Select the Entropic Node in hub mode and mine it.'
    ),
    withStatus(
      {
        id: 'objective-exchange-settlement',
        title: 'Return to MatrixCoinExchange',
        description: 'Bring the haul back through the blackhole fabric and settle it into scalar gains.',
      },
      entropyResolved > 0,
      entropyResolved > 0 ? `${entropyResolved} unit${entropyResolved === 1 ? '' : 's'} settled for ${credits.toFixed(2)} ${currency.shortLabel}.` : 'Route back to MatrixCoinExchange and resolve entropy.'
    ),
  ];

  const missions = [
    withStatus(
      {
        id: 'mission-solo-recon',
        title: 'Solo Recon Run',
        description: 'Private single-player mission chain: deep blackhole → solar system → launch readiness.',
        modes: ['private'],
      },
      privateWorldReady && soloLaunchReady,
      privateWorldReady ? (steamLinked ? 'Steam-linked private route chain armed.' : 'Guest private route chain armed.') : 'Enter the Private World to arm the route chain.'
    ),
    withStatus(
      {
        id: 'mission-hub-formation',
        title: 'Hub Formation Flight',
        description: 'Multiplayer mission chain: bring pilots into the hub and hold anchor routes while traversing the seam.',
        modes: ['hub'],
      },
      multiplayerReady && (pilotsNearby || visitedNodes.includes('entropic_node')),
      multiplayerReady ? `${presenceCount} pilots in hub.` : 'Enter hub mode to form the shared flight.'
    ),
    withStatus(
      {
        id: 'mission-entropic-economy-loop',
        title: 'Entropic Economy Loop',
        description: 'Complete the core game fantasy: singleplayer prep → multiplayer mining → exchange settlement.',
        modes: ['all'],
      },
      soloLaunchReady && multiplayerTransitionReady && entropyMined > 0 && entropyResolved > 0 && exchangeReturnReady,
      entropyResolved > 0
        ? `${credits.toFixed(2)} ${currency.shortLabel} quoted from settled entropy.`
        : unresolvedEntropy > 0
          ? `${unresolvedEntropy} unresolved entropy unit${unresolvedEntropy === 1 ? '' : 's'} still in cargo.`
          : 'Prime the loop in Private World, then mine in hub mode.'
    ),
    withStatus(
      {
        id: 'mission-independent-ops',
        title: 'Independent Operations Layer',
        description: 'Blend private and shared play while keeping each player profile discrete and progression-focused.',
        modes: ['all'],
      },
      routeTrips >= 2 && hasAnchorCoverage,
      steamLinked ? `${visitedNodes.length} anchor selections recorded.` : 'Guest private-world operations stay active; Steam unlocks shared hub transition.'
    ),
    withStatus(
      {
        id: 'mission-live-objective-loop',
        title: 'Live Objective Loop',
        description: 'Complete the website-to-game fantasy: route selection, traversal, mining, settlement, and return to command shell.',
        modes: ['all'],
      },
      routeTrips >= 1 && entropyResolved > 0,
      routeTrips >= 1 ? 'A live route loop has been attempted.' : 'Travel through a live route to validate the loop.'
    ),
  ].filter((item) => includesMode(item, lobbyMode));

  const missionLoop = [
    {
      id: 'loop-private',
      label: 'Private World launch',
      detail: 'Recon deep blackhole and stabilize the solar lane.',
      complete: soloLaunchReady,
    },
    {
      id: 'loop-hub',
      label: 'Multiplayer universe jump',
      detail: multiplayerTransitionReady ? 'Hub seam is online.' : 'Switch to hub mode after the solo launch.',
      complete: multiplayerTransitionReady,
    },
    {
      id: 'loop-mine',
      label: 'Entropic extraction',
      detail: entropyMined > 0 ? `${entropyMined} unit${entropyMined === 1 ? '' : 's'} mined.` : 'Mine the entropic node.',
      complete: entropyMined > 0,
    },
    {
      id: 'loop-settle',
      label: 'Exchange settlement',
      detail: entropyResolved > 0 ? `${credits.toFixed(2)} ${currency.shortLabel} quoted.` : 'Return to MatrixCoinExchange to resolve cargo.',
      complete: entropyResolved > 0,
    },
  ];

  const allItems = [...independentSystems, ...objectives, ...missions];
  const completedCount = allItems.filter((item) => item.complete).length;
  const completionPercent = allItems.length ? Math.round((completedCount / allItems.length) * 100) : 0;
  const nextDirective = [...missionLoop, ...allItems].find((item) => !item.complete) || null;

  return {
    modeTitle: lobbyMode === 'hub' ? 'Shared Hub Operations' : 'Private Universe Operations',
    modeSummary:
      lobbyMode === 'hub'
        ? 'Shared route visibility, synchronized pilot presence, discrepant hub-star sync, entropic mining, and exchange settlement stay available.'
        : 'Single-player privacy, personal progression, 9-planet epoch orbits, solar prep, and blackhole launch readiness stay primary.',
    completionPercent,
    completedCount,
    totalCount: allItems.length,
    nextDirective,
    independentSystems,
    objectives,
    missions,
    missionLoop,
    economy: {
      entropyMined,
      entropyResolved,
      unresolvedEntropy,
      credits,
      currency,
    },
    activeFocusKey: focusKey,
  };
}
