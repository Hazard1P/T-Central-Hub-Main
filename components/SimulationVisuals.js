'use client';

import { memo, useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { EXPLORATION_LANDMARKS } from '@/lib/exploration';
import CelestialDebris from '@/components/CelestialDebris';
import { useUniverseFrame } from '@/components/UniverseFrame';

const noise = `
float hash(vec3 p) { p=fract(p*.3183099+vec3(.11,.27,.39)); p*=17.; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float noise3(vec3 p) {
 vec3 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
 return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float fbm(vec3 p) { float v=0.,a=.5; for(int i=0;i<5;i++){v+=a*noise3(p); p=p*2.03+vec3(7.3,2.8,1.9);a*=.5;}return v; }
`;
const vertex = `varying vec3 vLocal; varying vec3 vNormal; varying vec3 vView; varying vec3 vWorldNormal;
void main(){vLocal=position;vWorldNormal=normalize(mat3(modelMatrix)*normal);vNormal=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);vView=-mv.xyz;gl_Position=projectionMatrix*mv;}`;
const finish = `
#include <tonemapping_fragment>\n#include <colorspace_fragment>`;

export const NebulaSky = memo(function NebulaSky({ animate = true, detail = 5 }) {
  const mesh = useRef();
  const { origin } = useUniverseFrame();
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  useFrame(({ camera, clock }) => {
    mesh.current?.position.copy(camera.position).add(origin.current);
    uniforms.uTime.value = animate ? clock.elapsedTime * .004 : 0;
  });
  return (
    <mesh ref={mesh} renderOrder={-100}>
      <sphereGeometry args={[480, 48, 32]} />
      <shaderMaterial side={THREE.BackSide} depthWrite={false} uniforms={uniforms} vertexShader={vertex} fragmentShader={`
        varying vec3 vLocal; uniform float uTime; ${noise.replace('i<5', `i<${detail}`)}
        void main(){
          vec3 d=normalize(vLocal); vec3 p=d*4.2+vec3(uTime,0.,0.);
          float clouds=fbm(p+fbm(p*1.7)*1.8);
          float band=exp(-pow((d.y+d.x*.27-.08)*2.5,2.));
          float dust=smoothstep(.3,.8,fbm(p*3.1));
          float filaments=pow(max(clouds-.24,0.)*1.8,2.6)*band;
          vec3 cool=mix(vec3(.012,.035,.075),vec3(.075,.31,.39),smoothstep(.2,.7,clouds));
          vec3 warm=vec3(.31,.12,.065);
          vec3 nebula=mix(cool,warm,smoothstep(-.2,.65,d.x)) * filaments;
          nebula*=1.-dust*.74;
          gl_FragColor=vec4(vec3(.002,.004,.012)+nebula,1.);
          ${finish}
        }`} />
    </mesh>
  );
});

export const Atmosphere = memo(function Atmosphere({ radius, color = '#73cfff', segments = 48 }) {
  const uniforms = useMemo(() => ({ uColor: { value: new THREE.Color(color) } }), [color]);
  return <mesh scale={1.055}>
    <sphereGeometry args={[radius, segments, segments / 2]} />
    <shaderMaterial uniforms={uniforms} vertexShader={vertex} transparent depthWrite={false} blending={THREE.AdditiveBlending} fragmentShader={`
      varying vec3 vNormal; varying vec3 vView; varying vec3 vWorldNormal; uniform vec3 uColor;
      void main(){float rim=pow(1.-max(dot(normalize(vNormal),normalize(vView)),0.),3.8);float day=smoothstep(-.4,.6,dot(normalize(vWorldNormal),normalize(vec3(-.7,.4,-.8))));vec3 color=mix(uColor*.28,uColor*1.4,day);gl_FragColor=vec4(color,rim*.62);${finish}}
    `} />
  </mesh>;
});

export const PlanetSurface = memo(function PlanetSurface({ radius = 1, color = '#7bacbd', gas = false, segments = 48 }) {
  const uniforms = useMemo(() => ({ uColor: { value: new THREE.Color(color) }, uGas: { value: gas ? 1 : 0 } }), [color, gas]);
  return <mesh>
    <sphereGeometry args={[radius, segments, segments / 2]} />
    <shaderMaterial uniforms={uniforms} vertexShader={vertex} fragmentShader={`
      varying vec3 vLocal;varying vec3 vNormal;varying vec3 vView;varying vec3 vWorldNormal;uniform vec3 uColor;uniform float uGas;${noise}
      void main(){
        vec3 n=normalize(vLocal);float terrain=fbm(n*5.);float detail=fbm(n*24.);
        float storm=fbm(n*13.+vec3(terrain*4.));
        float bands=sin(n.y*38.+terrain*11.+storm*3.)*.5+.5;
        vec3 rock=mix(vec3(.025,.085,.13),uColor,smoothstep(.4,.58,terrain));
        rock=mix(rock,vec3(.78,.88,.92),smoothstep(.83,.98,abs(n.y)));
        vec3 gas=mix(uColor*.32,uColor*1.35,bands*.7+detail*.3);
        vec3 surface=mix(rock,gas,uGas);
        vec3 sunDirection=normalize(vec3(-.7,.4,-.8));
        float sun=dot(normalize(vWorldNormal),sunDirection);
        float lighting=.035+max(sun,0.)*.95;
        float clouds=smoothstep(.56,.72,fbm(n*8.+vec3(.7,0.,0.)));
        surface=mix(surface,vec3(.85,.9,.95),clouds*.7*(1.-uGas));
        float ocean=(1.-smoothstep(.4,.5,terrain))*(1.-uGas);
        float spec=pow(max(dot(reflect(-normalize((viewMatrix*vec4(sunDirection,0.)).xyz),normalize(vNormal)),normalize(vView)),0.),48.)*ocean;
        vec3 twilight=vec3(.15,.28,.4)*exp(-abs(sun)*12.)*(1.-uGas);
        gl_FragColor=vec4(surface*lighting+spec*.55+twilight*.12,1.);${finish}
      }`} />
  </mesh>;
});

export function AccretionDisk({ radius = 1, color = '#ffb35c', animate = true, emissive = true }) {
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uColor: { value: new THREE.Color(color) }, uRadius: { value: radius }, uEmission: { value: emissive ? 1 : .48 } }), [radius, color, emissive]);
  useFrame(({ clock }) => { uniforms.uTime.value = animate ? clock.elapsedTime : 0; });
  return <mesh rotation={[1.12, .18, -.22]}>
    <ringGeometry args={[radius * 1.05, radius * 2.9, 96, 2]} />
    <shaderMaterial uniforms={uniforms} vertexShader={vertex} side={THREE.DoubleSide} transparent depthWrite={false} blending={emissive ? THREE.AdditiveBlending : THREE.NormalBlending} fragmentShader={`
      varying vec3 vLocal;uniform float uTime;uniform vec3 uColor;uniform float uRadius;uniform float uEmission;
      void main(){
        float r=length(vLocal.xy)/uRadius;float a=atan(vLocal.y,vLocal.x);
        float streak=sin(r*87.+sin(a*3.+uTime*.4)*2.-uTime*1.4)*.5+.5;
        float spiral=sin(a*9.-r*15.+uTime*.7)*.5+.5;
        float envelope=smoothstep(1.05,1.2,r)*(1.-smoothstep(1.25,2.9,r));
        vec3 c=mix(vec3(1.,.88,.66),uColor,smoothstep(1.1,2.2,r));
        gl_FragColor=vec4(c*(.8+streak*.45)*uEmission,envelope*(.35+streak*.4+spiral*.15));${finish}
      }`} />
  </mesh>;
}

