import bcrypt from 'bcryptjs';
import type { Role, UserDTO } from '@campus/shared';
import { prisma } from '../../common/prisma';
import { forbidden, notFound, unauthorized } from '../../common/errors';
import { env } from '../../common/env';

const toDTO = (user: { id: string; name: string; email: string; role: Role }): UserDTO => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
});

export async function login(email: string, password: string): Promise<UserDTO> {
  const user = await prisma.user.findUnique({ where: { email } });
  const valid = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || !valid) throw unauthorized('Correo o contraseña incorrectos');
  return toDTO(user);
}

export async function devLogin(role: Role, userId?: string): Promise<UserDTO> {
  if (!env.ALLOW_DEV_LOGIN) throw forbidden('El acceso rápido está desactivado');
  const user = userId
    ? await prisma.user.findFirst({ where: { id: userId, role } })
    : await prisma.user.findFirst({ where: { role }, orderBy: { email: 'asc' } });
  if (!user) throw notFound('No hay usuarios de ese rol');
  return toDTO(user);
}

export async function getUser(id: string): Promise<UserDTO> {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw unauthorized('Tu usuario ya no existe');
  return toDTO(user);
}

export async function listDemoUsers(): Promise<UserDTO[]> {
  if (!env.ALLOW_DEV_LOGIN) return [];
  const users = await prisma.user.findMany({ orderBy: [{ role: 'desc' }, { email: 'asc' }] });
  return users.map(toDTO);
}

export async function listTechnicians(): Promise<(UserDTO & { openAssigned: number })[]> {
  const technicians = await prisma.user.findMany({
    where: { role: 'TECHNICIAN' },
    orderBy: { name: 'asc' },
    include: { _count: { select: { assigned: { where: { status: 'IN_PROGRESS', isClusterPrimary: true } } } } },
  });
  return technicians.map((t) => ({ ...toDTO(t), openAssigned: t._count.assigned }));
}

export async function usersByRole(roles: Role[]): Promise<string[]> {
  const users = await prisma.user.findMany({ where: { role: { in: roles } }, select: { id: true } });
  return users.map((u) => u.id);
}
