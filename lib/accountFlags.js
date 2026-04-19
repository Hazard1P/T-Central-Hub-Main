export function hasPaypalSubscription(steamUser) {
  return Boolean(
    steamUser?.paypalSubscriptionActive ||
    steamUser?.subscriptionActive ||
    steamUser?.hasActiveSubscription ||
    steamUser?.paypalSubscriber
  );
}

export function isSteamAuthenticated(steamUser) {
  return Boolean(steamUser?.steamid);
}