export const BlackHoleVisual = memo(function BlackHoleVisual({ radius = 1, color = '#ffb35c', animate = true }) {
  return <group>
    <mesh><sphereGeometry args={[radius, 48, 32]} /><meshBasicMaterial color="#000105" /></mesh>
    <Atmosphere radius={radius} color="#cfa65d" />
    <AccretionDisk radius={radius} color={color} animate={animate} />
    <mesh rotation={[.12, .22, 0]}>
      <torusGeometry args={[radius * 1.06, radius * .018, 8, 96]} />
      <meshBasicMaterial color={[3, 1.9, .8]} toneMapped={false} />
    </mesh>
  </group>;
});

export const StellarSurface = memo(function StellarSurface({ radius = 1, color = '#ffd38b', animate = true }) {
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uColor: { value: new THREE.Color(color) } }), [color]);
  useFrame(({ clock }) => { uniforms.uTime.value = animate ? clock.elapsedTime * .04 : 0; });
  return <group>
    <mesh><sphereGeometry args={[radius, 48, 32]} />
      <shaderMaterial uniforms={uniforms} vertexShader={vertex} fragmentShader={`
        varying vec3 vLocal;varying vec3 vNormal;varying vec3 vView;uniform float uTime;uniform vec3 uColor;${noise}
        void main(){
          vec3 n=normalize(vLocal);float granules=fbm(n*18.+uTime);float field=fbm(n*6.+uTime*.3);
          float limb=pow(max(dot(normalize(vNormal),normalize(vView)),0.),.35);
          float spots=mix(.24,1.,smoothstep(.30,.45,field));
          vec3 plasma=mix(vec3(1.,.27,.045),uColor,granules*.7);
          gl_FragColor=vec4(plasma*(.65+granules*.85)*spots*(.5+limb*.5),1.);${finish}}
      `} />
    </mesh>
    <Atmosphere radius={radius * 1.04} color={color} />
  </group>;
});

