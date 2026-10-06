import { useMemo } from 'react';
import { Grid, Stars } from '@react-three/drei';
import { Color } from 'three';
import type { Vec3 } from './layout';

/** Paletas de la escena por tema; los niveles de prioridad no se usan aquí. */
const PALETTE = {
  dark: { dayBg: '#0d1730', nightBg: '#03060f', ground: '#0c1428', plaza: '#121d38', grid: '#1d2b4f', gridSection: '#2a3d6b', hemiSky: '#9db5ff', hemiGround: '#0b1020' },
  light: { dayBg: '#dfe7f6', nightBg: '#2a3556', ground: '#e4eaf5', plaza: '#d6deee', grid: '#c6d0e4', gridSection: '#aab7d2', hemiSky: '#ffffff', hemiGround: '#b8c3db' },
} as const;

interface Props {
  theme: string;
  light: number;
  radius: number;
  center: Vec3;
  shadows: boolean;
}

/** Cielo, luces y suelo. La luz del sol y el color del fondo siguen la hora (real o reproducida). */
export function SceneEnvironment({ theme, light, radius, center, shadows }: Props) {
  const palette = theme === 'light' ? PALETTE.light : PALETTE.dark;
  const background = useMemo(() => new Color(palette.nightBg).lerp(new Color(palette.dayBg), light), [palette, light]);
  const sunAngle = Math.PI * (0.15 + 0.7 * light);
  const sun: Vec3 = [center[0] + Math.cos(sunAngle) * radius * 2, 18 + light * 40, center[2] + radius * 1.2];
  const night = 1 - light;

  return (
    <>
      <color attach="background" args={[background]} />
      <fog attach="fog" args={[background, radius * 2.2, radius * 6]} />
      <hemisphereLight args={[palette.hemiSky, palette.hemiGround, 0.35 + light * 0.55]} />
      <ambientLight intensity={0.12 + night * 0.08} color={night > 0.6 ? '#6f86d6' : '#ffffff'} />
      <directionalLight
        position={sun}
        intensity={0.25 + light * 1.6}
        color={light > 0.3 ? '#fff4e0' : '#a9b8ff'}
        castShadow={shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-radius * 1.4}
        shadow-camera-right={radius * 1.4}
        shadow-camera-top={radius * 1.4}
        shadow-camera-bottom={-radius * 1.4}
        shadow-camera-far={200}
        shadow-bias={-0.0004}
      />
      {night > 0.5 && <Stars radius={radius * 4} depth={40} count={1400} factor={3} fade speed={0.4} />}

      <mesh rotation-x={-Math.PI / 2} position={[center[0], -0.02, center[2]]} receiveShadow>
        <circleGeometry args={[radius * 2.6, 72]} />
        <meshStandardMaterial color={palette.ground} roughness={0.95} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[center[0], 0, center[2]]} receiveShadow>
        <circleGeometry args={[radius * 0.32, 48]} />
        <meshStandardMaterial color={palette.plaza} roughness={0.8} />
      </mesh>
      <Grid
        position={[center[0], 0.01, center[2]]}
        args={[radius * 5, radius * 5]}
        cellSize={2}
        cellThickness={0.6}
        cellColor={palette.grid}
        sectionSize={10}
        sectionThickness={1}
        sectionColor={palette.gridSection}
        fadeDistance={radius * 3.2}
        fadeStrength={1.4}
        infiniteGrid={false}
      />
    </>
  );
}
