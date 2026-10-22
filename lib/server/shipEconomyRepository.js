import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { applyShipAction, newShipWallet } from '../shipEconomy.js';

export function createShipEconomyRepository({ admin = null, localPath = null } = {}) {
  let queue = Promise.resolve();
  async function run({ owner, room, token, requestId, command = { action: 'state' }, now = Date.now() }) {
    if (admin) {
      const result = await admin.rpc('ship_economy_action', { p_owner: owner, p_room: room, p_token: token, p_request: requestId || 'state', p_action: command.action, p_asteroid: command.asteroid || null, p_upgrade: command.upgrade || null, p_expected: command.expectedLevel ?? null, p_at_earth: Boolean(command.atEarth), p_slow: Boolean(command.slow), p_now: now });
      if (result.error) throw new Error(result.error.code === 'P0001' ? result.error.message : 'Ship economy storage is unavailable. Please retry.');
      return { ...result.data, storage: 'supabase' };
    }
    if (!localPath) throw new Error('Ship economy needs its database configuration. Free flight is still available.');
    const operation = queue.then(async () => {
      let document;
      try { document = JSON.parse(await readFile(localPath, 'utf8')); }
      catch (error) { if (error.code !== 'ENOENT') throw error; document = { wallets: {}, fields: {}, receipts: {} }; }
      let wallet = document.wallets[owner] || newShipWallet();
      if (wallet.flight_token !== token || wallet.room !== room) wallet = { ...wallet, cargo: 0, flight_token: token, room };
      if (!Object.hasOwn(document.fields, room)) Object.defineProperty(document.fields, room, { value: {}, enumerable: true, writable: true });
      const rocks = document.fields[room], receiptKey = owner + ':' + requestId;
      let receipt = null, replay = false;
      if (command.action !== 'state') {
        if (document.receipts[receiptKey]) { receipt = document.receipts[receiptKey]; replay = true; }
        else { const result = applyShipAction(wallet, rocks, command, now); wallet = result.wallet; receipt = result.receipt; document.receipts[receiptKey] = receipt; }
      }
      document.wallets[owner] = wallet;
      await mkdir(path.dirname(localPath), { recursive: true });
      await writeFile(localPath + '.tmp', JSON.stringify(document), { mode: 0o600 }); await rename(localPath + '.tmp', localPath);
      const { flight_token, room: ignoredRoom, ...publicWallet } = wallet;
      return { wallet: publicWallet, rocks, receipt, replay, storage: 'development-local' };
    });
    queue = operation.catch(() => {});
    return operation;
  }
  return { run };
}
