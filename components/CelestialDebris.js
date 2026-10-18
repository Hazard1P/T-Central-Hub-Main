'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { COSMIC_POSITIONS } from '@/lib/cosmicLayout';
import { createDebrisField, debrisNoise } from '@/lib/celestialDebris';

const finish = '\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n';
const noise = `float hash(vec3 p){p=fract(p*.3183099+vec3(.11,.27,.39));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float noise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*noise3(p);p=p*2.03+vec3(7.3,2.8,1.9);a*=.5;}return v;}`;

function rockGeometry(seed, detail) {
  const geometry = new THREE.IcosahedronGeometry(1, detail);
  const position = geometry.attributes.position;
  const craters = Array.from({ length: 9 }, (_, index) => {
    const theta = debrisNoise(seed * 31 + index) * Math.PI * 2, y = debrisNoise(seed * 17 + index) * 2 - 1;
    return { normal: new THREE.Vector3(Math.cos(theta) * Math.sqrt(1 - y * y), y, Math.sin(theta) * Math.sqrt(1 - y * y)), width: .07 + debrisNoise(seed + index * 2) * .22 };
  });
  const v = new THREE.Vector3();
  for (let index = 0; index < position.count; index += 1) {
    v.fromBufferAttribute(position, index).normalize();
    let radius = 1 + Math.sin(v.x * 5 + seed) * Math.cos(v.z * 4 - seed) * .12 + Math.sin(v.y * 11 + v.x * 7) * .045;
    for (const crater of craters) {
      const d = 1 - v.dot(crater.normal), w = crater.width * crater.width;
      radius -= Math.exp(-d / w * 5) * .16;
      radius += Math.exp(-((d - w) ** 2) / (w * w) * 30) * .04;
    }
    v.multiplyScalar(radius); position.setXYZ(index, v.x, v.y * (.8 + debrisNoise(seed) * .25), v.z);
  }
  geometry.computeVertexNormals(); geometry.computeBoundingSphere(); return geometry;
}

function RockMaterial({ ice = false, lightDirection }) {
  const uniforms = useMemo(() => ({ lightDirection: { value: new THREE.Vector3(...(lightDirection || [-.7, .4, -.8])).normalize() }, ice: { value: ice ? 1 : 0 } }), [ice, lightDirection]);
  return <shaderMaterial uniforms={uniforms} vertexShader={`varying vec3 rock;varying vec3 worldNormal;varying vec3 toEye;
    void main(){rock=position;vec4 p=vec4(position,1.);vec3 n=normal;
    #ifdef USE_INSTANCING
      p=instanceMatrix*p;n=mat3(instanceMatrix)*n;
    #endif
    vec4 world=modelMatrix*p;worldNormal=normalize(mat3(modelMatrix)*n);toEye=cameraPosition-world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}
  `} fragmentShader={`varying vec3 rock;varying vec3 worldNormal;varying vec3 toEye;uniform vec3 lightDirection;uniform float ice;${noise}
    void main(){float ridges=fbm(rock*8.);float grit=noise3(rock*110.);float pits=smoothstep(.15,.45,noise3(rock*37.));
    vec3 n=normalize(worldNormal);vec3 fine=vec3(dFdx(ridges),dFdy(ridges),0.);float day=max(dot(normalize(n-fine*.8),lightDirection),0.);
    vec3 basalt=mix(vec3(.085,.095,.11),vec3(.37,.29,.21),ridges);basalt=mix(basalt,vec3(.42,.45,.46),smoothstep(.88,.97,grit)*.5);
    vec3 frost=mix(vec3(.2,.28,.31),vec3(.66,.78,.82),smoothstep(.38,.7,ridges));vec3 color=mix(basalt,frost,ice);
    float spec=pow(max(dot(reflect(-lightDirection,n),normalize(toEye)),0.),ice>.5?32.:7.)*.12;
    gl_FragColor=vec4(color*(.12+day*1.3)*(.7+pits*.3)+spec,1.);${finish}}
  `} />;
}

