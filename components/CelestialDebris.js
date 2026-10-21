'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { UNIVERSE_LANDMARKS } from '@/lib/universeSpace';
import { COSMIC_POSITIONS } from '@/lib/cosmicLayout';
import { createDebrisField, debrisNoise } from '@/lib/celestialDebris';

const finish = '\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n';
const noise = `float hash(vec3 p){p=fract(p*.3183099+vec3(.11,.27,.39));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float noise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*noise3(p);p=p*2.03+vec3(7.3,2.8,1.9);a*=.5;}return v;}`;

function rockGeometry(seed, detail) {
  const geometry = new THREE.IcosahedronGeometry(1, detail);
  const position = geometry.attributes.position;
  const craters = Array.from({ length: 32 }, (_, index) => {
    const theta = debrisNoise(seed * 31 + index) * Math.PI * 2, y = debrisNoise(seed * 17 + index) * 2 - 1;
    return { normal: new THREE.Vector3(Math.cos(theta) * Math.sqrt(1 - y * y), y, Math.sin(theta) * Math.sqrt(1 - y * y)), width: .035 + debrisNoise(seed + index * 2) * .25 };
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

function RockMaterial({ ice = false, lightDirection, variant = 0 }) {
  const uniforms = useMemo(() => ({ lightDirection: { value: new THREE.Vector3(...(lightDirection || [-.7, .4, -.8])).normalize() }, ice: { value: ice ? 1 : 0 }, mineral: { value: variant / 5 } }), [ice, lightDirection, variant]);
  return <shaderMaterial uniforms={uniforms} vertexShader={`varying vec3 rock;varying vec3 worldNormal;varying vec3 worldPoint;varying vec3 toEye;varying float seed;
    void main(){rock=position;vec4 p=vec4(position,1.);vec3 n=normal;seed=0.;
    #ifdef USE_INSTANCING
      seed=dot(instanceMatrix[3].xyz,vec3(.13,.29,.07));
      p=instanceMatrix*p;n=mat3(instanceMatrix)*n;
    #endif
    vec4 world=modelMatrix*p;worldPoint=world.xyz;worldNormal=normalize(mat3(modelMatrix)*n);toEye=cameraPosition-world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}
  `} fragmentShader={`varying vec3 rock;varying vec3 worldNormal;varying vec3 worldPoint;varying vec3 toEye;varying float seed;uniform vec3 lightDirection;uniform float ice;uniform float mineral;${noise}
    void main(){vec3 samplePoint=rock+vec3(seed*.19,seed*.31,seed*.07);
    float strata=fbm(samplePoint*7.);float grit=noise3(samplePoint*145.);float pores=noise3(samplePoint*43.);
    float vein=1.-smoothstep(.015,.065,abs(noise3(samplePoint*19.)-.5));
    float fracture=1.-smoothstep(.012,.038,abs(noise3(samplePoint*30.+strata*3.)-.46));
    float terraces=sin((samplePoint.y+strata*.18)*72.)*.5+.5;
    float height=strata*.12+pores*.023+grit*.008-fracture*.012;
    vec3 n=normalize(worldNormal), dx=dFdx(worldPoint), dy=dFdy(worldPoint);
    vec3 r1=cross(dy,n),r2=cross(n,dx);float det=dot(dx,r1);
    vec3 gradient=sign(det)*(dFdx(height)*r1+dFdy(height)*r2)/max(abs(det),.00001);
    n=normalize(n-gradient*.65);float day=max(dot(n,lightDirection),0.);
    vec3 carbon=mix(vec3(.075,.085,.095),vec3(.3,.23,.17),smoothstep(.2,.8,strata));
    vec3 silicate=mix(vec3(.14,.16,.17),vec3(.43,.38,.31),strata);
    vec3 basalt=mix(carbon,silicate,mineral);basalt*=.8+terraces*.16+grit*.12;
    basalt=mix(basalt,vec3(.45,.36,.22),vein*.24);basalt*=1.-fracture*.43;
    float icePatch=smoothstep(.48,.72,fbm(samplePoint*5.3));
    vec3 frost=mix(basalt*.8,vec3(.67,.78,.8)*( .75+grit*.25),icePatch);
    vec3 color=mix(basalt,frost,ice);float rough=mix(.95,.45,ice*icePatch);
    float spec=pow(max(dot(reflect(-lightDirection,n),normalize(toEye)),0.),mix(9.,55.,1.-rough))*(.05+icePatch*ice*.23);
    float rim=pow(1.-max(dot(n,normalize(toEye)),0.),3.)*.035;
    gl_FragColor=vec4(color*(.2+day*1.35)+spec+vec3(.3,.46,.57)*rim,1.);${finish}}
  `} />;
}

function RockBatch({ rocks, variant, profile, lightDirection }) {
  const mesh = useRef(null);
  const geometry = useMemo(() => rockGeometry(variant * 19 + 7, profile.segments > 32 ? 6 : 3), [variant, profile.segments]);
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
  return <instancedMesh ref={mesh} args={[geometry, null, rocks.length]} frustumCulled={false}><RockMaterial lightDirection={lightDirection} variant={variant} /></instancedMesh>;
}

function Comet({ profile, index = 0 }) {
  const group = useRef(null), dust = useRef(null);
  const geometry = useMemo(() => rockGeometry(531 + index * 37, profile.segments > 32 ? 6 : 3), [profile.segments, index]);
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
    const t = (profile.animate ? Date.now() / 1000 * .006 : 0) + index * 2.3;
    if (!group.current) return;
    group.current.position.set(24 + index * 75 + Math.sin(t) * (18 + index * 12), 13 + index * 9 + Math.sin(t * .7) * 7, 68 - index * 45 + Math.cos(t) * 11);
    // Dust and ion tails point away from the main stellar anchor, not behind arbitrary velocity.
    const away = new THREE.Vector3(...UNIVERSE_LANDMARKS.find(node => node.key === 'asteroid_belt').position).sub(new THREE.Vector3(...COSMIC_POSITIONS.solar_system)).normalize();
    group.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), away);
    if (dust.current) dust.current.rotation.z = t * .3;
  });
  return <group ref={group}>
    <mesh geometry={geometry} scale={[1.1, .8, 1.7]}><RockMaterial ice variant={index} /></mesh>
    <mesh geometry={geometry} position={[.2, .15, -.95]} rotation={[.4, .8, .2]} scale={[.72, .65, .9]}><RockMaterial ice variant={index + 2} /></mesh>
    <mesh scale={[2.6, 2.6, 2.6]}><sphereGeometry args={[1, 24, 16]} /><shaderMaterial transparent depthWrite={false} blending={THREE.AdditiveBlending} vertexShader={`varying vec3 n;varying vec3 eye;void main(){n=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);eye=-mv.xyz;gl_Position=projectionMatrix*mv;}`} fragmentShader={`varying vec3 n;varying vec3 eye;void main(){float glow=pow(1.-abs(dot(normalize(n),normalize(eye))),2.);gl_FragColor=vec4(.26,.65,.8,glow*.12);${finish}}`} /></mesh>
    <points ref={dust} geometry={dustGeometry} frustumCulled={false}><shaderMaterial transparent depthWrite={false} blending={THREE.AdditiveBlending} vertexShader={`attribute float opacity;varying float alpha;void main(){alpha=opacity;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(350./max(1.,-mv.z),2.,24.);gl_Position=projectionMatrix*mv;}`} fragmentShader={`varying float alpha;void main(){float r=length(gl_PointCoord-vec2(.5));gl_FragColor=vec4(.4,.7,.86,(1.-smoothstep(.05,.5,r))*alpha);${finish}}`} /></points>
    <mesh position={[0, 0, 13]} rotation={[Math.PI / 2, 0, 0]}><coneGeometry args={[.4, 28, 12, 1, true]} /><meshBasicMaterial color="#8fceff" transparent opacity={.06} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} /></mesh>
  </group>;
}

