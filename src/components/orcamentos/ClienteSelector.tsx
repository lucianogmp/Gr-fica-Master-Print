import { useState, useRef, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { ArrowRight } from 'lucide-react';

interface Props {
  value: string;
  onChange: (nome: string) => void;
}

interface ClienteSimples { id: string; nome: string; telefone?: string | null; }

export function ClienteSelector({ value, onChange }: Props) {
  const [busca, setBusca]       = useState(value);
  const [opcoes, setOpcoes]     = useState<ClienteSimples[]>([]);
  const [aberto, setAberto]     = useState(false);
  const [showNovo, setShowNovo] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [novoTel, setNovoTel]   = useState('');
  const [salvando, setSalvando] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node))
        setAberto(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => { setBusca(value); }, [value]);

  async function pesquisar(q: string) {
    setBusca(q);
    onChange(q);
    if (q.length < 1) { setOpcoes([]); setAberto(false); return; }
    const { data } = await supabase
      .from('clientes')
      .select('id, nome, telefone')
      .ilike('nome', `%${q}%`)
      .limit(8);
    setOpcoes(data ?? []);
    setAberto(true);
  }

  function selecionar(c: ClienteSimples) {
    setBusca(c.nome);
    onChange(c.nome);
    setAberto(false);
    setOpcoes([]);
  }

  async function criarCliente() {
    if (!novoNome.trim()) return;
    setSalvando(true);
    try {
      const { data, error } = await supabase
        .from('clientes')
        .insert({ nome: novoNome.trim(), telefone: novoTel.trim() || null })
        .select('id, nome, telefone')
        .single();
      if (error) throw error;
      selecionar(data as ClienteSimples);
      setShowNovo(false);
      setNovoNome('');
      setNovoTel('');
      toast.success('Cliente cadastrado!');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSalvando(false);
    }
  }

  const IN = "w-full bg-[#111827] border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors";

  return (
    <div ref={wrapRef} className="space-y-2">
      <label className="text-xs font-bold text-gray-400 uppercase block">Cliente *</label>

      <div className="relative flex gap-2">
        <div className="relative flex-1">
          <input
            value={busca}
            onChange={e => pesquisar(e.target.value)}
            onFocus={() => busca.length > 0 && opcoes.length > 0 && setAberto(true)}
            className={IN}
            placeholder="Digite para buscar ou criar cliente..."
            autoComplete="off"
          />

          {/* Dropdown — estilos inline para vencer o glassmorphism do index.css */}
          {aberto && opcoes.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: '4px',
                zIndex: 9999,
                backgroundColor: '#0f1824',
                border: '1px solid #374151',
                borderRadius: '12px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
                overflow: 'hidden',
                backdropFilter: 'none',
                WebkitBackdropFilter: 'none',
              }}
            >
              {opcoes.map((c, idx) => (
                <button
                  key={c.id}
                  onMouseDown={e => { e.preventDefault(); selecionar(c); }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    backgroundColor: 'transparent',
                    borderBottom: idx < opcoes.length - 1 ? '1px solid #1f2937' : 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background-color 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#1a2535')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <div>
                    <p style={{ color: '#ffffff', fontSize: '14px', fontWeight: 600, margin: 0 }}>
                      {c.nome}
                    </p>
                    {c.telefone && (
                      <p style={{ color: '#9ca3af', fontSize: '12px', margin: '2px 0 0 0' }}>
                        {c.telefone}
                      </p>
                    )}
                  </div>
                  <ArrowRight style={{ width: 14, height: 14, color: '#6b7280', flexShrink: 0 }} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Botão novo cliente */}
        <button
          onClick={() => { setShowNovo(!showNovo); setNovoNome(busca); }}
          title="Cadastrar novo cliente"
          className="w-10 h-10 flex-shrink-0 bg-blue-600 hover:bg-blue-500 text-white rounded-lg flex items-center justify-center font-bold text-lg transition-all"
        >
          +
        </button>
      </div>

      {/* Mini formulário novo cliente */}
      {showNovo && (
        <div className="bg-[#111827] border border-blue-500/30 rounded-xl p-4 space-y-3">
          <p className="text-xs font-bold text-blue-300 uppercase">Cadastrar Novo Cliente</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-gray-500 uppercase block mb-1">Nome *</label>
              <input
                autoFocus
                value={novoNome}
                onChange={e => setNovoNome(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') criarCliente(); }}
                className={IN}
                placeholder="Nome do cliente"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 uppercase block mb-1">Telefone</label>
              <input
                value={novoTel}
                onChange={e => setNovoTel(e.target.value)}
                className={IN}
                placeholder="(00) 00000-0000"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowNovo(false)}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs font-medium transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={criarCliente}
              disabled={salvando || !novoNome.trim()}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg text-xs font-bold transition-all"
            >
              {salvando ? 'Salvando...' : 'Cadastrar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
