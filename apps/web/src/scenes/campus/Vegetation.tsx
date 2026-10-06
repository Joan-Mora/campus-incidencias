import { useMemo } from 'react';
import { Clone, useGLTF } from '@react-three/drei';
import type { CampusDTO } from '@campus/shared';
import { insideAnyBlock, seeded, type Vec3 } from './layout';

/** Modelos CC0 de Quaternius (Stylized Nature MegaKit), optimizados con `npm run models`. */
const MODELS = {
  tree1: '/models/CommonTree_1.glb',
  tree3: '/models/CommonTree_3.glb',
  pine2: '/models/Pine_2.glb',
  pine5: '/models/Pine_5.glb',
  bush: '/models/Bush_Common.glb',
  rock: '/models/Rock_Medium_1.glb',
} as const;

type ModelKey = keyof typeof MODELS;

const TREE_KEYS: ModelKey[] = ['tree1', 'tree3', 'pine2', 'pine5'];

interface Placement {
  model: ModelKey;
  position: Vec3;
  rotation: number;
  scale: number;
}

export function Vegetation({ campus, radius, center, dense }: { campus: CampusDTO; radius: number; center: Vec3; dense: boolean }) {
  const scenes = {
    tree1: useGLTF(MODELS.tree1).scene,
    tree3: useGLTF(MODELS.tree3).scene,
    pine2: useGLTF(MODELS.pine2).scene,
    pine5: useGLTF(MODELS.pine5).scene,
    bush: useGLTF(MODELS.bush).scene,
    rock: useGLTF(MODELS.rock).scene,
  };

  const placements = useMemo(() => {
    const random = seeded(campus.code.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0));
    const result: Placement[] = [];
    const target = dense ? 70 : 32;
    let attempts = 0;
    while (result.length < target && attempts < target * 20) {
      attempts += 1;
      // Más densidad en el anillo exterior; algunos árboles salpicados entre bloques.
      const ring = random() < 0.7;
      const angle = random() * Math.PI * 2;
      const distance = ring ? radius * (1.15 + random() * 0.7) : radius * (0.35 + random() * 0.8);
      const x = center[0] + Math.cos(angle) * distance;
      const z = center[2] + Math.sin(angle) * distance;
      if (insideAnyBlock(campus, x, z, ring ? 2 : 3.5)) continue;
      if (Math.hypot(x - center[0], z - center[2]) < radius * 0.34) continue;
      const roll = random();
      const model: ModelKey = roll < 0.72 ? TREE_KEYS[Math.floor(random() * TREE_KEYS.length)] : roll < 0.9 ? 'bush' : 'rock';
      const scale = model === 'rock' ? 0.8 + random() * 0.6 : model === 'bush' ? 1 + random() * 0.5 : 0.65 + random() * 0.45;
      result.push({ model, position: [x, 0, z], rotation: random() * Math.PI * 2, scale });
    }
    return result;
  }, [campus, radius, center, dense]);

  return (
    <group>
      {placements.map((item, index) => (
        <Clone
          key={index}
          object={scenes[item.model]}
          position={item.position}
          rotation-y={item.rotation}
          scale={item.scale}
          castShadow={dense}
          receiveShadow={false}
        />
      ))}
    </group>
  );
}

Object.values(MODELS).forEach((path) => useGLTF.preload(path));