export default function CelestialDebris({ profile, bus, localOrbit = false, lightDirection }) {
  const anchor = localOrbit ? [0, 0, 0] : UNIVERSE_LANDMARKS.find(node => node.key === 'asteroid_belt').position;
  const rocks = useMemo(() => createDebrisField(profile.asteroids, localOrbit).map(rock => localOrbit ? rock : ({ ...rock, position: rock.position.map(v => v * 40), radius: rock.radius * 40 })), [profile.asteroids, localOrbit]);
  const colliders = useMemo(() => rocks.map(rock => ({ ...rock, position: rock.position.map((v, i) => v + anchor[i]) })), [rocks, localOrbit]);
  useEffect(() => {
    if (!bus) return;
    bus.current.colliders = colliders;
    return () => { if (bus.current.colliders === colliders) bus.current.colliders = []; };
  }, [colliders, bus]);
  return <group position={anchor}>
    {[0, 1, 2, 3, 4, 5].map((variant) => <RockBatch key={variant} variant={variant} rocks={rocks.filter((_, index) => index % 6 === variant)} profile={profile} lightDirection={lightDirection} />)}
    {!localOrbit ? [0, 1, 2].map((index) => <group key={index} scale={40}><Comet index={index} profile={profile} /></group>) : null}
  </group>;
}
