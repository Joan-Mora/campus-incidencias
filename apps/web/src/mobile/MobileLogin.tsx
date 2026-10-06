import { useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { ROLE_LABELS, type Role } from '@campus/shared';
import { haptic } from '../core/device/viewMode';
import { fadeUp, stagger } from '../core/motion';
import { useDevLogin, useDevUsers, useLogin } from '../features/auth/api';
import { BrandMark } from '../ui/BrandMark';
import { Button } from '../ui/Button';
import { Input } from '../ui/Field';
import { Icon } from '../ui/Icon';
import { Icons, ROLE_ICONS } from '../ui/icons';

const ROLE_COPY: Record<Role, string> = {
  STUDENT: 'Reporta un daño en segundos',
  TECHNICIAN: 'Tu bandeja de casos en campo',
  SUPERVISOR: 'Sigue el campus desde el bolsillo',
};

const ORDER: Role[] = ['STUDENT', 'TECHNICIAN', 'SUPERVISOR'];

export function MobileLogin() {
  const devUsers = useDevUsers();
  const devLogin = useDevLogin();
  const login = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState<Role | null>(null);

  return (
    <div className="aurora safe-top safe-bottom relative flex min-h-dvh flex-col overflow-hidden px-5">
      <motion.div variants={stagger(0.07, 0.05)} initial="hidden" animate="show" className="relative z-10 flex flex-1 flex-col">
        <motion.div variants={fadeUp} className="mt-10 flex items-center gap-3">
          <BrandMark size={40} animated />
          <span className="text-xs font-medium text-muted">UNIMINUTO</span>
        </motion.div>
        <motion.h1 variants={fadeUp} className="mt-8 font-display text-[42px] leading-[1.02] font-semibold tracking-tight">
          El campus
          <br />
          también se <span className="bg-gradient-to-r from-level-medium via-accent to-level-critical bg-clip-text text-transparent">daña</span>.
        </motion.h1>
        <motion.p variants={fadeUp} className="mt-3 text-[15px] text-muted">
          Escanea el QR del salón, toca el punto exacto en 3D y listo.
        </motion.p>

        <div className="mt-auto flex flex-col gap-2.5 pt-8 pb-6">
          {devUsers.data?.enabled &&
            ORDER.map((role) => (
              <motion.button
                key={role}
                variants={fadeUp}
                whileTap={{ scale: 0.97 }}
                disabled={devLogin.isPending}
                onClick={() => {
                  haptic();
                  setPending(role);
                  devLogin.mutate({ role }, { onError: (error) => toast.error(error.message), onSettled: () => setPending(null) });
                }}
                className="glass-strong flex items-center gap-3.5 rounded-2xl p-3.5 text-left"
              >
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent/14 text-accent">
                  <Icon icon={pending === role ? Icons.loader : ROLE_ICONS[role]} className={pending === role ? 'animate-spin' : ''} />
                </span>
                <span className="flex-1">
                  <span className="block font-semibold">Entrar como {ROLE_LABELS[role].toLowerCase()}</span>
                  <span className="block text-xs text-muted">{ROLE_COPY[role]}</span>
                </span>
                <Icon icon={Icons.chevronRight} size="sm" className="text-faint" />
              </motion.button>
            ))}

          <motion.form
            variants={fadeUp}
            className="mt-3 flex flex-col gap-2.5"
            onSubmit={(event) => {
              event.preventDefault();
              login.mutate({ email, password }, { onError: (error) => toast.error(error.message) });
            }}
          >
            <Input type="email" inputMode="email" autoComplete="username" placeholder="Correo institucional" value={email} onChange={(event) => setEmail(event.target.value)} className="h-12" />
            <Input type="password" autoComplete="current-password" placeholder="Contraseña" value={password} onChange={(event) => setPassword(event.target.value)} className="h-12" />
            <Button type="submit" size="lg" variant="primary" loading={login.isPending} iconRight={Icons.arrowRight}>
              Entrar
            </Button>
          </motion.form>
        </div>
      </motion.div>
    </div>
  );
}
