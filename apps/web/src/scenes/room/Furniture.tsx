import { RoundedBox } from '@react-three/drei';
import { ROOM_DIMENSIONS, type SpaceType } from '@campus/shared';

export interface RoomPalette {
  floor: string;
  wall: string;
  wallAccent: string;
  wood: string;
  metal: string;
  fabric: string;
  board: string;
  ceramic: string;
  light: string;
}

export const ROOM_PALETTE: Record<'dark' | 'light', RoomPalette> = {
  dark: {
    floor: '#1a2340',
    wall: '#26324f',
    wallAccent: '#2f3d61',
    wood: '#8a6a4a',
    metal: '#7d8aa8',
    fabric: '#4b5d93',
    board: '#1f3b34',
    ceramic: '#d8dee9',
    light: '#fff1d6',
  },
  light: {
    floor: '#d9dfeb',
    wall: '#f4f6fb',
    wallAccent: '#e3e8f3',
    wood: '#b88a5e',
    metal: '#98a3bb',
    fabric: '#6f83c4',
    board: '#2f5a4f',
    ceramic: '#ffffff',
    light: '#fff6e4',
  },
};

function Desk({ position, palette, chair = true }: { position: [number, number, number]; palette: RoomPalette; chair?: boolean }) {
  return (
    <group position={position}>
      <RoundedBox args={[1.1, 0.06, 0.6]} radius={0.02} position-y={0.74} castShadow>
        <meshStandardMaterial color={palette.wood} roughness={0.7} />
      </RoundedBox>
      {[
        [-0.5, -0.25],
        [0.5, -0.25],
        [-0.5, 0.25],
        [0.5, 0.25],
      ].map(([x, z], index) => (
        <mesh key={index} position={[x, 0.37, z]}>
          <cylinderGeometry args={[0.025, 0.025, 0.74, 6]} />
          <meshStandardMaterial color={palette.metal} metalness={0.6} roughness={0.4} />
        </mesh>
      ))}
      {chair && (
        <group position={[0, 0, 0.55]}>
          <RoundedBox args={[0.45, 0.06, 0.42]} radius={0.02} position-y={0.45}>
            <meshStandardMaterial color={palette.fabric} />
          </RoundedBox>
          <RoundedBox args={[0.45, 0.42, 0.05]} radius={0.02} position={[0, 0.68, 0.2]}>
            <meshStandardMaterial color={palette.fabric} />
          </RoundedBox>
          <mesh position-y={0.22}>
            <cylinderGeometry args={[0.03, 0.03, 0.44, 6]} />
            <meshStandardMaterial color={palette.metal} />
          </mesh>
        </group>
      )}
    </group>
  );
}

function Bench({ position, length, palette }: { position: [number, number, number]; length: number; palette: RoomPalette }) {
  return (
    <group position={position}>
      <RoundedBox args={[length, 0.9, 0.9]} radius={0.04} position-y={0.45} castShadow>
        <meshStandardMaterial color={palette.wallAccent} />
      </RoundedBox>
      <RoundedBox args={[length + 0.05, 0.05, 0.95]} radius={0.02} position-y={0.92}>
        <meshStandardMaterial color="#20262f" roughness={0.3} />
      </RoundedBox>
      {Array.from({ length: Math.floor(length / 1.2) }, (_, i) => (
        <mesh key={i} position={[-length / 2 + 0.6 + i * 1.2, 0.35, 0.75]}>
          <cylinderGeometry args={[0.18, 0.18, 0.7, 12]} />
          <meshStandardMaterial color={palette.fabric} />
        </mesh>
      ))}
    </group>
  );
}

function Toilet({ position, palette }: { position: [number, number, number]; palette: RoomPalette }) {
  return (
    <group position={position}>
      <mesh position-y={0.2}>
        <cylinderGeometry args={[0.2, 0.17, 0.4, 16]} />
        <meshStandardMaterial color={palette.ceramic} roughness={0.2} />
      </mesh>
      <RoundedBox args={[0.42, 0.35, 0.18]} radius={0.04} position={[0, 0.55, 0.22]}>
        <meshStandardMaterial color={palette.ceramic} roughness={0.2} />
      </RoundedBox>
    </group>
  );
}

