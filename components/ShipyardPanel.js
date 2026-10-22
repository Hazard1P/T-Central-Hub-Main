'use client';
import { SHIP_UPGRADES, ORE_VALUE } from '@/lib/shipEconomy';
import ShipSystemsReadout from './ShipSystemsReadout';
export default function ShipyardPanel({ economy, ship, onMiningWaypoint, onEarthWaypoint, onMiningApproach }) {
  const { data, error, pending, feedback, send, ready, shared } = economy;
  const wallet = data?.wallet, location = data?.location;
  const docked = location?.atEarth && location?.slow;
  const nearest = location?.nearest;
  const rock = data?.rocks?.[nearest?.id];
  const depleted = rock?.hp === 0 && rock.depleted_until > data?.serverTime;
  return <>
    <p className="exploration-help">Mine asteroids, carry ore to Earth, then unload for {ORE_VALUE} credits per ore. Credits buy cargo and laser upgrades.</p>
    {ship ? <ShipSystemsReadout ship={ship} detailed /> : null}
    {!shared ? <p className="shipyard-status">Join a shared flight from Pilots to earn resources. Solo flight is exploration only.</p> : !ready ? <p className="shipyard-status">Connecting to your shared flight…</p> : null}
    <p className="exploration-feedback" role="status">{error || feedback}</p>
    {ready && !data ? <button type="button" onClick={() => send()}>Refresh shipyard</button> : null}
    {wallet ? <>
      <div className="shipyard-balances"><span><small>Cargo</small><strong>{wallet.cargo} / {data.stats.capacity} ore</strong></span><span><small>Balance</small><strong>{wallet.credits} credits</strong></span></div>
      <p className="exploration-help">{data.accountBound ? 'Account saved' : 'Guest training · this browser only; sign-in starts your account wallet'} · {wallet.delivered} ore delivered</p>
      <div className="shipyard-step"><h3>1. Mine the Earth field</h3><p className="exploration-help">Approach within 180 u and brake below 25 u/s. Aim and fire, or use the mining button. Every hit loads its share of ore, even when mining with other pilots. Each rock yields 4–7 ore in total, limited by your cargo space.</p><div className="exploration-actions"><button onClick={onMiningWaypoint}>Fly to mining field</button><button disabled={nearest.distance > 1500 || pending} onClick={() => onMiningApproach(nearest.id)}>Approach nearest rock</button><button disabled={pending || ship?.alive === false || !location.canMine || depleted || wallet.cargo >= data.stats.capacity} onClick={() => send('mine', { asteroid: nearest.id })}>Mine asteroid</button></div><div className="shipyard-rock"><span>{nearest.label} · {Math.round(nearest.distance)} u away</span><meter aria-label="Asteroid integrity" min="0" max="3" value={depleted ? 0 : rock?.hp > 0 ? rock.hp : 3} /><small>{depleted ? 'Regenerating · ' + Math.max(0, Math.ceil((rock.depleted_until - data.serverTime) / 1000)) + 's' : (rock?.hp > 0 ? rock.hp : 3) + '/3 integrity · shared field'}</small></div></div>
      <div className="shipyard-step"><h3>2. Deliver and repair at Earth</h3><p className="exploration-help">Fly back within 4.2 Earth radii and brake below 8 u/s. Hull repairs start automatically after five seconds out of combat. Emergency return discards carried ore.</p><div className="exploration-actions"><button onClick={onEarthWaypoint}>Fly to Earth</button><button disabled={pending || ship?.alive === false || !docked || !wallet.cargo} onClick={() => send('deliver')}>Unload · earn {wallet.cargo * ORE_VALUE} credits</button></div><p className="exploration-help">{docked ? 'Earth services ready' : location.atEarth ? 'Brake to use Earth services' : 'Earth services out of range'}</p></div>
      <div className="shipyard-step"><h3>3. Upgrade your ship</h3>{Object.entries(SHIP_UPGRADES).map(([key, offer]) => {
        const level = wallet[key + '_level'], price = offer.costs[level];
        return <article className="shipyard-upgrade" key={key}><div><strong>{offer.name} · {level}/3</strong><p>{offer.description}</p></div><button disabled={pending || !docked || !price || wallet.credits < price} onClick={() => send('upgrade', { upgrade: key, expectedLevel: level })}>{price ? price + ' credits' : 'Max level'}</button></article>;
      })}</div>
      <p className="exploration-help">Game credits have no cash value. Support contributions and future VIP plans are separate from ship upgrades.</p>
    </> : null}
  </>;
}
