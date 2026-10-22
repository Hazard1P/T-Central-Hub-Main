import path from 'node:path';
import { getSupabaseAdmin } from './supabaseAdmin';
import { createShipEconomyRepository } from './shipEconomyRepository.js';
let repository;
export function getShipEconomyStore() {
  return repository ||= createShipEconomyRepository({
    admin: getSupabaseAdmin(),
    localPath: process.env.NODE_ENV !== 'production' && !process.env.VERCEL ? path.join(process.cwd(), 'data', 'ship-economy.json') : null,
  });
}
