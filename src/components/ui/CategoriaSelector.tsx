// src/components/ui/CategoriaSelector.tsx
//
// Campo de categoria no mesmo estilo das outras buscas do sistema (cliente, produto):
// digita e a lista filtra na hora (sem opção "Sem categoria" no topo); se o texto não
// existe, aparece "Cadastrar «texto»" ali mesmo. Funciona para as duas listas de
// categorias: 'produto' (guarda o id) e 'material' (estoque, guarda o nome).
import { useMemo, useRef, useState, useEffect } from 'react';
import { Plus, X, Check } from 'lucide-react';
import { useCategorias, type TipoCategoria } from '../../hooks/useCategorias';
import { correspondeABusca } from '../../lib/buscaFlexivel';
import { useListaTeclado } from '../../hooks/useListaTeclado';
import { PainelFlutuante } from './PainelFlutuante';

interface Props {
  tipo: TipoCategoria;
  /** id da categoria (tipo 'produto') ou o nome (tipo 'material'). Vazio = sem categoria. */
  value: string;
  onChange: (valor: string) => void;
  className?: string;
}

type Opcao = { kind: 'cat'; id: string; nome: string } | { kind: 'nova'; nome: string };

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

export function CategoriaSelector({ tipo, value, onChange, className = '' }: Props) {
  const { data: categorias = [], criar } = useCategorias(tipo);
  const porNome = tipo === 'material';
  const atual = useMemo(
    () => categorias.find(c => (porNome ? c.nome === value : c.id === value)),
    [categorias, value, porNome]);

  const [texto, setTexto] = useState('');
  const [editando, setEditando] = useState(false);
  const [aberto, setAberto] = useState(false);
  const ancoraRef = useRef<HTMLDivElement>(null);

  // Mostra o nome escolhido quando não está digitando.
  useEffect(() => { if (!editando) setTexto(atual?.nome ?? (porNome ? value : '')); }, [atual, editando, porNome, value]);

  const opcoes = useMemo<Opcao[]>(() => {
    const q = editando ? texto.trim() : '';
    const lista: Opcao[] = categorias
      .filter(c => !q || correspondeABusca(c.nome, q))
      .map(c => ({ kind: 'cat', id: c.id, nome: c.nome }));
    if (q && !categorias.some(c => norm(c.nome) === norm(q))) lista.push({ kind: 'nova', nome: q });
    return lista;
  }, [categorias, texto, editando]);

  function escolher(c: { id: string; nome: string }) {
    onChange(porNome ? c.nome : c.id);
    setEditando(false); setAberto(false);
  }

  async function escolherOpcao(o: Opcao) {
    if (o.kind === 'cat') { escolher(o); return; }
    try {
      const nova = await criar(o.nome);
      escolher(nova);
    } catch { /* o hook já mostra o erro */ }
  }

  const { indice, setIndice, onKeyDown, listaRef } = useListaTeclado<Opcao>({
    itens: opcoes, aberto, abrir: () => setAberto(true), fechar: () => { setAberto(false); setEditando(false); },
    onSelecionar: escolherOpcao, chave: texto,
  });

  return (
    <div ref={ancoraRef} className={`relative ${className}`}>
      <input
        value={texto}
        onChange={e => { setTexto(e.target.value); setEditando(true); setAberto(true); }}
        onFocus={e => { e.target.select(); setEditando(true); setAberto(true); }}
        onBlur={() => setTimeout(() => { setEditando(false); setAberto(false); }, 120)}
        onKeyDown={onKeyDown}
        role="combobox" aria-expanded={aberto} autoComplete="off"
        placeholder="Buscar ou criar categoria..."
        className="w-full bg-[#111827] border border-gray-700 rounded-lg pl-3 pr-8 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
      />
      {value && (
        <button type="button" title="Tirar categoria" onMouseDown={e => { e.preventDefault(); onChange(''); setTexto(''); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      )}
      <PainelFlutuante ancora={ancoraRef} aberto={aberto && opcoes.length > 0} onFechar={() => { setAberto(false); setEditando(false); }}
        largura={ancoraRef.current?.offsetWidth ?? 280} alinhar="left" className="max-h-72 overflow-y-auto">
        <div ref={listaRef}>
          {opcoes.map((o, idx) => (
            <button key={o.kind === 'cat' ? o.id : '__nova'} type="button" data-nav={idx}
              onMouseDown={e => { e.preventDefault(); escolherOpcao(o); }}
              onMouseEnter={() => setIndice(idx)}
              className={`w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors ${idx === indice ? 'bg-gray-700' : 'hover:bg-gray-700'} ${o.kind === 'nova' ? 'text-green-400 font-semibold border-t border-gray-700/50' : 'text-white'}`}>
              {o.kind === 'nova'
                ? <><Plus className="w-4 h-4 flex-shrink-0" /> Cadastrar categoria “{o.nome}”</>
                : <>{(porNome ? o.nome === value : o.id === value) ? <Check className="w-4 h-4 text-blue-400 flex-shrink-0" /> : <span className="w-4 flex-shrink-0" />}{o.nome}</>}
            </button>
          ))}
        </div>
      </PainelFlutuante>
    </div>
  );
}