export const PlanetRings = memo(function PlanetRings({ radius, color = '#c6b8a4' }) {
  const uniforms = useMemo(() => ({ uColor: { value: new THREE.Color(color) }, uRadius: { value: radius } }), [color, radius]);
  return <mesh rotation={[Math.PI / 2 + .34, .13, -.12]}>
    <ringGeometry args={[radius * 1.28, radius * 2.05, 160]} />
    <shaderMaterial uniforms={uniforms} vertexShader={vertex} side={THREE.DoubleSide} transparent depthWrite={false} fragmentShader={`
      varying vec3 vLocal;uniform vec3 uColor;uniform float uRadius;
      void main(){
        float r=length(vLocal.xy)/uRadius;
        float lanes=sin(r*330.)*.12+sin(r*119.)*.16+sin(r*53.)*.12;
        float gap=1.-smoothstep(.008,.022,abs(r-1.73));
        float fade=smoothstep(1.28,1.32,r)*(1.-smoothstep(1.98,2.05,r));
        float shadow=mix(.2,1.,smoothstep(-.2,.1,vLocal.x/uRadius+abs(vLocal.y/uRadius)*.8));
        vec3 c=mix(uColor*.5,uColor*1.15,smoothstep(1.3,2.,r)+lanes);
        gl_FragColor=vec4(c*shadow,fade*(.65+lanes)*(1.-gap*.93));${finish}
      }`} />
  </mesh>;
});

function OrbitalClouds({ radius, animate }) {
  const mesh = useRef();
  useFrame((_, delta) => { if (mesh.current && animate) mesh.current.rotation.y += delta * .008; });
  return <mesh ref={mesh}>
    <sphereGeometry args={[radius * 1.009, 64, 32]} />
    <shaderMaterial vertexShader={vertex} transparent depthWrite={false} fragmentShader={`
      varying vec3 vLocal; varying vec3 vWorldNormal; ${noise}
      void main(){vec3 n=normalize(vLocal);float cloud=smoothstep(.54,.72,fbm(n*8.+fbm(n*4.)*2.));float day=max(dot(normalize(vWorldNormal),normalize(vec3(-.7,.4,-.8))),.025);gl_FragColor=vec4(vec3(.87,.94,1.)*day,cloud*.7);${finish}}
    `} />
  </mesh>;
}

function OrbitalPlanet({ node, profile }) {
  const surface = useRef();
  useFrame((_, delta) => { if (surface.current && profile.animate) surface.current.rotation.y += delta * .012; });
  const gas = node.key === 'halcyon';
  return <group position={node.position} rotation={gas ? [.1, -.4, -.27] : [0, 0, -.16]}>
    <group ref={surface}><PlanetSurface radius={node.radius} color={node.color} gas={gas} segments={profile.segments} /></group>
    <Atmosphere radius={node.radius} color={gas ? '#efd0a1' : '#70d6ff'} segments={profile.segments} />
    {gas ? <PlanetRings radius={node.radius} /> : profile.clouds ? <OrbitalClouds radius={node.radius} animate={profile.animate} /> : null}
  </group>;
}

export const DeepSpaceScenery = memo(function DeepSpaceScenery({ profile, weaponBus }) {
  return <>
    <NebulaSky animate={profile.animate} detail={profile.bloom ? 5 : 3} />
    {EXPLORATION_LANDMARKS.filter((node) => node.kind === 'planet').map((node) => <OrbitalPlanet key={node.key} node={node} profile={profile} />)}
    <CelestialDebris profile={profile} bus={weaponBus} />
    <hemisphereLight args={['#99c8ec','#10182e',1.1]} />
    <directionalLight position={[-30,25,-15]} color="#ffe3bd" intensity={2.6} />
    <directionalLight position={[20,5,10]} color="#63baff" intensity={2.2} />
    <Environment resolution={128} frames={1}>
      <Lightformer intensity={2.5} color="#d6edff" position={[0,5,-3]} scale={[10,6,1]} rotation={[Math.PI/2,0,0]} />
      <Lightformer intensity={3} color="#68bfff" position={[5,1,0]} scale={[4,8,1]} rotation={[0,-Math.PI/2,0]} />
      <Lightformer intensity={1.5} color="#ffe0b7" position={[-5,1,0]} scale={[4,8,1]} rotation={[0,Math.PI/2,0]} />
    </Environment>
  </>;
});

