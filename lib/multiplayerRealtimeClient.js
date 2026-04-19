import { getSupabaseClient } from '@/lib/supabaseClient';

export function subscribeToMultiplayerRoom({ roomName, onSignal }) {
  const supabase = getSupabaseClient();
  if (!supabase || !roomName) return () => {};

  const channel = supabase
    .channel(`multiplayer-room:${roomName}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'multiplayer_players', filter: `room_name=eq.${roomName}` }, onSignal)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'multiplayer_events', filter: `room_name=eq.${roomName}` }, onSignal)
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
