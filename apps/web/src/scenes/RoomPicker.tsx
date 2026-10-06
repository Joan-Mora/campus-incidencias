import { useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, RoundedBox } from '@react-three/drei';
import { DoubleSide, PerspectiveCamera, Vector3, type Mesh, type MeshBasicMaterial } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { ROOM_DIMENSIONS, type Point3, type SpaceType } from '@campus/shared';
import { useAppliedTheme } from '../core/theme/levels';
import { Furniture, ROOM_PALETTE, type RoomPalette } from './room/Furniture';
import { PulseDriver } from './campus/PulseDriver';

export interface RoomMarker {
  id: string;
  point: Point3;
  color: string;
}

export interface RoomPickerProps {
  type: SpaceType;
  value: Point3 | null;
  /** Sin `onChange` el salón es de solo lectura (vista del técnico). */
  onChange?: (point: Point3) => void;
  /** Otros reportes del mismo espacio, para que quien reporta vea si ya existe uno cerca. */
  markers?: RoomMarker[];
  accent: string;
}

const round = (value: number) => Math.round(value * 100) / 100;

/** Salón 3D tipo maqueta: se gira con el dedo y un toque marca el punto exacto del daño. */
export default function RoomPicker({ type, value, onChange, markers = [], accent }: RoomPickerProps) {
  const theme = useAppliedTheme() === 'light' ? 'light' : 'dark';
  const palette = ROOM_PALETTE[theme];
  const { width, depth, height } = ROOM_DIMENSIONS[type];
  const span = Math.max(width, depth);

  const pick = (event: ThreeEvent<MouseEvent>) => {
    if (!onChange) return;
    // Un arrastre para girar no cuenta como toque.
    if (event.delta > 8) return;
    event.stopPropagation();
    const { x, y, z } = event.point;
    onChange({
      x: round(Math.max(-width / 2, Math.min(width / 2, x))),
      y: round(Math.max(0, Math.min(height, y))),
      z: round(Math.max(-depth / 2, Math.min(depth / 2, z))),
    });
  };

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      frameloop="demand"
      camera={{ fov: 45, position: [span * 0.35, height * 1.15, depth / 2 + span * 0.95] }}
      gl={{ antialias: true }}
      style={{ touchAction: 'none' }}
    >
      <color attach="background" args={[theme === 'light' ? '#e8edf7' : '#0a1020']} />
      <ambientLight intensity={theme === 'light' ? 0.7 : 0.45} />
      <directionalLight position={[width, height * 3, depth * 1.5]} intensity={1.1} castShadow shadow-mapSize={[1024, 1024]} />
      <pointLight position={[0, height - 0.4, 0]} intensity={8} distance={span * 1.4} color={palette.light} />

      <group onClick={pick}>
        <Shell type={type} palette={palette} />
        <Furniture type={type} palette={palette} />
      </group>

      {markers.map((marker) => (
        <Marker key={marker.id} point={marker.point} color={marker.color} small />
      ))}
      {value && <Marker point={value} color={accent} />}

      <OrbitControls
        makeDefault
        target={[0, height * 0.42, 0]}
        enablePan={false}
        enableDamping
        minDistance={span * 0.55}
        maxDistance={span * 1.6}
        minPolarAngle={0.55}
        maxPolarAngle={1.45}
        minAzimuthAngle={-1}
        maxAzimuthAngle={1}
      />
      <FitCamera width={width} depth={depth} height={height} />
      <PulseDriver active={Boolean(value) || markers.length > 0} fps={30} />
    </Canvas>
  );
}

