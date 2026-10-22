import { hasRealtimeServer, realtimeCall, requiresRealtimeServer } from '@/lib/server/realtimeBridge';
import { NextResponse } from 'next/server';
import { getDurableLobby, hasDurableMultiplayer } from '@/lib/durableMultiplayerStore';
import { getAuthoritativeLobby } from '@/lib/authoritativeMultiplayerStore';
import { allowsMemoryMultiplayer } from '@/lib/multiplayerCapacity';
import { isValidRoomName } from '@/lib/exploration';
export const dynamic = 'force-dynamic';
export async function GET(request) {
  const room = new URL(request.url).searchParams.get('room') || process.env.NEXT_PUBLIC_MULTIPLAYER_ROOM || 'tcentral-main';
  if (!isValidRoomName(room)) return NextResponse.json({ok:false,error:'Invalid room name'},{status:400});
  if(hasRealtimeServer()){const result=await realtimeCall('lobby',{roomName:room});return NextResponse.json(result,{status:result.status||200,headers:{'Cache-Control':'private, no-store'}})}
  if(requiresRealtimeServer())return NextResponse.json({ok:false,error:'REALTIME_SETUP_REQUIRED'},{status:503,headers:{'Cache-Control':'private, no-store'}});
  let result;
  try { result = hasDurableMultiplayer() ? await getDurableLobby(room) : allowsMemoryMultiplayer() ? getAuthoritativeLobby(room) : {ok:false,status:503,error:'MULTIPLAYER_SETUP_REQUIRED'}; }
  catch { result = {ok:false,status:503,error:'MULTIPLAYER_UNAVAILABLE'}; }
  return NextResponse.json(result,{status:result.status || 200,headers:{'Cache-Control':'private, no-store'}});
}
