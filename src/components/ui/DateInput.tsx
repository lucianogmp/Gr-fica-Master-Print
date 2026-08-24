// src/components/ui/DateInput.tsx
//
// Campo de data com calendário próprio, no visual do sistema — substitui o
// <input type="date"> nativo do navegador (que abre o seletor cinza do
// Chrome/SO e não segue o tema escuro do app).
//
// Uso: igual a um <input type="date">. value/onChange trabalham com string
// no formato "YYYY-MM-DD" (mesmo formato que o banco/Supabase já usa).
//
//   <DateInput value={form.data_venda} onChange={v => setF('data_venda', v)} className={IN} />
//
// Clicando no "mês de ano" do cabeçalho, abre uma grade de anos (12 por vez,
// com setas pra voltar/avançar 12 anos de uma vez) — assim dá pra pular
// direto pro ano certo em vez de clicar mês a mês até chegar lá.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';

const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

/** Parseia "YYYY-MM-DD" como data LOCAL (evita o bug de fuso do `new Date(string)`). */
function parseISO(iso?: string | null): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function mesmoDia(a: Date | null, b: Date | null): boolean {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

interface DateInputProps {
  /** Valor no formato ISO "YYYY-MM-DD" (mesmo que type="date" nativo). */
  value: string | null | undefined;
  onChange: (valorISO: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  name?: string;
  /** Alinhamento do popover em relação ao campo. Padrão: 'left'. */
  align?: 'left' | 'right';
}

export function DateInput({
  value, onChange, className, placeholder = 'dd/mm/aaaa', disabled, required, id, name, align = 'left',
}: DateInputProps) {
  const [aberto, setAberto] = useState(false);
  const selecionado = parseISO(value);
  const [mesVisivel, setMesVisivel] = useState<Date>(selecionado ?? new Date());
  const [modoAno, setModoAno] = useState(false);
  const [anoGradeCentro, setAnoGradeCentro] = useState<number>((selecionado ?? new Date()).getFullYear());
  const wrapperRef = useRef<HTMLDivElement>(null);
  const botaoRef = useRef<HTMLButtonElement>(null);
  const painelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  // Recalcula a posição do painel (encostado no campo, mas fora do fluxo normal —
  // por isso vai por portal, sem depender de overflow/stacking-context dos pais)
  useLayoutEffect(() => {
    if (!aberto || !botaoRef.current) return;
    function calcular() {
      const r = botaoRef.current!.getBoundingClientRect();
      const larguraPainel = 256; // w-64
      const alturaPainelEstimada = 340;
      const espacoAbaixo = window.innerHeight - r.bottom;
      const abrirParaCima = espacoAbaixo < alturaPainelEstimada && r.top > alturaPainelEstimada;

      let left = align === 'right' ? r.right - larguraPainel : r.left;
      // mantém dentro da viewport horizontalmente
      left = Math.min(Math.max(left, 8), window.innerWidth - larguraPainel - 8);

      setPos({
        top: abrirParaCima ? r.top - alturaPainelEstimada - 6 : r.bottom + 6,
        left,
        width: larguraPainel,
      });
    }
    calcular();
    window.addEventListener('scroll', calcular, true);
    window.addEventListener('resize', calcular);
    return () => {
      window.removeEventListener('scroll', calcular, true);
      window.removeEventListener('resize', calcular);
    };
  }, [aberto, align]);

  // Fecha ao clicar fora (considerando o botão E o painel, que agora vive em outro lugar do DOM) ou apertar Esc
  useEffect(() => {
    if (!aberto) return;
    function onClickFora(e: MouseEvent) {
      const alvo = e.target as Node;
      if (botaoRef.current?.contains(alvo)) return;
      if (painelRef.current?.contains(alvo)) return;
      setAberto(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setAberto(false);
    }
    document.addEventListener('mousedown', onClickFora);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onClickFora);
      document.removeEventListener('keydown', onEsc);
    };
  }, [aberto]);

  // Sincroniza o mês visível quando o valor muda por fora
  useEffect(() => {
    if (selecionado) setMesVisivel(selecionado);
  }, [value]);

  function abrir() {
    if (disabled) return;
    setMesVisivel(selecionado ?? new Date());
    setModoAno(false);
    setAberto(true);
  }

  function selecionar(d: Date) {
    onChange(toISO(d));
    setAberto(false);
  }

  function abrirSeletorDeAno() {
    setAnoGradeCentro(ano);
    setModoAno(true);
  }

  function selecionarAno(anoEscolhido: number) {
    setMesVisivel(new Date(anoEscolhido, mes, 1));
    setModoAno(false);
  }

  const hoje = new Date();
  const ano = mesVisivel.getFullYear();
  const mes = mesVisivel.getMonth();
  const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
  const totalDias = new Date(ano, mes + 1, 0).getDate();
  const diasMesAnterior = new Date(ano, mes, 0).getDate();

  const celulas: { dia: number; data: Date; foraDoMes: boolean }[] = [];
  for (let i = primeiroDiaSemana - 1; i >= 0; i--) {
    celulas.push({ dia: diasMesAnterior - i, data: new Date(ano, mes - 1, diasMesAnterior - i), foraDoMes: true });
  }
  for (let d = 1; d <= totalDias; d++) {
    celulas.push({ dia: d, data: new Date(ano, mes, d), foraDoMes: false });
  }
  while (celulas.length % 7 !== 0 || celulas.length < 42) {
    const ultima = celulas[celulas.length - 1].data;
    const prox = new Date(ultima);
    prox.setDate(prox.getDate() + 1);
    celulas.push({ dia: prox.getDate(), data: prox, foraDoMes: true });
    if (celulas.length >= 42) break;
  }

  // Grade de anos: 12 por vez (4 colunas x 3 linhas), centrada no ano atual do mês visível.
  const anoInicioGrade = anoGradeCentro - 5;
  const anosGrade = Array.from({ length: 12 }, (_, i) => anoInicioGrade + i);

  const label = selecionado
    ? selecionado.toLocaleDateString('pt-BR')
    : '';

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        ref={botaoRef}
        type="button"
        id={id}
        onClick={abrir}
        disabled={disabled}
        className={`${className ?? ''} flex items-center justify-between gap-2 text-left disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <span className={label ? 'text-white' : 'text-gray-500'}>{label || placeholder}</span>
        <CalendarIcon className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
      </button>

      {/* input escondido — garante integração com validação/required de formulários nativos */}
      {required && (
        <input tabIndex={-1} type="text" name={name} value={value ?? ''} required
          onChange={() => {}} className="absolute inset-0 w-0 h-0 opacity-0 pointer-events-none" />
      )}

      {aberto && pos && createPortal(
        <div
          ref={painelRef}
          style={{
            top: pos.top, left: pos.left, width: pos.width,
            position: 'fixed', zIndex: 9999,
            backgroundColor: '#1f2937', // inline de propósito — classe Tailwind
            // arbitrária pode falhar de gerar dependendo do build, deixando o
            // painel transparente com o conteúdo de trás "vazando" por cima.
            border: '1px solid #374151',
            borderRadius: 12,
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          }}
          className="p-3"
        >
          {/* Cabeçalho: mês/ano (clicável pra abrir a grade de anos) + navegação */}
          <div className="flex items-center justify-between mb-2">
            <button type="button"
              onClick={() => modoAno ? setAnoGradeCentro(a => a - 12) : setMesVisivel(new Date(ano, mes - 1, 1))}
              className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => (modoAno ? setModoAno(false) : abrirSeletorDeAno())}
              title={modoAno ? 'Voltar para o calendário' : 'Escolher outro ano'}
              className="text-xs font-bold text-white capitalize hover:text-blue-400 transition-colors px-2 py-0.5 rounded-md hover:bg-gray-700/60"
            >
              {modoAno ? `${anoInicioGrade} – ${anoInicioGrade + 11}` : `${MESES[mes]} de ${ano}`}
            </button>
            <button type="button"
              onClick={() => modoAno ? setAnoGradeCentro(a => a + 12) : setMesVisivel(new Date(ano, mes + 1, 1))}
              className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {modoAno ? (
            /* Grade de anos — clique escolhe o ano e volta pro calendário de dias */
            <div className="grid grid-cols-4 gap-1.5 py-1">
              {anosGrade.map(a => {
                const isAnoAtual = a === ano;
                const isAnoDeHoje = a === hoje.getFullYear();
                return (
                  <button
                    type="button"
                    key={a}
                    onClick={() => selecionarAno(a)}
                    className={[
                      'text-xs py-2 rounded-md transition-colors font-medium',
                      isAnoAtual ? 'bg-blue-600 text-white font-bold hover:bg-blue-500'
                        : isAnoDeHoje ? 'bg-gray-700 text-white font-bold hover:bg-gray-600'
                        : 'text-gray-200 hover:bg-gray-700',
                    ].join(' ')}
                  >
                    {a}
                  </button>
                );
              })}
            </div>
          ) : (
            <>
              {/* Dias da semana */}
              <div className="grid grid-cols-7 mb-1">
                {DIAS_SEMANA.map((d, i) => (
                  <span key={i} className="text-[10px] font-bold text-gray-500 text-center py-1">{d}</span>
                ))}
              </div>

              {/* Grade de dias */}
              <div className="grid grid-cols-7 gap-y-0.5">
                {celulas.map(({ dia, data, foraDoMes }, i) => {
                  const isSelecionado = mesmoDia(data, selecionado);
                  const isHoje = mesmoDia(data, hoje);
                  return (
                    <button
                      type="button"
                      key={i}
                      onClick={() => selecionar(data)}
                      className={[
                        'text-xs w-8 h-8 rounded-md transition-colors',
                        foraDoMes ? 'text-gray-600' : 'text-gray-200',
                        isSelecionado ? 'bg-blue-600 text-white font-bold hover:bg-blue-500'
                          : isHoje ? 'bg-gray-700 text-white font-bold hover:bg-gray-600'
                          : 'hover:bg-gray-700',
                      ].join(' ')}
                    >
                      {dia}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* Rodapé: Limpar / Hoje — só faz sentido na visão de dias */}
          {!modoAno && (
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-700">
              <button type="button" onClick={() => { onChange(''); setAberto(false); }}
                className="text-[11px] font-bold text-gray-400 hover:text-white transition-colors">
                Limpar
              </button>
              <button type="button" onClick={() => selecionar(hoje)}
                className="text-[11px] font-bold text-blue-400 hover:text-blue-300 transition-colors">
                Hoje
              </button>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
