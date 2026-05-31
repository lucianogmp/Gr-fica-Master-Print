import { Navigate, useLocation } from 'react-router-dom';
import { useRole } from '../hooks/useRole';
import { ROLES } from '../types/roles';
import { TriangleAlert, Lock } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  rota: string;
}

export function ProtectedRoute({ children, rota }: ProtectedRouteProps) {
  const { role, pode, semRole } = useRole();
  const location = useLocation();

  // Sem role configurado — mostra aviso em vez de quebrar
  if (semRole) {
    return (
      <div className="p-8 flex items-center justify-center min-h-96">
        <div className="bg-[#1f2937] border border-yellow-500/30 rounded-2xl p-8 max-w-md text-center">
          <TriangleAlert className="w-10 h-10 mb-4 mx-auto text-yellow-400" />
          <h2 className="text-lg font-black text-white mb-2">Perfil não configurado</h2>
          <p className="text-gray-400 text-sm mb-4">
            Sua conta ainda não tem um perfil de acesso definido.<br />
            Peça ao administrador para configurar seu nível de acesso.
          </p>
          <div className="bg-gray-800 rounded-lg px-4 py-2 text-xs text-gray-500 font-mono">
            auth.users → raw_user_meta_data → role
          </div>
        </div>
      </div>
    );
  }

  // Sem permissão para esta rota
  if (!pode(rota)) {
    return (
      <div className="p-8 flex items-center justify-center min-h-96">
        <div className="bg-[#1f2937] border border-red-500/30 rounded-2xl p-8 max-w-md text-center">
          <Lock className="w-10 h-10 mb-4 mx-auto text-red-400" />
          <h2 className="text-lg font-black text-white mb-2">Acesso restrito</h2>
          <p className="text-gray-400 text-sm mb-4">
            Seu perfil <span className="font-bold" style={{ color: ROLES[role!]?.cor ?? '#fff' }}>
              {ROLES[role!]?.label ?? role}
            </span> não tem permissão para acessar esta área.
          </p>
          <Navigate to="/" replace />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
