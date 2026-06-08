// src/components/ProtectedRoute.tsx
//
// CORREÇÃO: a versão anterior renderizava <Navigate /> dentro de um bloco JSX
// junto com outros elementos — o componente renderizava visualmente o conteúdo
// de "acesso restrito" E tentava redirecionar ao mesmo tempo. O correto é
// retornar APENAS o <Navigate /> quando não há permissão.

import { Navigate } from 'react-router-dom';
import { useRole } from '../hooks/useRole';
import { ROLES } from '../types/roles';
import { TriangleAlert, Lock } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  rota: string;
}

export function ProtectedRoute({ children, rota }: ProtectedRouteProps) {
  const { role, pode, semRole } = useRole();

  // Usuário autenticado mas sem role configurado
  // Mostra aviso em vez de redirecionar para evitar loop
  if (semRole) {
    return (
      <div className="p-8 flex items-center justify-center min-h-96">
        <div className="bg-[#1f2937] border border-yellow-500/30 rounded-2xl p-8 max-w-md text-center">
          <TriangleAlert className="w-10 h-10 mb-4 mx-auto text-yellow-400" />
          <h2 className="text-lg font-black text-white mb-2">Perfil não configurado</h2>
          <p className="text-gray-400 text-sm mb-4">
            Sua conta ainda não tem um perfil de acesso definido.
            Peça ao administrador para configurar seu nível de acesso.
          </p>
          <div className="bg-gray-800 rounded-lg px-4 py-2 text-xs text-gray-500 font-mono">
            auth.users → app_metadata → role
          </div>
        </div>
      </div>
    );
  }

  // Sem permissão para esta rota específica — redireciona para raiz
  // (não mostra tela de erro, apenas redireciona silenciosamente)
  if (!pode(rota)) {
    // Rota raiz também sem permissão = sem role válido (não deve acontecer)
    if (rota === '/') {
      return (
        <div className="p-8 flex items-center justify-center min-h-96">
          <div className="bg-[#1f2937] border border-red-500/30 rounded-2xl p-8 max-w-md text-center">
            <Lock className="w-10 h-10 mb-4 mx-auto text-red-400" />
            <h2 className="text-lg font-black text-white mb-2">Acesso negado</h2>
            <p className="text-gray-400 text-sm">
              Seu perfil{' '}
              <span className="font-bold" style={{ color: ROLES[role!]?.cor ?? '#fff' }}>
                {ROLES[role!]?.label ?? role}
              </span>{' '}
              não tem permissão para acessar esta área.
            </p>
          </div>
        </div>
      );
    }

    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
