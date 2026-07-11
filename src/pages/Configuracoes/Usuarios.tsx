// src/pages/Configuracoes/Usuarios.tsx
import { useState } from 'react';
import { useUsuarios, UsuarioAdmin } from '../../hooks/useUsuarios';
import { useRole } from '../../hooks/useRole';
import { ROLES, Role } from '../../types/roles';
import { Modal } from '../../components/ui/Modal';
import { Users, User, Trash2 } from 'lucide-react';
import { IN, Lbl } from './utils';

export function Usuarios() {
  const { data: usuarios = [], isLoading, definirRole, convidarUsuario, isConvidando, excluirUsuario, isExcluindo } = useUsuarios();
  const { isDono } = useRole();

  const [modalConvite, setModalConvite] = useState(false);
  const [conviteForm, setConviteForm]   = useState({ email: '', nome: '', role: 'vendedor' as Role });
  const [usuarioParaExcluir, setUsuarioParaExcluir] = useState<UsuarioAdmin | null>(null);

  async function handleConvitar() {
    await convidarUsuario(conviteForm);
    setModalConvite(false);
    setConviteForm({ email: '', nome: '', role: 'vendedor' });
  }

  async function handleExcluir() {
    if (!usuarioParaExcluir) return;
    await excluirUsuario(usuarioParaExcluir.id);
    setUsuarioParaExcluir(null);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-400" /> Usuários
          </h1>
          <p className="text-gray-500 text-sm">{usuarios.length} usuário(s) cadastrado(s)</p>
        </div>
        {isDono && (
          <button onClick={() => setModalConvite(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all">
            + Convidar Usuário
          </button>
        )}
      </div>

      <div className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-[10px] font-bold uppercase border-b border-gray-700 bg-gray-800/40">
              <th className="px-5 py-3 text-left">Usuário</th>
              <th className="px-5 py-3 text-left">E-mail</th>
              <th className="px-5 py-3 text-left">Último acesso</th>
              <th className="px-5 py-3 text-center">Perfil</th>
              {isDono && <th className="px-5 py-3 text-center">Alterar perfil</th>}
              {isDono && <th className="px-5 py-3 text-center">Excluir</th>}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-blue-500 animate-pulse">Carregando usuários...</td></tr>
            )}
            {!isLoading && usuarios.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-600">Nenhum usuário encontrado.</td></tr>
            )}
            {usuarios.map((u: UsuarioAdmin) => {
              const roleInfo = u.role ? ROLES[u.role] : null;
              return (
                <tr key={u.id} className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-bold text-xs flex-shrink-0">
                        {(u.nome || u.email).slice(0, 1).toUpperCase()}
                      </div>
                      <span className="font-medium text-white">{u.nome || '—'}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-xs">{u.email}</td>
                  <td className="px-5 py-3 text-gray-500 text-xs">
                    {u.last_sign_in_at
                      ? new Date(u.last_sign_in_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
                      : 'Nunca'}
                  </td>
                  <td className="px-5 py-3 text-center">
                    {roleInfo
                      ? <span className={`text-xs font-bold ${roleInfo.cor}`}>● {roleInfo.label}</span>
                      : <span className="text-xs text-red-400 font-bold">Sem perfil</span>}
                  </td>
                  {isDono && (
                    <td className="px-5 py-3 text-center">
                      <select value={u.role ?? ''}
                        onChange={e => definirRole({ userId: u.id, role: e.target.value as Role })}
                        className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500 transition-colors">
                        <option value="">Sem perfil</option>
                        {Object.entries(ROLES).map(([key, r]) => (
                          <option key={key} value={key}>{r.label}</option>
                        ))}
                      </select>
                    </td>
                  )}
                  {isDono && (
                    <td className="px-5 py-3 text-center">
                      <button
                        onClick={() => setUsuarioParaExcluir(u)}
                        title="Excluir usuário"
                        className="text-gray-500 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-500/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-5">
        <p className="text-xs font-bold text-gray-400 uppercase mb-3">Permissões por Perfil</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(ROLES).map(([key, r]) => (
            <div key={key} className="bg-gray-800/40 border border-gray-700 rounded-lg p-3">
              <p className={`text-sm font-bold mb-1 ${r.cor}`}>● {r.label}</p>
              <p className="text-xs text-gray-500">{r.descricao}</p>
            </div>
          ))}
        </div>
      </div>

      <Modal open={modalConvite} onClose={() => setModalConvite(false)}
        title={<span className="flex items-center gap-1.5"><User className="w-4 h-4" /> Convidar Usuário</span>}
        maxWidth="440px"
        actions={<>
          <button onClick={() => setModalConvite(false)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm font-medium transition-all">Cancelar</button>
          <button onClick={handleConvitar} disabled={isConvidando || !conviteForm.email.trim()}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg text-sm font-bold transition-all">
            {isConvidando ? 'Enviando...' : 'Convidar'}
          </button>
        </>}>
        <div className="space-y-4">
          <div><Lbl>E-mail *</Lbl>
            <input autoFocus type="email" value={conviteForm.email}
              onChange={e => setConviteForm(f => ({ ...f, email: e.target.value }))}
              className={IN} placeholder="colaborador@email.com" />
          </div>
          <div><Lbl>Nome</Lbl>
            <input value={conviteForm.nome} onChange={e => setConviteForm(f => ({ ...f, nome: e.target.value }))}
              className={IN} placeholder="Nome do colaborador" />
          </div>
          <div><Lbl>Perfil de acesso</Lbl>
            <select value={conviteForm.role} onChange={e => setConviteForm(f => ({ ...f, role: e.target.value as Role }))} className={IN}>
              {Object.entries(ROLES).map(([key, r]) => (
                <option key={key} value={key}>{r.label} — {r.descricao}</option>
              ))}
            </select>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-xs text-blue-300">
            O usuário receberá um e-mail para definir a senha e acessar o sistema.
          </div>
        </div>
      </Modal>

      {/* Confirmação de exclusão */}
      <Modal open={!!usuarioParaExcluir} onClose={() => setUsuarioParaExcluir(null)}
        title={<span className="flex items-center gap-1.5 text-red-400"><Trash2 className="w-4 h-4" /> Excluir Usuário</span>}
        maxWidth="420px"
        actions={<>
          <button onClick={() => setUsuarioParaExcluir(null)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm font-medium transition-all">Cancelar</button>
          <button onClick={handleExcluir} disabled={isExcluindo}
            className="px-5 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white rounded-lg text-sm font-bold transition-all">
            {isExcluindo ? 'Excluindo...' : 'Excluir'}
          </button>
        </>}>
        <p className="text-sm text-gray-300">
          Tem certeza que deseja excluir <span className="font-bold text-white">{usuarioParaExcluir?.nome || usuarioParaExcluir?.email}</span>?
          Essa ação não pode ser desfeita — o acesso ao sistema será removido imediatamente.
        </p>
      </Modal>
    </div>
  );
}
