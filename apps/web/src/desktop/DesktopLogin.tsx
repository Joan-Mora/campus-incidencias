import { useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { ROLE_LABELS, ROLES, type Role } from '@campus/shared';
import { fadeUp, stagger } from '../core/motion';
import { useDevLogin, useDevUsers, useLogin } from '../features/auth/api';
import { BrandMark } from '../ui/BrandMark';
import { Button } from '../ui/Button';
import { FieldLabel, Input } from '../ui/Field';
import { Icon } from '../ui/Icon';
import { Icons, ROLE_ICONS } from '../ui/icons';

const ROLE_COPY: Record<Role, string> = {
  SUPERVISOR: 'Centro de mando completo: asigna, verifica, agrupa y mira el campus en vivo.',
  TECHNICIAN: 'Toma casos, resuelve con evidencia y ve el punto exacto del daño.',
  STUDENT: 'Reporta daños y sigue tus reportes. En el celular tienes el asistente completo.',
};

const DISPLAY_ORDER: Role[] = ['SUPERVISOR', 'TECHNICIAN', 'STUDENT'];

export function DesktopLogin() {
  const devUsers = useDevUsers();
  const devLogin = useDevLogin();
  const login = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pendingRole, setPendingRole] = useState<Role | null>(null);

  const quick = (role: Role, userId?: string) => {
    setPendingRole(role);
    devLogin.mutate({ role, userId }, { onError: (error) => toast.error(error.message), onSettled: () => setPendingRole(null) });
  };

  return (
    <div className="aurora relative flex h-full overflow-hidden">
      <BackdropGrid />
      <motion.section variants={stagger(0.08, 0.1)} initial="hidden" animate="show" className="relative z-10 m-auto grid w-[min(1120px,92vw)] grid-cols-[1.1fr_1fr] gap-10">
        <div className="flex flex-col justify-center">
          <motion.div variants={fadeUp} className="mb-8 flex items-center gap-3">
            <BrandMark size={44} animated />
            <span className="text-sm font-medium text-muted">UNIMINUTO, gestión de infraestructura</span>
          </motion.div>
          <motion.h1 variants={fadeUp} className="font-display text-6xl leading-[1.02] font-semibold tracking-tight">
            El campus
            <br />
            también se <span className="bg-gradient-to-r from-level-medium via-accent to-level-critical bg-clip-text text-transparent">daña</span>.
          </motion.h1>
          <motion.p variants={fadeUp} className="mt-5 max-w-md text-lg text-muted">
            Cada reporte llega con su punto exacto en 3D, una prioridad que se explica sola y un reloj de SLA que no perdona.
          </motion.p>
          <motion.div variants={fadeUp} className="mt-8 flex flex-wrap gap-2 text-xs text-muted">
            {[
              { icon: Icons.gauge, text: 'Prioridad ponderada de 5 variables' },
              { icon: Icons.merge, text: 'Agrupación espacial y semántica' },
              { icon: Icons.alarm, text: 'SLA doble con escalamiento' },
              { icon: Icons.history, text: 'Repetición del campus en el tiempo' },
            ].map((item) => (
              <span key={item.text} className="glass flex items-center gap-2 rounded-full px-3 py-1.5">
                <Icon icon={item.icon} size="sm" className="text-accent" />
                {item.text}
              </span>
            ))}
          </motion.div>
        </div>

        <motion.div variants={fadeUp} className="glass-strong rounded-[28px] p-7">
          <h2 className="font-display text-xl font-semibold">Entrar</h2>
          {devUsers.data?.enabled && (
            <>
              <p className="mt-1 text-sm text-muted">Acceso rápido de demostración por rol.</p>
              <div className="mt-5 flex flex-col gap-2.5">
                {DISPLAY_ORDER.filter((role) => ROLES.includes(role)).map((role) => (
                  <motion.button
                    key={role}
                    whileHover={{ x: 4 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => quick(role)}
                    disabled={devLogin.isPending}
                    className="group flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 text-left transition-colors hover:border-accent/50 hover:bg-surface-hover"
                  >
                    <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent/12 text-accent">
                      <Icon icon={pendingRole === role ? Icons.loader : ROLE_ICONS[role]} className={pendingRole === role ? 'animate-spin' : ''} />
                    </span>
                    <span className="flex-1">
                      <span className="block font-semibold">{ROLE_LABELS[role]}</span>
                      <span className="block text-xs text-muted">{ROLE_COPY[role]}</span>
                    </span>
                    <Icon icon={Icons.arrowRight} size="sm" className="text-faint transition-colors group-hover:text-accent" />
                  </motion.button>
                ))}
              </div>
              <div className="my-6 flex items-center gap-3 text-xs text-faint">
                <span className="h-px flex-1 bg-line" />o con tu cuenta<span className="h-px flex-1 bg-line" />
              </div>
            </>
          )}
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              login.mutate({ email, password }, { onError: (error) => toast.error(error.message) });
            }}
          >
            <label>
              <FieldLabel>Correo</FieldLabel>
              <Input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nombre@uniminuto.edu.co" />
            </label>
            <label>
              <FieldLabel>Contraseña</FieldLabel>
              <Input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
            <Button type="submit" variant="primary" size="lg" loading={login.isPending} iconRight={Icons.arrowRight} className="mt-2">
              Entrar
            </Button>
          </form>
        </motion.div>
      </motion.section>
    </div>
  );
}

function BackdropGrid() {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.35]" aria-hidden>
      <defs>
        <pattern id="login-grid" width="48" height="48" patternUnits="userSpaceOnUse">
          <path d="M48 0H0V48" fill="none" stroke="var(--border)" />
        </pattern>
        <radialGradient id="login-fade" cx="50%" cy="40%" r="70%">
          <stop offset="0" stopColor="white" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </radialGradient>
        <mask id="login-mask">
          <rect width="100%" height="100%" fill="url(#login-fade)" />
        </mask>
      </defs>
      <rect width="100%" height="100%" fill="url(#login-grid)" mask="url(#login-mask)" />
    </svg>
  );
}
