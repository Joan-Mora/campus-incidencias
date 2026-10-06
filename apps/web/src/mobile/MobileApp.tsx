import { useAuth } from '../core/auth/store';
import { MobileLogin } from './MobileLogin';
import { MobileShell } from './MobileShell';

/** Árbol móvil independiente: no comparte páginas ni layouts con el escritorio. */
export default function MobileApp() {
  const user = useAuth((state) => state.user);
  return user ? <MobileShell /> : <MobileLogin />;
}
