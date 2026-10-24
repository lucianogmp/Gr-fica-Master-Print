// src/pages/RedefinirSenha.tsx
//
// Rota pública /redefinir-senha: destino do link "Esqueci minha senha" enviado por e-mail.
// O Supabase Auth cria a sessão de recuperação sozinho a partir do link (mesmo
// mecanismo do AceitarConvite); aqui só esperamos a sessão e pedimos a nova senha.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

type Estado = 'validando' | 'pronto' | 'salvando' | 'erro' | 'concluido';
const IN = 'w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500';

export function RedefinirSenha() {
  const navigate = useNavigate();
  const [estado, setEstado] = useState<Estado>('validando');
  const [erro, setErro] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');

  useEffect(() => {
    let cancelado = false;
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!cancelado && session) setEstado('pronto');
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelado && session) setEstado('pronto');
    });
    const t = setTimeout(() => {
      if (cancelado) return;
      setEstado(a => {
        if (a === 'validando') { setErro('Este link expirou ou é inválido. Peça um novo em "Esqueci minha senha".'); return 'erro'; }
        return a;
      });
    }, 4000);
    return () => { cancelado = true; clearTimeout(t); listener.subscription.unsubscribe(); };
  }, []);

  async function salvar() {
    if (senha.length < 6) return setErro('A senha precisa ter pelo menos 6 caracteres.');
    if (senha !== confirmar) return setErro('As senhas não coincidem.');
    setEstado('salvando'); setErro('');
    const { error } = await supabase.auth.updateUser({ password: senha });
    if (error) { setErro(error.message); setEstado('pronto'); return; }
    setEstado('concluido');
    setTimeout(() => navigate('/', { replace: true }), 1500);
  }

  return (
    <div className="min-h-screen bg-[#111827] flex items-center justify-center p-4">
      <div className="bg-[#1f2937] border border-gray-700 rounded-2xl p-8 w-full max-w-md">
        <h1 className="text-xl font-black text-white mb-1">Criar nova senha</h1>
        <p className="text-gray-500 text-sm mb-6">Digite a nova senha de acesso ao sistema.</p>

        {estado === 'validando' && <p className="text-blue-400 text-sm animate-pulse">Validando link...</p>}
        {estado === 'erro' && (
          <div className="space-y-4">
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-300">{erro}</div>
            <button onClick={() => navigate('/login')} className="text-sm text-blue-400 hover:text-blue-300">Voltar ao login</button>
          </div>
        )}
        {(estado === 'pronto' || estado === 'salvando') && (
          <div className="space-y-4">
            {erro && <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-300">{erro}</div>}
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase">Nova senha</label>
              <input type="password" value={senha} onChange={e => setSenha(e.target.value)} autoComplete="new-password" className={IN} placeholder="Mínimo 6 caracteres" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase">Repita a senha</label>
              <input type="password" value={confirmar} onChange={e => setConfirmar(e.target.value)} autoComplete="new-password" className={IN} />
            </div>
            <button onClick={salvar} disabled={estado === 'salvando'}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl">
              {estado === 'salvando' ? 'Salvando...' : 'Salvar nova senha'}
            </button>
          </div>
        )}
        {estado === 'concluido' && <p className="text-green-400 text-sm">Senha alterada! Entrando...</p>}
      </div>
    </div>
  );
}
