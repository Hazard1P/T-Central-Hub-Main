"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import {
  getEarthSurfaceState,
  getEarthSurfaceStatus,
  earthWorldVector,
} from "@/lib/earthSurface";
import {
  earthAnchorAt,
  earthAnchorDistance,
  METRES_PER_UNIT,
} from "@/lib/earthWalk";
import { createLocalEarthTerrain } from "@/lib/earthLocalTerrain";
import { useUniverseFrame } from "@/components/UniverseFrame";
import EarthNature from "@/components/EarthNature";
const finish =
  "\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n";

function GroundTile({ anchor, getPhysicsTime }) {
  const texture = useLoader(
    THREE.TextureLoader,
    "/textures/solar-system/earth_atmos_2048.jpg",
  );
  const radius = getEarthSurfaceState(getPhysicsTime()).radius;
  const tile = useMemo(
    () => createLocalEarthTerrain(anchor, radius, 24000, 160),
    [anchor, radius],
  );
  useEffect(() => () => tile.geometry.dispose(), [tile]);
  const group = useRef(),
    matrix = useMemo(() => new THREE.Matrix4(), []);
  const uniforms = useMemo(
    () => ({
      map: { value: texture },
      sunDirection: { value: new THREE.Vector3() },
      up: { value: new THREE.Vector3() },
      metres: { value: METRES_PER_UNIT },
      worldRadius: { value: radius },
      originLarge: {
        value: new THREE.Vector3(
          ...tile.frame.center.map((v) => (v * METRES_PER_UNIT * 0.02) % 256),
        ),
      },
      originStone: {
        value: new THREE.Vector3(
          ...tile.frame.center.map((v) => (v * METRES_PER_UNIT * 0.8) % 256),
        ),
      },
      originFine: {
        value: new THREE.Vector3(
          ...tile.frame.center.map((v) => (v * METRES_PER_UNIT * 8) % 256),
        ),
      },
    }),
    [texture, radius, tile],
  );
  useFrame(() => {
    if (!group.current) return;
    const earth = getEarthSurfaceState(getPhysicsTime());
    group.current.position.set(
      ...earthWorldVector(tile.frame.center, earth.orientation).map(
        (v, i) => v + earth.position[i],
      ),
    );
    matrix.makeBasis(
      new THREE.Vector3(...earth.orientation.x),
      new THREE.Vector3(...earth.orientation.y),
      new THREE.Vector3(...earth.orientation.z),
    );
    group.current.quaternion.setFromRotationMatrix(matrix);
    uniforms.sunDirection.value
      .set(...earth.position)
      .negate()
      .normalize();
    uniforms.up.value.set(...earthWorldVector(anchor, earth.orientation));
  });
  return (
    <group ref={group}>
      <mesh geometry={tile.geometry} raycast={() => null}>
        <shaderMaterial
          uniforms={uniforms}
          side={THREE.DoubleSide}
          vertexShader={`
      attribute vec3 earthDirection;varying vec3 groundDirection;varying vec3 groundLocal;varying vec3 worldNormal;varying float range;
      void main(){groundDirection=earthDirection;groundLocal=position;worldNormal=normalize(mat3(modelMatrix)*normal);vec4 world=modelMatrix*vec4(position,1.);range=distance(cameraPosition,world.xyz);gl_Position=projectionMatrix*viewMatrix*world;}
    `}
          fragmentShader={`
      uniform sampler2D map;uniform vec3 sunDirection;uniform vec3 up;uniform float metres;uniform float worldRadius;uniform vec3 originLarge;uniform vec3 originStone;uniform vec3 originFine;
      varying vec3 groundDirection;varying vec3 groundLocal;varying vec3 worldNormal;varying float range;
      float hash(vec3 p){p=mod(p,256.);return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453);}
      float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
      void main(){vec3 d=normalize(groundDirection);vec2 uv=vec2(.5+atan(-d.z,d.x)/6.2831853,1.-acos(clamp(d.y,-1.,1.))/3.14159265);vec3 atlas=texture2D(map,uv).rgb;
        float dry=smoothstep(.01,.18,atlas.r-atlas.b);float snow=smoothstep(.78,.96,abs(d.y));
        vec3 soil=mix(vec3(.18,.28,.12),vec3(.55,.38,.19),dry);soil=mix(soil,vec3(.69,.77,.79),snow);
        vec3 p=groundLocal*metres;float large=noise(p*.02+originLarge),stone=noise(p*.8+originStone),fine=noise(p*8.+originFine);
        soil*=.75+.22*large+.25*stone+.13*fine;
        float daylight=max(0.,dot(normalize(worldNormal),sunDirection));float ambient=.14+.22*max(0.,dot(up,sunDirection));
        vec3 lit=soil*(ambient+daylight*.9);vec3 haze=mix(vec3(.07,.11,.16),vec3(.49,.66,.72),max(0.,dot(up,sunDirection)));
        float fog=1.-exp(-range*metres/8000.);gl_FragColor=vec4(mix(lit,haze,clamp(fog,0.,.95)),1.);${finish}}
    `}
        />
      </mesh>
    </group>
  );
}
export default function EarthSurface({
  getPhysicsTime,
  walking = false,
  walkAnchor = null,
}) {
  const light = useRef();
  const sky = useRef(),
    { origin } = useUniverseFrame(),
    [anchor, setAnchor] = useState(null),
    anchorRef = useRef(null);
  const uniforms = useMemo(
    () => ({
      up: { value: new THREE.Vector3(0, 1, 0) },
      sun: { value: new THREE.Vector3(1, 0, 0) },
      opacity: { value: 0 },
    }),
    [],
  );
  useFrame(({ camera }) => {
    const world = camera.position.clone().add(origin.current),
      utcMs = getPhysicsTime(),
      earth = getEarthSurfaceState(utcMs);
    const status = getEarthSurfaceStatus(world.toArray(), [0, 0, 0], utcMs);
    if (light.current)
      light.current.position
        .copy(world)
        .add(new THREE.Vector3(...status.up).multiplyScalar(100));
    if (sky.current) {
      sky.current.position.copy(world);
      sky.current.visible = status.altitude < 100;
      sky.current.material.uniforms.opacity.value = walking
        ? Math.min(1, Math.max(0.35, 1 - status.altitude / 50))
        : Math.max(0, Math.min(0.38, (100 - status.altitude) / 220));
      uniforms.up.value.set(...status.up);
      uniforms.sun.value
        .set(...earth.position)
        .negate()
        .normalize();
    }
    if (walking && status.altitude < 0.04) {
      const next = earthAnchorAt(world.toArray(), utcMs);
      if (
        !anchorRef.current ||
        earthAnchorDistance(anchorRef.current, next, utcMs) * METRES_PER_UNIT >
          200
      ) {
        anchorRef.current = next;
        setAnchor(next);
      }
    } else if (anchorRef.current) {
      anchorRef.current = null;
      setAnchor(null);
    }
  });
  return (
    <>
      {walking ? (
        <>
          <ambientLight intensity={0.5} />
          <hemisphereLight ref={light} args={["#cee7fa", "#817552", 1.2]} />
        </>
      ) : null}
      <mesh ref={sky} renderOrder={-50} raycast={() => null}>
        <sphereGeometry args={[600, 24, 16]} />
        <shaderMaterial
          transparent
          depthWrite={false}
          side={THREE.BackSide}
          uniforms={uniforms}
          vertexShader={`varying vec3 ray;void main(){ray=normalize(mat3(modelMatrix)*position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`}
          fragmentShader={`uniform vec3 up;uniform vec3 sun;uniform float opacity;varying vec3 ray;void main(){float h=max(0.,dot(normalize(ray),up)),day=smoothstep(-.15,.4,dot(up,sun));vec3 zenith=mix(vec3(.008,.016,.04),vec3(.07,.28,.58),day),horizon=mix(vec3(.045,.075,.11),vec3(.55,.72,.8),day);gl_FragColor=vec4(mix(horizon,zenith,pow(h,.45)),opacity);${finish}}`}
        />
      </mesh>
      {walking && anchor ? (
        <EarthNature
          anchor={walkAnchor || anchor}
          getPhysicsTime={getPhysicsTime}
        />
      ) : null}
      {anchor ? (
        <Suspense fallback={null}>
          <GroundTile anchor={anchor} getPhysicsTime={getPhysicsTime} />
        </Suspense>
      ) : null}
    </>
  );
}
