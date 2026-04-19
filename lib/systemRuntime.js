export const SYSTEM_RUNTIME = {
  roomName: process.env.NEXT_PUBLIC_MULTIPLAYER_ROOM || 'tcentral-main',
  maxSlots: Number(process.env.NEXT_PUBLIC_MULTIPLAYER_MAX_SLOTS || 100),
  playerBroadcastMs: 250,
  statusRefreshMs: 30000,
  mobileBreakpoint: 900,
  reducedSceneBreakpoint: 1200,
};

export const isMobileViewport = (width) => width <= SYSTEM_RUNTIME.mobileBreakpoint;
export const shouldReduceScene = (width) => width <= SYSTEM_RUNTIME.reducedSceneBreakpoint;
