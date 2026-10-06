import { useState } from 'react';
import { Html, RoundedBox } from '@react-three/drei';
import { FLOOR_HEIGHT, type BlockDTO, type CampusDTO } from '@campus/shared';
import { Icon } from '../../ui/Icon';
import { Icons } from '../../ui/icons';
import type { BlockStats } from './types';

const BODY = { dark: '#1b2645', light: '#f3f6fc' } as const;
const ROOF = { dark: '#25335c', light: '#d9e1f0' } as const;
const WINDOW = '#ffd59a';

interface BuildingsProps {
  campus: CampusDTO;
  theme: string;
  light: number;
  stats: Map<string, BlockStats>;
  focusBlockId: string | null;
  onFocusBlock: (id: string | null) => void;
  shadows: boolean;
}

/** Edificios generados desde los datos: cada bloque apila sus pisos con franjas de ventanas emisivas. */
export function Buildings({ campus, theme, light, stats, focusBlockId, onFocusBlock, shadows }: BuildingsProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  return (
    <group>
      {campus.blocks.map((block) => (
        <Building
          key={block.id}
          block={block}
          theme={theme === 'light' ? 'light' : 'dark'}
          light={light}
          stats={stats.get(block.id)}
          hovered={hovered === block.id}
          focused={focusBlockId === block.id}
          dimmed={Boolean(focusBlockId && focusBlockId !== block.id)}
          shadows={shadows}
          onHover={(value) => {
            setHovered(value ? block.id : null);
            document.body.style.cursor = value ? 'pointer' : '';
          }}
          onClick={() => onFocusBlock(focusBlockId === block.id ? null : block.id)}
        />
      ))}
    </group>
  );
}

function Building({
  block,
  theme,
  light,
  stats,
  hovered,
  focused,
  dimmed,
  shadows,
  onHover,
  onClick,
}: {
  block: BlockDTO;
  theme: 'dark' | 'light';
  light: number;
  stats?: BlockStats;
  hovered: boolean;
  focused: boolean;
  dimmed: boolean;
  shadows: boolean;
  onHover: (value: boolean) => void;
  onClick: () => void;
}) {
  const height = block.floors * FLOOR_HEIGHT;
  const night = 1 - light;
  const glow = hovered || focused;
  const opacity = dimmed ? 0.35 : 1;

  return (
    <group
      position={[block.posX, 0, block.posZ]}
      rotation-y={block.rotation}
      onPointerOver={(event) => {
        event.stopPropagation();
        onHover(true);
      }}
      onPointerOut={() => onHover(false)}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      {Array.from({ length: block.floors }, (_, floor) => {
        const y = floor * FLOOR_HEIGHT + FLOOR_HEIGHT / 2;
        const inset = floor === block.floors - 1 ? 0.25 : 0;
        return (
          <group key={floor} position-y={y}>
            <RoundedBox
              args={[block.width - inset, FLOOR_HEIGHT * 0.94, block.depth - inset]}
              radius={0.25}
              smoothness={3}
              castShadow={shadows}
              receiveShadow={shadows}
            >
              <meshStandardMaterial
                color={BODY[theme]}
                roughness={0.65}
                metalness={0.15}
                emissive={glow ? '#8b7bff' : '#000000'}
                emissiveIntensity={glow ? 0.18 : 0}
                transparent={dimmed}
                opacity={opacity}
              />
            </RoundedBox>
            {/* Franja de ventanas: un volumen apenas más profundo que asoma por fachada y contrafachada. */}
            <mesh>
              <boxGeometry args={[block.width - 1, FLOOR_HEIGHT * 0.38, block.depth + 0.06]} />
              <meshStandardMaterial
                color={theme === 'light' ? '#9fb3d9' : '#0a1226'}
                emissive={WINDOW}
                emissiveIntensity={0.05 + night * 1.25}
                roughness={0.2}
                metalness={0.4}
                transparent={dimmed}
                opacity={opacity}
                toneMapped={night < 0.5}
              />
            </mesh>
            <mesh>
              <boxGeometry args={[block.width + 0.06, FLOOR_HEIGHT * 0.38, block.depth - 1]} />
              <meshStandardMaterial
                color={theme === 'light' ? '#9fb3d9' : '#0a1226'}
                emissive={WINDOW}
                emissiveIntensity={0.04 + night * 0.9}
                roughness={0.2}
                metalness={0.4}
                transparent={dimmed}
                opacity={opacity}
              />
            </mesh>
          </group>
        );
      })}
      <mesh position-y={height + 0.08} receiveShadow={shadows}>
        <boxGeometry args={[block.width - 0.9, 0.16, block.depth - 0.9]} />
        <meshStandardMaterial color={ROOF[theme]} roughness={0.9} transparent={dimmed} opacity={opacity} />
      </mesh>

      <Html position={[0, height + 1.6, 0]} center distanceFactor={60} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
        <div
          className={`glass-strong flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${
            glow ? 'scale-110' : dimmed ? 'opacity-40' : ''
          }`}
        >
          <span className="font-display">Bloque {block.code}</span>
          {stats && stats.open > 0 && (
            <span className="flex items-center gap-1 font-mono text-muted">
              <Icon icon={Icons.pin} size={12} />
              {stats.open}
            </span>
          )}
          {stats && stats.overdue > 0 && (
            <span className="flex items-center gap-1 font-mono text-level-critical">
              <Icon icon={Icons.alarm} size={12} />
              {stats.overdue}
            </span>
          )}
        </div>
        {glow && (
          <div className="glass-strong mt-2 w-48 rounded-2xl p-3 text-left text-xs">
            <div className="mb-2 font-display text-sm font-semibold">{block.name}</div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Kpi label="Abiertas" value={stats?.open ?? 0} />
              <Kpi label="Críticas" value={stats?.critical ?? 0} tone="text-level-critical" />
              <Kpi label="Vencidas" value={stats?.overdue ?? 0} tone="text-level-high" />
            </div>
            <div className="mt-2 text-[11px] text-muted">
              {block.floors} pisos, {block.spaces.length} espacios
            </div>
          </div>
        )}
      </Html>
    </group>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-lg bg-surface px-1 py-1.5">
      <div className={`font-mono text-base font-semibold ${tone ?? ''}`}>{value}</div>
      <div className="text-[10px] text-muted">{label}</div>
    </div>
  );
}
