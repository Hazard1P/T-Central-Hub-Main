// Optional PostgreSQL-compatible tooling, matching the finance verification script.
const { PGlite } = await import(process.env.PGLITE_MODULE_PATH || '@electric-sql/pglite');
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const db = new PGlite();
try {
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  const migration = await readFile(new URL('../supabase/migrations/20261027_account_usernames.sql', import.meta.url), 'utf8');
  await db.exec(migration); await db.exec(migration);
  await db.exec("set timezone='America/Vancouver'; set role service_role");
  const run = async (provider, id, fallback, username = null) => (await db.query('select public.account_username($1,$2,$3,$4) result', [provider,id,fallback,username])).rows[0].result;
  const initial=await run('google','one','Pilot-default');assert(initial.canChange);assert.equal(initial.changedAt,null);
  const chosen=await run('google','one','Pilot-default','Orbit_One');assert.equal(chosen.username,'Orbit_One');assert.equal(chosen.canChange,false);
  assert.equal(Date.parse(chosen.nextChangeAt)-Date.parse(chosen.changedAt),30*24*60*60*1000);
  const noop=await run('google','one','new-login-default','Orbit_One');assert.equal(noop.changedAt,chosen.changedAt);
  assert.equal((await run('google','one','new-login-default')).username,'Orbit_One','login must not overwrite chosen tag');
  assert.equal((await run('google','one','ignored','Orbit_Two')).error,'USERNAME_COOLDOWN');
  assert.equal((await run('google','two','Pilot-other','orbit_one')).error,'USERNAME_TAKEN');
  assert.equal((await run('google','two','Pilot-other','<invalid>')).error,'INVALID_USERNAME');
  await db.query("update account_usernames set changed_at=clock_timestamp()-interval '720 hours'+interval '10 seconds' where provider='google' and account_id='one'");
  assert.equal((await run('google','one','ignored','Orbit_Two')).error,'USERNAME_COOLDOWN');
  await db.query("update account_usernames set changed_at=clock_timestamp()-interval '720 hours'-interval '1 second' where provider='google' and account_id='one'");
  const updated=await run('google','one','ignored','Orbit_Two');assert.equal(updated.username,'Orbit_Two');assert.equal(updated.canChange,false);
  const raced=await Promise.all([run('google','race','Pilot-race','First_Name'),run('google','race','Pilot-race','Second_Name')]);
  assert.equal(raced.filter(r=>r.ok).length,1);assert.equal(raced.filter(r=>r.error==='USERNAME_COOLDOWN').length,1);
  const steam=await run('steam','one','Steam Commander 🚀');assert.equal(steam.username,'Steam Commander 🚀');assert.equal(steam.canChange,false);
  assert.equal((await run('steam','one',null)).username,'Steam Commander 🚀','a missing Steam API profile must not erase the verified name');
  assert.equal((await run('steam','one','Steam Renamed 🚀')).username,'Steam Renamed 🚀');
  assert.equal((await run('steam','one','Steam Renamed 🚀','Spoof')).error,'STEAM_MANAGED');
  assert.equal((await run('google','one','ignored')).username,'Orbit_Two','provider namespaces remain separate');
  for(const role of ['anon','authenticated']){
    await db.exec('reset role; set role '+role);
    await assert.rejects(db.query('select * from account_usernames'),e=>e.code==='42501');
    await assert.rejects(db.query("select public.account_username('google','one','ignored','Bypass')"),e=>e.code==='42501');
  }
  console.log('PASS account usernames: rerunnable migration, first choice, 720-hour cooldown across DST, login preservation, no-op, queued writes, uniqueness, Steam sync, provider isolation and private grants.');
} finally { await db.close(); }