function RockBatch({ rocks, variant, profile, lightDirection }) {
  const mesh = useRef(null);
  const geometry = useMemo(() => rockGeometry(variant * 19 + 7, profile.segments > 32 ? 3 : 2), [variant, profile.segments]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(() => {
    const time = profile.animate ? Date.now() / 1000 * .035 : 0;
    rocks.forEach((rock, index) => {
      dummy.position.set(...rock.position); dummy.rotation.set(rock.rotation[0] + time * .3, rock.rotation[1] + time, rock.rotation[2] - time * .4);
      dummy.scale.setScalar(rock.radius); dummy.updateMatrix(); mesh.current?.setMatrixAt(index, dummy.matrix);
    });
    if (mesh.current) mesh.current.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={mesh} args={[geometry, null, rocks.length]} frustumCulled={false}><RockMaterial lightDirection={lightDirection} /></instancedMesh>;
}

function Comet({ profile }) {
  const group = useRef(null), dust = useRef(null);
  const geometry = useMemo(() => rockGeometry(531, profile.segments > 32 ? 3 : 2), [profile.segments]);
  const dustGeometry = useMemo(() => {
    const count = profile.asteroids > 40 ? 190 : 64, positions = new Float32Array(count * 3), opacity = new Float32Array(count);
    for (let index = 0; index < count; index += 1) {
      const t = debrisNoise(index + 718), angle = debrisNoise(index + 34) * Math.PI * 2, width = .45 + t * 4;
      positions.set([Math.cos(angle) * width, Math.sin(angle) * width * .6, 1 + t * 34], index * 3); opacity[index] = (1 - t) * .6;
    }
    const result = new THREE.BufferGeometry(); result.setAttribute('position', new THREE.BufferAttribute(positions, 3)); result.setAttribute('opacity', new THREE.BufferAttribute(opacity, 1)); return result;
  }, [profile.asteroids]);
  useEffect(() => () => { geometry.dispose(); dustGeometry.dispose(); }, [geometry, dustGeometry]);
  useFrame(() => {
    const t = profile.animate ? Date.now() / 1000 * .006 : 0;
    if (!group.current) return;
    group.current.position.set(24 + Math.sin(t) * 18, 13 + Math.sin(t * .7) * 7, 68 + Math.cos(t) * 11);
    // Dust and ion tails point away from the main stellar anchor, not behind arbitrary velocity.
    const away = group.current.position.clone().sub(new THREE.Vector3(...COSMIC_POSITIONS.solar_system)).normalize();
    group.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), away);
    if (dust.current) dust.current.rotation.z = t * .3;
  });
  return <group ref={group}>
    <mesh geometry={geometry} scale={[1.1, .8, 1.7]}><RockMaterial ice /></mesh>
    <mesh scale={[2.6, 2.6, 2.6]}><sphereGeometry args={[1, 24, 16]} /><shaderMaterial transparent depthWrite={false} blending={THREE.AdditiveBlending} vertexShader={`varying vec3 n;varying vec3 eye;void main(){n=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);eye=-mv.xyz;gl_Position=projectionMatrix*mv;}`} fragmentShader={`varying vec3 n;varying vec3 eye;void main(){float glow=pow(1.-abs(dot(normalize(n),normalize(eye))),2.);gl_FragColor=vec4(.26,.65,.8,glow*.12);${finish}}`} /></mesh>
    <points ref={dust} geometry={dustGeometry} frustumCulled={false}><shaderMaterial transparent depthWrite={false} blending={THREE.AdditiveBlending} vertexShader={`attribute float opacity;varying float alpha;void main(){alpha=opacity;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(350./max(1.,-mv.z),2.,24.);gl_Position=projectionMatrix*mv;}`} fragmentShader={`varying float alpha;void main(){float r=length(gl_PointCoord-vec2(.5));gl_FragColor=vec4(.4,.7,.86,(1.-smoothstep(.05,.5,r))*alpha);${finish}}`} /></points>
    <mesh position={[0, 0, 13]} rotation={[Math.PI / 2, 0, 0]}><coneGeometry args={[.4, 28, 12, 1, true]} /><meshBasicMaterial color="#8fceff" transparent opacity={.06} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} /></mesh>
  </group>;
}

export default function CelestialDebris({ profile, bus, localOrbit = false, lightDirection }) {
  const rocks = useMemo(() => createDebrisField(profile.asteroids, localOrbit), [profile.asteroids, localOrbit]);
  useEffect(() => {
    if (!bus) return;
    bus.current.colliders = rocks;
    return () => { if (bus.current.colliders === rocks) bus.current.colliders = []; };
  }, [rocks, bus]);
  return <>
    {[0, 1, 2].map((variant) => <RockBatch key={variant} variant={variant} rocks={rocks.filter((_, index) => index % 3 === variant)} profile={profile} lightDirection={lightDirection} />)}
    {!localOrbit ? <Comet profile={profile} /> : null}
  </>;
}
