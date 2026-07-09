// src/pages/AceitarConvite.tsx
//
// Rota pública (fora do ProtectedRoute) que trata o link do e-mail de convite.
// Path: /aceitar-convite
//
// O Supabase Auth já processa automaticamente o token do link de convite
// (detectSessionInUrl) e cria a sessão da pessoa convidada sozinho, antes
// desse componente montar. Por isso, aqui a gente NÃO mexe manualmente na
// URL nem faz signOut — só espera a sessão aparecer e mostra o formulário
// de criar senha. Isso evita condição de corrida com o processo automático.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

type Estado = 'validando' | 'pronto' | 'salvando' | 'erro' | 'concluido';

export function AceitarConvite() {
  const navigate = useNavigate();
  const [estado, setEstado] = useState<Estado>('validando');
  const [erro, setErro] = useState('');
  const [nome, setNome] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');

  useEffect(() => {
    let cancelado = false;

    // Ouve mudanças de sessão — cobre o caso em que o Supabase ainda está
    // processando o token do link no momento em que a página monta
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelado) return;
      if (session) {
        const nomeConvite = (session.user.user_metadata as any)?.nome;
        if (nomeConvite) setNome(nomeConvite);
        setEstado('pronto');
      }
    });

    // Também confere imediatamente, caso a sessão já tenha sido
    // estabelecida antes do listener ser registrado
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelado) return;
      if (session) {
        const nomeConvite = (session.user.user_metadata as any)?.nome;
        if (nomeConvite) setNome(nomeConvite);
        setEstado('pronto');
      }
    });

    // Se depois de alguns segundos nenhuma sessão apareceu, o link
    // provavelmente é inválido ou expirou
    const timeout = setTimeout(() => {
      if (!cancelado) {
        setEstado(atual => {
          if (atual === 'validando') {
            setErro('Este convite expirou ou o link é inválido. Peça um novo convite.');
            return 'erro';
          }
          return atual;
        });
      }
    }, 4000);

    return () => {
      cancelado = true;
      clearTimeout(timeout);
      listener.subscription.unsubscribe();
    };
  }, []);

  async function handleSalvar() {
    if (senha.length < 6) {
      setErro('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    if (senha !== confirmar) {
      setErro('As senhas não coincidem.');
      return;
    }

    setEstado('salvando');
    setErro('');

    const { error } = await supabase.auth.updateUser({
      password: senha,
      data: { nome: nome.trim() },
    });

    if (error) {
      setErro(error.message);
      setEstado('pronto');
      return;
    }

    setEstado('concluido');
    setTimeout(() => navigate('/', { replace: true }), 1500);
  }

  return (
    <div className="min-h-screen bg-[#111827] flex items-center justify-center p-4">
      <div className="bg-[#1f2937] border border-gray-700 rounded-2xl p-8 w-full max-w-md">
        <h1 className="text-xl font-black text-white mb-1">Bem-vindo(a) ao Master Print</h1>
        <p className="text-gray-500 text-sm mb-6">Defina seus dados de acesso para começar.</p>

        {estado === 'validando' && (
          <p className="text-blue-400 text-sm animate-pulse">Validando convite...</p>
        )}

        {estado === 'erro' && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-300">
            {erro}
          </div>
        )}

        {(estado === 'pronto' || estado === 'salvando') && (
          <div className="space-y-4">
            {erro && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-300">
                {erro}
              </div>
            )}
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase">Nome</label>
              <input
                value={nome}
                onChange={e => setNome(e.target.value)}
                className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                placeholder="Seu nome"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase">Senha</label>
              <input
                type="password"
                value={senha}
                onChange={e => setSenha(e.target.value)}
                className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase">Confirmar senha</label>
              <input
                type="password"
                value={confirmar}
                onChange={e => setConfirmar(e.target.value)}
                className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                placeholder="Repita a senha"
              />
            </div>
            <button
              onClick={handleSalvar}
              disabled={estado === 'salvando'}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white py-2.5 rounded-lg text-sm font-bold transition-all"
            >
              {estado === 'salvando' ? 'Salvando...' : 'Acessar o sistema'}
            </button>
          </div>
        )}

        {estado === 'concluido' && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-sm text-green-300">
            Tudo certo! Redirecionando para o sistema...
          </div>
        )}
      </div>
    </div>
  );
}
