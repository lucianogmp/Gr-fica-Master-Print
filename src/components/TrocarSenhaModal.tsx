// src/components/TrocarSenhaModal.tsx
//
// Qualquer usuário logado troca a própria senha. Confere a senha atual antes
// (assim, quem pegar um computador aberto não consegue trocar a senha sem saber a atual).
import { useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { Modal } from './ui/Modal';

const IN = 'w-full bg-[#111827] border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors';
const MIN = 6;

export function TrocarSenhaModal({ open, onClose, email }: { open: boolean; onClose: () => void; email: string }) {
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  function fechar() {
    setAtual(''); setNova(''); setConfirmar(''); setErro('');
    onClose();
  }

  async function salvar() {
    setErro('');
    if (!atual) return setErro('Digite a senha atual.');
    if (nova.length < MIN) return setErro(`A nova senha precisa ter pelo menos ${MIN} caracteres.`);
    if (nova !== confirmar) return setErro('As senhas novas não coincidem.');
    if (nova === atual) return setErro('A nova senha precisa ser diferente da atual.');

    setSalvando(true);
    const { error: eAtual } = await supabase.auth.signInWithPassword({ email, password: atual });
    if (eAtual) {
      setSalvando(false);
      return setErro('A senha atual está incorreta.');
    }
    const { error } = await supabase.auth.updateUser({ password: nova });
    setSalvando(false);
    if (error) return setErro(error.message);
    toast.success('Senha alterada!');
    fechar();
  }

  return (
    <Modal
      open={open}
      onClose={fechar}
      title="Trocar minha senha"
      actions={
        <>
          <button onClick={fechar} className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white">Cancelar</button>
          <button onClick={salvar} disabled={salvando}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-bold">
            {salvando ? 'Salvando...' : 'Salvar nova senha'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {erro && <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-300">{erro}</div>}
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Senha atual</label>
          <input type="password" value={atual} onChange={e => setAtual(e.target.value)} autoComplete="current-password" className={IN} />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Nova senha</label>
          <input type="password" value={nova} onChange={e => setNova(e.target.value)} autoComplete="new-password" className={IN} placeholder={`Mínimo ${MIN} caracteres`} />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Repita a nova senha</label>
          <input type="password" value={confirmar} onChange={e => setConfirmar(e.target.value)} autoComplete="new-password" className={IN} />
        </div>
      </div>
    </Modal>
  );
}
