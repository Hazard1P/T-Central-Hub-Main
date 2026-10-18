'use client';

import { Suspense, useMemo, useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';

const surfaceVertex = `varying vec3 nWorld; varying vec3 local; varying vec2 texCoord; varying vec3 toEye;
void main(){texCoord=uv;local=position;nWorld=normalize(mat3(modelMatrix)*normal);vec4 world=modelMatrix*vec4(position,1.);toEye=cameraPosition-world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`;
const noise = `float hash(vec3 p){p=fract(p*.3183099+vec3(.11,.27,.39));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float noise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise3(p);p=p*2.03+vec3(7.3,2.8,1.9);a*=.5;}return v;}`;
const finish = '\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n';

function MappedSurface({ body, uniforms, segments }) {
  const files = body.id === 'earth' ? ['earth_atmos_2048.jpg', 'earth_specular_2048.jpg'] : ['moon_1024.jpg', 'moon_1024.jpg'];
  const textures = useLoader(THREE.TextureLoader, files.map((name) => '/textures/solar-system/' + name));
  textures[0].colorSpace = THREE.SRGBColorSpace;
  const mapped = useMemo(() => ({ ...uniforms, map: { value: textures[0] }, specularMap: { value: textures[1] }, earth: { value: body.id === 'earth' ? 1 : 0 } }), [uniforms, textures, body.id]);
  return <mesh><sphereGeometry args={[1, segments, segments / 2]} /><shaderMaterial uniforms={mapped} vertexShader={surfaceVertex} fragmentShader={`
    varying vec3 nWorld;varying vec3 local;varying vec2 texCoord;varying vec3 toEye;uniform vec3 sunDirection;uniform sampler2D map;uniform sampler2D specularMap;uniform float earth;
    void main(){vec3 n=normalize(nWorld);float day=max(dot(n,sunDirection),0.);vec3 surface=texture2D(map,texCoord).rgb;
      float spec=pow(max(dot(reflect(-sunDirection,n),normalize(toEye)),0.),48.)*texture2D(specularMap,texCoord).r*earth*day;
      float rim=pow(1.-max(dot(n,normalize(toEye)),0.),4.);vec3 atmosphere=vec3(.09,.32,.65)*rim*smoothstep(-.12,.3,dot(n,sunDirection))*earth;
      gl_FragColor=vec4(surface*(.008+day*.98)+spec*.4+atmosphere,1.);${finish}}
  `} /></mesh>;
}

function ProceduralSurface({ body, uniforms, segments }) {
  const kind = { mercury: 0, venus: 1, mars: 2, jupiter: 3, saturn: 4, uranus: 5, neptune: 6, pluto: 7 }[body.id] ?? 0;
  const material = useMemo(() => ({ ...uniforms, baseColor: { value: new THREE.Color(body.color) }, kind: { value: kind } }), [uniforms, body.color, kind]);
  return <mesh><sphereGeometry args={[1, segments, segments / 2]} /><shaderMaterial uniforms={material} vertexShader={surfaceVertex} fragmentShader={`
    varying vec3 nWorld;varying vec3 local;varying vec2 texCoord;varying vec3 toEye;uniform vec3 sunDirection;uniform vec3 baseColor;uniform float kind;${noise}
    void main(){vec3 p=normalize(local);float terrain=fbm(p*7.);float fine=fbm(p*55.);vec3 surface=baseColor*(.45+terrain*.8+fine*.3);
      if(kind>.5&&kind<1.5){surface=baseColor*(.8+.28*fbm(p*12.));}
      if(kind>1.5&&kind<2.5){surface=mix(baseColor*.3,baseColor*1.18,smoothstep(.3,.72,terrain));surface=mix(surface,vec3(.75,.78,.76),smoothstep(.94,.99,abs(p.y)));}
      if(kind>2.5&&kind<4.5){float bands=sin(p.y*48.+fbm(p*13.)*5.)*.5+.5;surface=mix(baseColor*.5,baseColor*1.12,bands*.6+fine*.3);
        if(kind<3.5){vec2 spot=(texCoord-vec2(.63,.43))*vec2(8.,19.);surface=mix(surface,vec3(.49,.19,.11),(1.-smoothstep(.55,1.,length(spot)))*.7);}}
      if(kind>4.5&&kind<6.5){surface=baseColor*(.85+.1*sin(p.y*32.+terrain*2.)+.1*terrain);}
      if(kind>6.5){surface=mix(baseColor*.35,baseColor*1.25,smoothstep(.3,.7,terrain));}
      float day=max(dot(normalize(nWorld),sunDirection),0.);gl_FragColor=vec4(surface*(.008+day*.98),1.);${finish}}
  `} /></mesh>;
}

function SaturnRings({ sunDirection }) {
  return <mesh rotation={[-Math.PI / 2, 0, 0]}>
    <ringGeometry args={[1.11, 2.32, 192]} /><shaderMaterial transparent side={THREE.DoubleSide} depthWrite={false} uniforms={{ sunDirection }} vertexShader={`varying float radius;varying vec3 nWorld;void main(){radius=length(position.xy);nWorld=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`} fragmentShader={`
      varying float radius;varying vec3 nWorld;uniform vec3 sunDirection;
      void main(){float density=.4+.3*sin(radius*140.)+.15*sin(radius*530.);float cassini=smoothstep(.003,.014,abs(radius-1.96));float inner=smoothstep(1.11,1.45,radius);float light=.1+.9*abs(dot(normalize(nWorld),sunDirection));gl_FragColor=vec4(vec3(.64,.57,.43)*light,clamp(density,.05,.8)*cassini*inner);${finish}}
    `} />
  </mesh>;
}

export function SolarBody({ body, stateRef, originRef, enhanced, onSelect, segments, flightFrame }) {
  const position = useRef(null), axes = useRef(null);
  const uniforms = useMemo(() => ({ sunDirection: { value: new THREE.Vector3(1, 0, 0) } }), []);
  const matrix = useMemo(() => new THREE.Matrix4(), []);
  const x = useMemo(() => new THREE.Vector3(), []), y = useMemo(() => new THREE.Vector3(), []), z = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera }) => {
    const state = stateRef.current.find((entry) => entry.id === body.id);
    if (!state || !position.current || !axes.current) return;
    const relative = new THREE.Vector3(...state.position.map((value, axis) => value - originRef.current[axis]));
    let multiplier = 1;
    if (flightFrame?.current) {
      const frame = flightFrame.current;
      relative.applyQuaternion(frame.rotation).multiplyScalar(frame.unitsPerAu).add(frame.center);
      const offset = relative.clone().sub(camera.position), distance = offset.length();
      multiplier = frame.unitsPerAu;
      // Distant bodies are projected onto the sky at their correct angular size.
      if (distance > 550) { relative.copy(camera.position).add(offset.multiplyScalar(550 / distance)); multiplier *= 550 / distance; }
    }
    position.current.position.copy(relative);
    const radius = state.radiusAu * multiplier * (enhanced && body.id !== 'sun' ? 100 : 1);
    position.current.scale.setScalar(radius);
    const f = body.flattening || 0, equator = 1 / Math.cbrt(1 - f);
    axes.current.scale.set(equator, equator * (1 - f), equator);
    x.set(...state.orientation.x); y.set(...state.orientation.y); z.set(...state.orientation.z);
    if (flightFrame?.current) { x.applyQuaternion(flightFrame.current.rotation); y.applyQuaternion(flightFrame.current.rotation); z.applyQuaternion(flightFrame.current.rotation); }
    matrix.makeBasis(x, y, z); axes.current.quaternion.setFromRotationMatrix(matrix);
    uniforms.sunDirection.value.set(...state.position).negate().normalize();
    if (flightFrame?.current) uniforms.sunDirection.value.applyQuaternion(flightFrame.current.rotation);
  });
  return <group ref={position} onClick={onSelect ? (event) => { event.stopPropagation(); onSelect(body.id); } : undefined}>
    <group ref={axes}>
      {body.id === 'sun' ? <mesh><sphereGeometry args={[1, segments, segments / 2]} /><shaderMaterial vertexShader={surfaceVertex} fragmentShader={`varying vec3 local;varying vec3 nWorld;varying vec3 toEye;${noise}
        void main(){vec3 p=normalize(local);float cells=fbm(p*65.);float zones=fbm(p*12.);float limb=.45+.55*pow(max(dot(normalize(nWorld),normalize(toEye)),0.),.35);
        vec3 color=mix(vec3(1.,.36,.07),vec3(1.8,1.35,.65),cells);float spots=1.-smoothstep(.16,.24,zones);color*=1.-spots*.65;gl_FragColor=vec4(color*limb,1.);${finish}}`} /></mesh> : <Suspense fallback={<mesh><sphereGeometry args={[1, 24, 16]} /><meshBasicMaterial color={body.color} /></mesh>}>
        {['earth', 'moon'].includes(body.id) ? <MappedSurface body={body} uniforms={uniforms} segments={segments} /> : <ProceduralSurface body={body} uniforms={uniforms} segments={segments} />}
      </Suspense>}
      {body.rings ? <SaturnRings sunDirection={uniforms.sunDirection} /> : null}
    </group>
  </group>;
}