function Sofa({ position, rotation = 0, palette }: { position: [number, number, number]; rotation?: number; palette: RoomPalette }) {
  return (
    <group position={position} rotation-y={rotation}>
      <RoundedBox args={[2, 0.42, 0.85]} radius={0.12} position-y={0.25} castShadow>
        <meshStandardMaterial color={palette.fabric} roughness={0.9} />
      </RoundedBox>
      <RoundedBox args={[2, 0.5, 0.22]} radius={0.1} position={[0, 0.6, -0.33]}>
        <meshStandardMaterial color={palette.fabric} roughness={0.9} />
      </RoundedBox>
    </group>
  );
}

function RoundTable({ position, palette }: { position: [number, number, number]; palette: RoomPalette }) {
  return (
    <group position={position}>
      <mesh position-y={0.72} castShadow>
        <cylinderGeometry args={[0.6, 0.6, 0.05, 28]} />
        <meshStandardMaterial color={palette.wood} />
      </mesh>
      <mesh position-y={0.36}>
        <cylinderGeometry args={[0.06, 0.12, 0.72, 10]} />
        <meshStandardMaterial color={palette.metal} />
      </mesh>
    </group>
  );
}

/** Mobiliario low-poly generado por tipo de espacio, coherente con los hotspots del seed. */
export function Furniture({ type, palette }: { type: SpaceType; palette: RoomPalette }) {
  const { width, depth } = ROOM_DIMENSIONS[type];
  const hw = width / 2;
  const hd = depth / 2;

  switch (type) {
    case 'CLASSROOM':
      return (
        <group>
          {Array.from({ length: 4 }, (_, row) =>
            Array.from({ length: 3 }, (_, col) => (
              <Desk key={`${row}-${col}`} position={[-2.6 + col * 2.6, 0, -1.2 + row * 1.35]} palette={palette} />
            )),
          )}
          <Desk position={[hw - 1.6, 0, -hd + 1.2]} palette={palette} chair={false} />
        </group>
      );
    case 'LAB':
      return (
        <group>
          <Bench position={[-1.6, 0, -0.8]} length={5} palette={palette} />
          <Bench position={[-1.6, 0, 1.6]} length={5} palette={palette} />
          <group position={[hw - 1.2, 0, -hd + 0.6]}>
            <RoundedBox args={[1.4, 0.9, 0.7]} radius={0.04} position-y={0.45}>
              <meshStandardMaterial color={palette.metal} metalness={0.5} roughness={0.35} />
            </RoundedBox>
          </group>
        </group>
      );
    case 'BATHROOM':
      return (
        <group>
          {[-1.4, 0, 1.4].map((x) => (
            <group key={x}>
              <Toilet position={[x, 0, hd - 0.5]} palette={palette} />
              <mesh position={[x + 0.7, 1, hd - 0.6]}>
                <boxGeometry args={[0.04, 2, 1.2]} />
                <meshStandardMaterial color={palette.wallAccent} />
              </mesh>
            </group>
          ))}
          <RoundedBox args={[2.6, 0.12, 0.55]} radius={0.03} position={[-0.6, 0.85, -hd + 0.3]}>
            <meshStandardMaterial color={palette.ceramic} roughness={0.15} />
          </RoundedBox>
          <mesh position={[-0.6, 1.6, -hd + 0.03]}>
            <boxGeometry args={[2.4, 0.9, 0.02]} />
            <meshStandardMaterial color="#9fb6d9" metalness={0.9} roughness={0.05} />
          </mesh>
        </group>
      );
    case 'COMMON':
      return (
        <group>
          <Sofa position={[-3.5, 0, -2.2]} palette={palette} />
          <Sofa position={[-3.5, 0, 0.6]} rotation={Math.PI} palette={palette} />
          {[
            [1.5, -1.8],
            [3.8, -1.8],
            [1.5, 1.4],
            [3.8, 1.4],
          ].map(([x, z]) => (
            <RoundTable key={`${x}-${z}`} position={[x, 0, z]} palette={palette} />
          ))}
        </group>
      );
    case 'OFFICE':
    default:
      return (
        <group>
          <Desk position={[0, 0, -0.6]} palette={palette} />
          <RoundedBox args={[1.6, 2, 0.4]} radius={0.03} position={[-hw + 1.1, 1, -hd + 0.25]}>
            <meshStandardMaterial color={palette.wood} />
          </RoundedBox>
        </group>
      );
  }
}
