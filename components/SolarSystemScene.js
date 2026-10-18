'use client';

import { Suspense, useMemo, useRef, useState } from 'react';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import { Html, Line, OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { AU_KM, GEO_RADIUS_KM, getSolarSystemState, geostationaryState, sampleSolarOrbit, SOLAR_BODIES, SOLAR_PLANETS } from '@/lib/solarSystem';
import { layoutSolarLabels } from '@/lib/solarLabels';

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

function SolarBody({ body, stateRef, originRef, enhanced, onSelect, segments }) {
  const position = useRef(null), axes = useRef(null);
  const uniforms = useMemo(() => ({ sunDirection: { value: new THREE.Vector3(1, 0, 0) } }), []);
  const matrix = useMemo(() => new THREE.Matrix4(), []);
  const x = useMemo(() => new THREE.Vector3(), []), y = useMemo(() => new THREE.Vector3(), []), z = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const state = stateRef.current.find((entry) => entry.id === body.id);
    if (!state || !position.current || !axes.current) return;
    position.current.position.set(...state.position.map((value, axis) => value - originRef.current[axis]));
    const radius = state.radiusAu * (enhanced && body.id !== 'sun' ? 100 : 1);
    position.current.scale.setScalar(radius);
    const f = body.flattening || 0, equator = 1 / Math.cbrt(1 - f);
    axes.current.scale.set(equator, equator * (1 - f), equator);
    x.set(...state.orientation.x); y.set(...state.orientation.y); z.set(...state.orientation.z);
    matrix.makeBasis(x, y, z); axes.current.quaternion.setFromRotationMatrix(matrix);
    uniforms.sunDirection.value.set(...state.position).negate().normalize();
  });
  return <group ref={position} onClick={(event) => { event.stopPropagation(); onSelect(body.id); }}>
    <group ref={axes}>
      {body.id === 'sun' ? <mesh><sphereGeometry args={[1, segments, segments / 2]} /><meshBasicMaterial color="#fff5df" /></mesh> : <Suspense fallback={<mesh><sphereGeometry args={[1, 24, 16]} /><meshBasicMaterial color={body.color} /></mesh>}>
        {['earth', 'moon'].includes(body.id) ? <MappedSurface body={body} uniforms={uniforms} segments={segments} /> : <ProceduralSurface body={body} uniforms={uniforms} segments={segments} />}
      </Suspense>}
      {body.rings ? <SaturnRings sunDirection={uniforms.sunDirection} /> : null}
    </group>
  </group>;
}

function OverviewLabels({ stateRef, originRef, onSelect }) {
  const [labels, setLabels] = useState([]);
  const sampled = useRef(0), projection = useRef(new THREE.Vector3());
  useFrame(({ camera, size, clock }) => {
    if (clock.elapsedTime - sampled.current < .1) return;
    sampled.current = clock.elapsedTime;
    const points = stateRef.current.filter((body) => body.id !== 'moon').map((body) => {
      projection.current.set(...body.position.map((value, axis) => value - originRef.current[axis])).project(camera);
      return { id: body.id, name: body.name, color: body.color, px: (projection.current.x + 1) * size.width / 2, py: (1 - projection.current.y) * size.height / 2 };
    });
    setLabels(layoutSolarLabels(points, size.width, size.height));
  });
  return <Html fullscreen calculatePosition={(_, __, size) => [size.width / 2, size.height / 2]} style={{ pointerEvents: 'none' }} zIndexRange={[25, 0]}>
    <svg className="solar-marker-lines" aria-hidden="true">{labels.map((label) => <g key={label.id}><line x1={label.px} y1={label.py} x2={label.lineX} y2={label.lineY} stroke={label.color} strokeOpacity={.4} strokeWidth={.6} /><circle cx={label.px} cy={label.py} r={1.5} fill={label.color} /></g>)}</svg>
    {labels.map((label) => <button key={label.id} className="solar-body-marker" style={{ left: label.x, top: label.y }} onClick={() => onSelect(label.id)}>{label.name}</button>)}
  </Html>;
}

function OrbitPaths({ epoch, stateRef, originRef, selection }) {
  const root = useRef(null), moon = useRef(null);
  const points = useMemo(() => SOLAR_PLANETS.map((body) => ({ body, points: sampleSolarOrbit(body, epoch, 96) })), [epoch]);
  const moonPoints = useMemo(() => sampleSolarOrbit(SOLAR_BODIES.find((body) => body.id === 'moon'), epoch, 64), [epoch]);
  useFrame(() => {
    root.current?.position.set(...originRef.current.map((value) => -value));
    const earth = stateRef.current.find((body) => body.id === 'earth');
    if (moon.current && earth) moon.current.position.set(...earth.position);
  });
  return <group ref={root}>
    {points.map(({ body, points }) => <Line key={body.id} points={points} color={body.color} opacity={selection === 'overview' ? .22 : .08} transparent lineWidth={.65} depthWrite={false} />)}
    {['earth', 'moon', 'geo'].includes(selection) ? <group ref={moon}><Line points={moonPoints} color="#8594a3" transparent opacity={.3} lineWidth={.7} depthWrite={false} /></group> : null}
  </group>;
}

