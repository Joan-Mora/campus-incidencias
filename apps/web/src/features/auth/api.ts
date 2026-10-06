import { useMutation, useQuery } from '@tanstack/react-query';
import type { LoginInput, Role, UserDTO } from '@campus/shared';
import { api } from '../../core/api/client';
import { keys, queryClient } from '../../core/api/queryClient';
import { useAuth } from '../../core/auth/store';

interface Session {
  token: string;
  user: UserDTO;
}

export function useDevUsers() {
  return useQuery({
    queryKey: keys.devUsers,
    queryFn: () => api<{ enabled: boolean; users: UserDTO[] }>('/api/auth/dev-users'),
    staleTime: Infinity,
  });
}

function useSessionMutation<T>(request: (input: T) => Promise<Session>) {
  const setSession = useAuth((state) => state.setSession);
  return useMutation({
    mutationFn: request,
    onSuccess: ({ token, user }) => {
      queryClient.clear();
      setSession(token, user);
    },
  });
}

export function useLogin() {
  return useSessionMutation((input: LoginInput) => api<Session>('/api/auth/login', { body: input }));
}

export function useDevLogin() {
  return useSessionMutation((input: { role: Role; userId?: string }) => api<Session>('/api/auth/dev-login', { body: input }));
}

export function useLogout() {
  const logout = useAuth((state) => state.logout);
  return () => {
    logout();
    queryClient.clear();
  };
}

export function useCurrentUser() {
  return useAuth((state) => state.user);
}