// Three's own postprocessing keeps the lockfile unchanged and supports explicit cleanup.
export const CinematicBloom = memo(function CinematicBloom() {
  const { gl, scene, camera, size, viewport } = useThree();
  const composer = useMemo(() => {
    const chain=new EffectComposer(gl);
    chain.addPass(new RenderPass(scene,camera));
    const bloom=new UnrealBloomPass(new THREE.Vector2(1,1),.22,.32,1.5);
    chain.addPass(bloom);chain.addPass(new OutputPass());
    return chain;
  },[gl,scene,camera]);
  useEffect(()=>{composer.setPixelRatio(Math.min(viewport.dpr, 1.4));composer.setSize(size.width,size.height);},[composer,size.width,size.height,viewport.dpr]);
  useEffect(()=>()=>{composer.passes.forEach(pass=>pass.dispose?.());composer.dispose();},[composer]);
  useFrame((_,delta)=>composer.render(delta),1);
  return null;
});

function HullPlate({ points, depth = .16, color = '#9aafbd', ...props }) {
  const shape = useMemo(()=>{const s=new THREE.Shape();points.forEach(([x,z],i)=>i?s.lineTo(x,z):s.moveTo(x,z));s.closePath();return s;},[points]);
  return <mesh {...props} rotation={[Math.PI/2,0,0]}>
    <extrudeGeometry args={[shape,{depth,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.035,bevelThickness:.025}]} />
    <meshStandardMaterial color={color} metalness={.72} roughness={.32} />
  </mesh>;
}

export const InterceptorHull = memo(function InterceptorHull() {
  return <group>
    <HullPlate points={[[0,3.05],[.62,1.2],[.7,-1.65],[-.7,-1.65],[-.62,1.2]]} depth={.42} position={[0,.16,0]} color="#b8c8d1" />
    <HullPlate points={[[.54,1.25],[2.65,-1.55],[2.4,-2.05],[.62,-1.22]]} position={[0,-.02,0]} />
    <HullPlate points={[[-.54,1.25],[-2.65,-1.55],[-2.4,-2.05],[-.62,-1.22]]} position={[0,-.02,0]} />
    <HullPlate points={[[.58,.35],[1.6,-.9],[.65,-.8]]} position={[0,.09,0]} color="#d8e1e7" depth={.07} />
    <HullPlate points={[[-.58,.35],[-1.6,-.9],[-.65,-.8]]} position={[0,.09,0]} color="#d8e1e7" depth={.07} />
    <mesh position={[0,.28,.72]} scale={[.42,.23,.95]}>
      <sphereGeometry args={[1,32,16]} /><meshPhysicalMaterial color="#092336" metalness={.6} roughness={.12} clearcoat={1} clearcoatRoughness={.08} />
    </mesh>
    <mesh position={[0,.54,-.92]} rotation={[.3,0,0]}><boxGeometry args={[.075,.72,.64]} /><meshStandardMaterial color="#344f68" metalness={.7} roughness={.28} /></mesh>
    <mesh position={[0,.2,-.5]}><boxGeometry args={[.08,.055,1.8]} /><meshStandardMaterial color="#24374a" metalness={.8} roughness={.3} /></mesh>
    <mesh position={[0,.12,2]}><boxGeometry args={[.07,.035,1.2]} /><meshBasicMaterial color="#68e7ff" toneMapped={false} /></mesh>
    {[-1,1].map(side=><group key={side}>
      <mesh position={[side*1.4,.05,.6]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[.075,.11,1.55,12]} /><meshStandardMaterial color="#384d60" metalness={.85} roughness={.25} /></mesh>
      <mesh position={[side*1.4,.05,1.4]}><torusGeometry args={[.08,.025,6,12]} /><meshBasicMaterial color="#87eaff" toneMapped={false} /></mesh>
      <mesh position={[side*.69,.22,-1.1]} rotation={[Math.PI/2,0,0]}>
        <cylinderGeometry args={[.24,.32,1.2,16]} /><meshStandardMaterial color="#28394c" metalness={.8} roughness={.3} />
      </mesh>
      <mesh position={[side*.69,.22,-1.74]} rotation={[Math.PI/2,0,0]}>
        <torusGeometry args={[.22,.055,8,20]} /><meshStandardMaterial color="#68849b" metalness={.9} roughness={.24} />
      </mesh>
      <mesh position={[side*.69,.22,-1.78]}>
        <circleGeometry args={[.17,20]} /><meshBasicMaterial color={[.5,2.5,4]} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <mesh position={[side*2.32,.05,-1.4]}><boxGeometry args={[.06,.045,.58]} /><meshBasicMaterial color={side<0?'#ff6557':'#58e7db'} toneMapped={false} /></mesh>
      <mesh position={[side*1.58,.04,-1.22]}><boxGeometry args={[.055,.035,1.15]} /><meshBasicMaterial color="#c4efff" /></mesh>
      {[0,1,2,3].map(i=><mesh key={i} position={[side*.46,.19,-.4-i*.23]}>
        <boxGeometry args={[.16,.045,.085]} /><meshStandardMaterial color="#182a3d" metalness={.4} roughness={.6} />
      </mesh>)}
    </group>)}
  </group>;
});