function GeostationaryDemo({ getTime, stateRef, originRef, longitude }) {
  const marker = useRef(null), ring = useRef(null);
  const radius = GEO_RADIUS_KM / AU_KM;
  const points = useMemo(() => Array.from({ length: 129 }, (_, index) => [Math.cos(index * Math.PI / 64) * radius, 0, Math.sin(index * Math.PI / 64) * radius]), [radius]);
  useFrame(() => {
    const earth = stateRef.current.find((body) => body.id === 'earth');
    const geo = geostationaryState(getTime(), longitude);
    marker.current?.position.set(...geo.position.map((value, axis) => value - originRef.current[axis]));
    if (ring.current && earth) {
      ring.current.position.set(...earth.position.map((value, axis) => value - originRef.current[axis]));
      ring.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...earth.orientation.y));
    }
  });
  return <>
    <group ref={ring}><Line points={points} color="#9be5c9" opacity={.65} transparent lineWidth={1} /></group>
    <group ref={marker}><mesh><octahedronGeometry args={[.000003, 0]} /><meshBasicMaterial color="#bdffe3" /></mesh><Html center zIndexRange={[25, 0]}><span className="solar-geo-label">GEO · {longitude}°</span></Html></group>
  </>;
}

function SceneController({ getTime, stateRef, originRef, controls, selection, enhanced, cameraTick }) {
  const { camera } = useThree();
  const lastSample = useRef(0), lastCommand = useRef('');
  useFrame(({ clock }) => {
    if (clock.elapsedTime - lastSample.current > .08) { stateRef.current = getSolarSystemState(getTime()); lastSample.current = clock.elapsedTime; }
    const target = stateRef.current.find((body) => body.id === (selection === 'geo' ? 'earth' : selection));
    originRef.current = target ? target.position : [0, 0, 0];
    const command = selection + ':' + enhanced + ':' + cameraTick + ':' + camera.aspect.toFixed(3);
    if (lastCommand.current !== command && controls.current) {
      lastCommand.current = command;
      const fit = Math.min(1, camera.aspect);
      const systemRadius = Math.max(32, ...stateRef.current.map((body) => body.distanceAu));
      let distance = systemRadius * 1.08 / (Math.tan(camera.fov * Math.PI / 360) * fit);
      if (target) {
        const radius = selection === 'geo' ? GEO_RADIUS_KM / AU_KM : target.radiusAu * (enhanced && target.id !== 'sun' ? 100 : 1);
        distance = radius * (target.rings ? 9 : 4) / fit;
      }
      camera.near = Math.max(1e-10, distance / 1000); camera.far = 1000; camera.updateProjectionMatrix();
      // Start on the day side; users can orbit freely around the terminator.
      const daySide = target && target.id !== 'sun' ? new THREE.Vector3(...target.position).negate().normalize() : new THREE.Vector3(.3, .7, 1).normalize();
      const offset = new THREE.Vector3().crossVectors(daySide, new THREE.Vector3(0, 1, 0)).normalize().multiplyScalar(.35).add(new THREE.Vector3(0, .22, 0));
      camera.position.copy(daySide.add(offset).normalize().multiplyScalar(distance));
      controls.current.target.set(0, 0, 0); controls.current.minDistance = target ? target.radiusAu * (enhanced && target.id !== 'sun' ? 100 : 1) * (target.rings ? 2.5 : 1.15) : .00001;
      controls.current.maxDistance = 600; controls.current.update();
    }
  }, -2);
  return null;
}

function SolarStarField() {
  const sky = useRef(null);
  useFrame(({ camera }) => { sky.current?.position.copy(camera.position); });
  return <group ref={sky}><Stars radius={150} depth={120} count={2400} factor={1.7} fade speed={0} /></group>;
}

export default function SolarSystemScene({ clock, selection, onSelect, enhanced, showOrbits, showMarkers, geoLongitude, cameraTick, segments = 64 }) {
  const [initial] = useState(() => getSolarSystemState(clock.getTime()));
  const stateRef = useRef(initial), originRef = useRef([0, 0, 0]), controls = useRef(null);
  const orbitEpoch = Date.UTC(new Date(clock.utcMs || Date.now()).getUTCFullYear(), 0, 1);
  return <>
    <color attach="background" args={['#02050a']} />
    <SolarStarField />
    <SceneController getTime={clock.getTime} stateRef={stateRef} originRef={originRef} controls={controls} selection={selection} enhanced={enhanced} cameraTick={cameraTick} />
    <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={.12} enablePan={false} zoomSpeed={.7} rotateSpeed={.6} />
    {showOrbits ? <OrbitPaths epoch={orbitEpoch} stateRef={stateRef} originRef={originRef} selection={selection} /> : null}
    {SOLAR_BODIES.map((body) => <SolarBody key={body.id} body={body} stateRef={stateRef} originRef={originRef} enhanced={enhanced} onSelect={onSelect} segments={segments} />)}
    {showMarkers && selection === 'overview' ? <OverviewLabels stateRef={stateRef} originRef={originRef} onSelect={onSelect} /> : null}
    {selection === 'geo' ? <GeostationaryDemo getTime={clock.getTime} stateRef={stateRef} originRef={originRef} longitude={geoLongitude} /> : null}
  </>;
}
