import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { resolveGameAuthContext } from '@/lib/auth/resolveGameAuthContext';
import { getShipEconomyStore } from '@/lib/server/shipEconomyStore';
export const dynamic = 'force-dynamic';
export async function GET() {
  const auth = resolveGameAuthContext(cookies());
  const headers = {'Cache-Control':'private, no-store'};
  if(!auth.authenticated) return NextResponse.json({ok:false,error:'Sign in to view your saved ship.'},{status:401,headers});
  const ownerKey = auth.provider+':'+auth.accountId;
  try { return NextResponse.json({ok:true,ownerKey,ship:await getShipEconomyStore().summary(ownerKey)},{headers}); }
  catch { return NextResponse.json({ok:false,error:'Saved ship progress is temporarily unavailable.'},{status:503,headers}); }
}