/** Piso, muros (solo visibles desde dentro, efecto maqueta), tablero, ventanas, puerta, tomas y luminarias. */
function Shell({ type, palette }: { type: SpaceType; palette: RoomPalette }) {
  const { width, depth, height } = ROOM_DIMENSIONS[type];
  const hw = width / 2;
  const hd = depth / 2;
  const hasBoard = type === 'CLASSROOM' || type === 'LAB';
  const windowCount = Math.max(1, Math.floor(depth / 2.5));
  const lights = type === 'BATHROOM' || type === 'OFFICE' ? [[0, 0]] : [[-hw / 2, -hd / 3], [hw / 2, -hd / 3], [-hw / 2, hd / 3], [hw / 2, hd / 3]];

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color={palette.floor} roughness={0.85} />
      </mesh>
      <mesh position={[0, height / 2, -hd]} receiveShadow>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial color={palette.wall} roughness={0.9} />
      </mesh>
      <mesh position={[-hw, height / 2, 0]} rotation-y={Math.PI / 2} receiveShadow>
        <planeGeometry args={[depth, height]} />
        <meshStandardMaterial color={palette.wallAccent} roughness={0.9} />
      </mesh>
      <mesh position={[hw, height / 2, 0]} rotation-y={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[depth, height]} />
        <meshStandardMaterial color={palette.wallAccent} roughness={0.9} />
      </mesh>
      <mesh position={[0, height, 0]} rotation-x={Math.PI / 2}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color={palette.wall} roughness={1} />
      </mesh>

      {hasBoard && (
        <RoundedBox args={[Math.min(4.5, width * 0.5), 1.2, 0.06]} radius={0.03} position={[0, 1.6, -hd + 0.04]}>
          <meshStandardMaterial color={palette.board} roughness={0.6} />
        </RoundedBox>
      )}
      {Array.from({ length: windowCount }, (_, index) => (
        <mesh key={index} position={[-hw + 0.02, 1.7, -hd + ((index + 0.5) * depth) / windowCount]} rotation-y={Math.PI / 2}>
          <planeGeometry args={[1.6, 1.3]} />
          <meshStandardMaterial color="#8fb4ff" emissive="#8fb4ff" emissiveIntensity={0.35} transparent opacity={0.75} />
        </mesh>
      ))}
      <mesh position={[hw - 0.02, 1.05, hd - 1]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[1, 2.1]} />
        <meshStandardMaterial color={palette.wood} />
      </mesh>
      {[-hw * 0.6, 0, hw * 0.6].map((x) => (
        <RoundedBox key={x} args={[0.16, 0.12, 0.03]} radius={0.01} position={[x, 0.4, -hd + 0.02]}>
          <meshStandardMaterial color={palette.ceramic} />
        </RoundedBox>
      ))}
      {lights.map(([x, z]) => (
        <mesh key={`${x}-${z}`} position={[x, height - 0.04, z]}>
          <boxGeometry args={[1.2, 0.06, 0.4]} />
          <meshStandardMaterial color={palette.light} emissive={palette.light} emissiveIntensity={1.4} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Encuadra el salón según la proporción real del lienzo: en un teléfono vertical el ancho manda
 * y la cámara se aleja lo justo para que no se corten las paredes.
 */
function FitCamera({ width, depth, height }: { width: number; depth: number; height: number }) {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const controls = useThree((state) => state.controls) as OrbitControlsImpl | null;
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    if (!(camera instanceof PerspectiveCamera) || size.height === 0) return;
    const vertical = (camera.fov * Math.PI) / 180;
    const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * (size.width / size.height));
    const radius = Math.hypot(width, depth) / 2;
    const distance = Math.max(radius / Math.tan(horizontal / 2), (height * 1.1) / Math.tan(vertical / 2)) * 1.25;
    const target = new Vector3(0, height * 0.42, 0);
    const direction = new Vector3(0.3, 0.62, 1).normalize();
    camera.position.copy(target).addScaledVector(direction, distance);
    camera.lookAt(target);
    if (controls) {
      controls.maxDistance = distance * 1.35;
      controls.minDistance = distance * 0.4;
      controls.target.copy(target);
      controls.update();
    }
    invalidate();
  }, [camera, controls, size.width, size.height, width, depth, height, invalidate]);

  return null;
}

function Marker({ point, color, small }: { point: Point3; color: string; small?: boolean }) {
  const ring = useRef<Mesh>(null);
  const head = useRef<Mesh>(null);
  const scale = small ? 0.6 : 1;
  useFrame((state) => {
    const t = (state.clock.elapsedTime * 0.9) % 1;
    if (ring.current) {
      ring.current.scale.setScalar(scale * (0.6 + t * 1.8));
      (ring.current.material as MeshBasicMaterial).opacity = (small ? 0.4 : 0.9) * (1 - t);
      ring.current.lookAt(state.camera.position);
    }
    if (head.current) head.current.position.y = point.y + Math.sin(state.clock.elapsedTime * 3) * 0.03;
  });
  const position = new Vector3(point.x, point.y, point.z);
  return (
    <group>
      <mesh ref={head} position={position}>
        <sphereGeometry args={[0.12 * scale, 20, 20]} />
        <meshBasicMaterial color={color} toneMapped={false} depthTest={false} transparent opacity={small ? 0.6 : 1} />
      </mesh>
      <mesh ref={ring} position={position} renderOrder={2}>
        <ringGeometry args={[0.16, 0.22, 32]} />
        <meshBasicMaterial color={color} transparent depthTest={false} toneMapped={false} side={DoubleSide} />
      </mesh>
    </group>
  );
}
