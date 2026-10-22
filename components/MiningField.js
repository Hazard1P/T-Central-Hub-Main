'use client';
import { useMemo } from 'react';
import { RockBatch } from './CelestialDebris';
import { miningGeometry } from '@/lib/shipEconomy';

export default function MiningField({ profile, utcMs, rocks = {} }) {
  const geometry = useMemo(() => miningGeometry(utcMs || Date.now()), [utcMs]);
  const visible = geometry.rocks.filter(rock => !(rocks[rock.id]?.hp === 0 && rocks[rock.id].depleted_until > (utcMs || Date.now())))
    .map(rock => ({ ...rock, position: rock.local }));
  return <group position={geometry.center}>
    {[0,1,2,3,4,5].map(variant => <RockBatch key={variant + ':' + visible.map(rock => rock.id).join(',')} variant={variant} rocks={visible.filter(rock => rock.index % 6 === variant)} profile={profile} />)}
    <mesh position={[0, -100, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[20, .6, 8, 48]} /><meshBasicMaterial color="#eac681" /></mesh>
  </group>;
}
