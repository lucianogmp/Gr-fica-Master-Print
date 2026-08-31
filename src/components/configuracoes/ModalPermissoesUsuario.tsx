// src/components/configuracoes/ModalPermissoesUsuario.tsx
import { Modal } from '../ui/Modal';
import { CheckSquare, Square, RotateCcw } from 'lucide-react';
import { UsuarioAdmin } from '../../hooks/useUsuarios';
import { usePermissoesDoUsuario } from '../../hooks/usePermissoesUsuario';
import { PERMISSOES_MENU } from '../../types/permissoesMenu';
import { temPermissao, Role } from '../../types/roles';

interface Props {
  usuario: UsuarioAdmin | null;
  onClose: () => void;
}

export function ModalPermissoesUsuario({ usuario, onClose }: Props) {
  const { data: overrides = [], definir, remover } = usePermissoesDoUsuario(usuario?.id ?? null);

  if (!usuario) return null;

  const role = usuario.role as Role | null;

  function overrideDe(rota: string) {
    return overrides.find(o => o.rota === rota);
  }

  function efetivo(rota: string): boolean {
    const ov = overrideDe(rota);
    if (ov) return ov.permitido;
    return temPermissao(role, rota);
  }

  async function alternar(rota: string) {
    const padrao = temPermissao(role, rota);
    const atual = efetivo(rota);
    // Se o novo valor bater com o padrão do cargo, remove o override (fica
    // "seguindo o cargo" de novo) em vez de guardar um override redundante.
    const novo = !atual;
    if (novo === padrao) {
      await remover(rota);
    } else {
      await definir({ rota, permitido: novo });
    }
  }

  return (
    <Modal open={!!usuario} onClose={onClose}
      title={<span>Permissões — <span className="text-white">{usuario.nome || usuario.email}</span></span>}
      maxWidth="640px"
      actions={<button onClick={onClose} className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold transition-all">Fechar</button>}
    >
      <div className="space-y-1">
        <p className="text-xs text-gray-500 mb-3">
          Já vem marcado de acordo com o perfil <span className="font-bold text-gray-300">{role ?? 'sem perfil'}</span>.
          Desmarque ou marque pra abrir uma exceção só pra essa pessoa — o ícone de <RotateCcw className="w-3 h-3 inline -mt-0.5" /> volta pro padrão do cargo.
        </p>
        <div className="max-h-[55vh] overflow-y-auto pr-1 space-y-4">
          {PERMISSOES_MENU.map(grupo => (
            <div key={grupo.grupo}>
              <p className="text-[10px] font-bold text-gray-500 uppercase mb-1.5">{grupo.grupo}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {grupo.itens.map(item => {
                  const ov = overrideDe(item.rota);
                  const marcado = efetivo(item.rota);
                  const padrao = temPermissao(role, item.rota);
                  return (
                    <div key={item.rota}
                      className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg ${ov ? 'bg-blue-500/10 border border-blue-500/20' : ''}`}>
                      <button onClick={() => alternar(item.rota)} className="flex items-center gap-2 text-left flex-1 min-w-0">
                        {marcado ? <CheckSquare className="w-4 h-4 text-blue-400 flex-shrink-0" /> : <Square className="w-4 h-4 text-gray-600 flex-shrink-0" />}
                        <span className={`text-xs truncate ${marcado ? 'text-gray-200' : 'text-gray-500'}`}>{item.label}</span>
                      </button>
                      {ov && (
                        <button onClick={() => remover(item.rota)} title={`Voltar ao padrão do cargo (${padrao ? 'liberado' : 'bloqueado'})`}
                          className="text-gray-600 hover:text-blue-400 transition-colors flex-shrink-0">
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
