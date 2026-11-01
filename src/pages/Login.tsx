import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { BookOpen, Moon, Sun, Clock } from 'lucide-react';
import { versiculoDoDia } from '../lib/versiculos';
import { lerEApagarMotivo, registrarAtividade } from '../lib/sessaoInatividade';
import { useTheme } from '../hooks/useTheme';

const CHAVE_LOGO = 'mp-logo-cache';

// Logo escolhido em Configurações. Fica guardado no aparelho para aparecer na hora, mesmo antes do login.
function useLogoPublico() {
  const [logo, setLogo] = useState<{ escuro: string | null; claro: string | null }>(() => {
    try { return JSON.parse(localStorage.getItem(CHAVE_LOGO) || '') ; } catch { return { escuro: null, claro: null }; }
  });
  useEffect(() => {
    supabase.rpc('logo_publico').then(({ data }) => {
      const r = Array.isArray(data) ? data[0] : data;
      if (!r) return;
      const novo = { escuro: r.logo_escuro ?? null, claro: r.logo_claro ?? null };
      setLogo(novo);
      try { localStorage.setItem(CHAVE_LOGO, JSON.stringify(novo)); } catch { /* ignora */ }
    });
  }, []);
  return logo;
}

export function Login() {
  const [motivo] = useState(() => lerEApagarMotivo());
  const [versiculo] = useState(() => versiculoDoDia());
  const logo = useLogoPublico();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  async function esqueci() {
    if (!email.trim()) { toast.error('Digite seu e-mail acima e clique de novo em "Esqueci minha senha".'); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    if (error) toast.error('Não foi possível enviar agora. Tente de novo em alguns minutos.');
    else toast.success('Se este e-mail tiver cadastro, enviamos um link para criar nova senha.');
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setLoading(false);
    if (error) {
      toast.error('Email ou senha incorretos.');
    } else {
      registrarAtividade();
      try { sessionStorage.removeItem('mp-sessao-iniciada'); } catch { /* ignora */ }
      navigate('/');
    }
  }

  return (
    <div className="min-h-screen bg-[#111827] flex flex-col items-center p-4">
      <button
        onClick={toggleTheme}
        className="theme-toggle fixed right-4 top-4 text-gray-300 hover:text-white transition-colors"
        aria-label={isDark ? 'Ativar tema claro' : 'Ativar tema escuro'}
        title={isDark ? 'Tema claro' : 'Tema escuro'}
      >
        {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>

      {/* Versículo do dia */}
      <div className="w-full max-w-2xl mt-10 sm:mt-6 flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/5 px-5 py-4">
        <BookOpen className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-[10px] font-bold tracking-widest text-amber-400 mb-1">VERSÍCULO DO DIA</p>
          <p className="text-gray-200 italic leading-snug">“{versiculo.texto}”</p>
          <p className="text-xs font-bold text-amber-400 mt-1">— {versiculo.ref}</p>
        </div>
      </div>

      <div className="w-full max-w-sm my-auto py-8">
        {/* Logo */}
        <div className="text-center mb-8">
          {(isDark ? logo.escuro : logo.claro) ? (
            <img src={(isDark ? logo.escuro : logo.claro)!} alt="Master Print" className="h-24 w-auto max-w-full object-contain mx-auto" />
          ) : (
            <h1 className="text-3xl font-black tracking-tighter">
              <span className="text-blue-500">MASTER</span>
              <span className="text-white"> PRINT</span>
            </h1>
          )}
          <p className="text-gray-500 text-sm mt-2">Sistema de Gestão</p>
        </div>

        {/* Card */}
        <div className="bg-[#1f2937] border border-gray-700 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-lg font-bold text-white mb-2">{motivo === 'inatividade' ? 'Sessão bloqueada' : 'Entrar na sua conta'}</h2>
          {motivo && (
            <p className="flex items-start gap-2 text-xs text-gray-400 mb-5">
              <Clock className="w-4 h-4 flex-shrink-0 text-amber-400" />
              {motivo === 'inatividade'
                ? 'Você ficou 30 minutos sem usar o sistema. Entre de novo para continuar.'
                : 'Novo dia, novo acesso. Entre para começar.'}
            </p>
          )}
          {!motivo && <div className="mb-4" />}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase block mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="seu@email.com"
                className="w-full bg-[#111827] border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-400 uppercase block mb-2">
                Senha
              </label>
              <input
                type="password"
                value={senha}
                onChange={e => setSenha(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full bg-[#111827] border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all mt-2 shadow-lg shadow-blue-900/30"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
            <button type="button" onClick={esqueci} className="w-full text-xs text-gray-400 hover:text-blue-400 transition-colors pt-1">
              Esqueci minha senha
            </button>
          </form>
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          Gráfica Master Print © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
