// src/components/impressao/DocumentoCustos.tsx
//
// Relatório INTERNO de custos do orçamento (uso exclusivo do dono/admin —
// nunca enviar ao cliente). Mostra, item a item, de onde vem cada centavo
// de custo (material, estrutura/serralheria, acabamentos, instalação),
// depois o resumo geral por categoria, o TOTAL DE CUSTOS e o lucro.
//
// IMPORTANTE: assim como DocumentoImpressao.tsx, usa apenas estilos inline
// (style={...}), nunca classes Tailwind — o documento é renderizado dentro
// de uma janela de impressão em branco, sem o CSS compilado do app.

import type { CSSProperties } from 'react';
import type { Configuracoes } from '../../types/configuracoes';
import type { OrcamentoItem } from '../../types/orcamento';
import { agregarCustoDetalhadoOrcamento } from '../../types/orcamento';
import type { TipoInstalacaoPlaca } from '../../lib/placaCalc';

export interface DocumentoCustosData {
  numero?: number | null;
  /** data de emissão (YYYY-MM-DD ou ISO completo) */
  data?: string | null;
  clienteNome: string;
  /** título curto do orçamento (ex: "Fachada") */
  titulo?: string | null;
  itens: OrcamentoItem[];
  /** desconto global do orçamento, em % (0-100) */
  descontoPct: number;
  observacoes?: string | null;
}

const fmtBRL = (v: number) =>
  Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtNum = (v: number, casas = 2) =>
  Number(v ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: casas });

const fmtPct = (v: number) => `${Number.isFinite(v) ? v.toFixed(1) : '0.0'}%`;

const fmtData = (d?: string | null) => {
  if (!d) return '—';
  const iso = d.length === 10 ? `${d}T00:00:00` : d;
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return '—';
  return data.toLocaleDateString('pt-BR');
};

const INSTALACAO_LABEL: Record<TipoInstalacaoPlaca, string> = {
  sem: 'Sem instalação (retirada)',
  esticar: 'Somente esticar lona',
  completa: 'Instalação completa',
};

const unidadeAcab = (t?: string) => (t === 'metro_linear' ? 'm' : t === 'm2' ? 'm²' : 'un.');

const regraAcab = (t?: string, f?: number | null) => {
  const fator = Number(f ?? 0);
  if (!fator) return '';
  if (t === 'perimetro') return ` (1 a cada ${fmtNum(100 / fator, 0)} cm do perímetro)`;
  if (t === 'metro_linear') return ` (${fmtNum(fator)} m por metro de perímetro)`;
  if (t === 'm2') return ` (${fmtNum(fator)} por m²)`;
  return '';
};

const COR = '#111827';
const ALERTA = '#b91c1c';
const BORDA = '#e5e7eb';

const th: CSSProperties = {
  textAlign: 'left', padding: '5px 8px', fontSize: 10, fontWeight: 700,
  color: '#6b7280', textTransform: 'uppercase', borderBottom: `1px solid ${BORDA}`,
};
const thR: CSSProperties = { ...th, textAlign: 'right' };
const td: CSSProperties = { padding: '5px 8px', fontSize: 11, borderBottom: `1px solid #f3f4f6` };
const tdR: CSSProperties = { ...td, textAlign: 'right', whiteSpace: 'nowrap' };

interface LinhaCusto {
  categoria: string;
  detalhe: string;
  valor: number;
  /** linha de subtotal/ênfase */
  destaque?: boolean;
}

/** Quebra o custo de UM item em linhas (categoria → detalhe → valor). */
function linhasDoItem(it: OrcamentoItem): { linhas: LinhaCusto[]; custo: number } {
  const d = it.detalhe_placa;

  if (d) {
    const linhas: LinhaCusto[] = [];

    linhas.push({
      categoria: 'Material / impressão',
      detalhe: `${d.material.nome || '—'} · ${fmtNum(d.area_total_m2)} m² × ${fmtBRL(d.material.custo_m2)}/m²`,
      valor: d.material.custo_total,
    });

    if (d.possui_armacao && d.serralheria) {
      const s = d.serralheria;
      const custoMetalon = Number(s.custo_total) - Number(s.mao_obra_custo);
      linhas.push({
        categoria: 'Estrutura — metalon',
        detalhe: `${s.metalon_nome || '—'} · ${fmtNum(s.qtd_usada)} m × ${fmtBRL(s.custo_metro)}/m`,
        valor: custoMetalon,
      });
      linhas.push({
        categoria: 'Estrutura — mão de obra',
        detalhe: `${fmtNum(s.mao_obra_pct, 1)}% sobre o metalon`,
        valor: s.mao_obra_custo,
      });
    } else {
      linhas.push({ categoria: 'Estrutura', detalhe: 'Sem armação (cliente já possui)', valor: 0 });
    }

    if (d.acabamentos.length === 0) {
      linhas.push({ categoria: 'Acabamentos', detalhe: 'Nenhum', valor: 0 });
    } else {
      for (const a of d.acabamentos) {
        linhas.push({
          categoria: 'Acabamento',
          detalhe: `${a.nome} · ${fmtNum(a.qtd_usada)} ${unidadeAcab(a.tipo_calculo)} × ${fmtBRL(a.custo_unitario)}/${unidadeAcab(a.tipo_calculo)}${regraAcab(a.tipo_calculo, a.fator_calculo)}`,
          valor: a.custo_total,
        });
      }
    }

    if (d.acabamentos.length > 1) {
      linhas.push({
        categoria: 'Subtotal acabamentos',
        detalhe: `${d.acabamentos.length} acabamentos`,
        valor: d.acabamentos.reduce((t, a) => t + Number(a.custo_total), 0),
        destaque: true,
      });
    }

    linhas.push({
      categoria: 'Instalação',
      detalhe: INSTALACAO_LABEL[d.instalacao.tipo] ?? '—',
      valor: d.instalacao.custo,
    });

    return { linhas, custo: Number(d.custo_total) };
  }

  // Item genérico (m² manual, folha, produto avulso): sem divisão por categoria.
  const custoBase = Number(it.custo_unitario ?? 0);
  const qtd = Number(it.quantidade ?? 0);
  const area = it.area_m2;
  const custo = custoBase > 0 ? custoBase * (area != null ? Number(area) * qtd : qtd) : 0;
  const detalhe = custoBase > 0
    ? (area != null
        ? `${fmtNum(Number(area) * qtd)} m² × ${fmtBRL(custoBase)}/m²`
        : `${fmtNum(qtd)} × ${fmtBRL(custoBase)}`)
    : 'Custo não cadastrado';
  return { linhas: [{ categoria: 'Custo do item', detalhe, valor: custo }], custo };
}

interface Props {
  empresa: Partial<Configuracoes>;
  documento: DocumentoCustosData;
  style?: CSSProperties;
}

export function DocumentoCustos({ empresa, documento: doc, style }: Props) {
  const resumo = agregarCustoDetalhadoOrcamento(doc.itens);
  const subtotal = doc.itens.reduce((s, i) => s + Number(i.total), 0);
  const desconto = subtotal * (doc.descontoPct / 100);
  const totalFinal = subtotal - desconto;
  const lucro = totalFinal - resumo.total;
  const margem = totalFinal > 0 ? (lucro / totalFinal) * 100 : 0;

  // Estrutura separada em metalon × mão de obra, e acabamentos somados por
  // nome (ex: "Parafuso: 56 un." somando todos os itens) — só pro resumo geral.
  let estruturaMetalon = 0;
  let estruturaMaoObra = 0;
  const acabPorNome = new Map<string, { qtd: number; custo: number; un: string }>();
  for (const it of doc.itens) {
    const d = it.detalhe_placa;
    if (!d) continue;
    if (d.serralheria) {
      estruturaMaoObra += Number(d.serralheria.mao_obra_custo);
      estruturaMetalon += Number(d.serralheria.custo_total) - Number(d.serralheria.mao_obra_custo);
    }
    for (const a of d.acabamentos) {
      const atual = acabPorNome.get(a.nome) ?? { qtd: 0, custo: 0, un: unidadeAcab(a.tipo_calculo) };
      acabPorNome.set(a.nome, { qtd: atual.qtd + Number(a.qtd_usada), custo: atual.custo + Number(a.custo_total), un: atual.un });
    }
  }

  const pct = (v: number) => (resumo.total > 0 ? fmtPct((v / resumo.total) * 100) : '—');

  return (
    <div
      style={{
        background: '#ffffff', color: COR, padding: 32, width: '210mm',
        margin: '0 auto', fontFamily: 'Arial, Helvetica, sans-serif',
        boxSizing: 'border-box', ...style,
      }}
    >
      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {empresa.empresa_logo_url && (
            <img src={empresa.empresa_logo_url} alt="Logo" style={{ height: 48, width: 'auto', objectFit: 'contain' }} />
          )}
          <div>
            <p style={{ fontSize: 16, fontWeight: 900, margin: 0 }}>{empresa.empresa_nome || 'Sua Empresa'}</p>
            {empresa.empresa_cnpj && (
              <p style={{ fontSize: 11, color: '#4b5563', margin: '2px 0 0' }}>CNPJ: {empresa.empresa_cnpj}</p>
            )}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: 18, fontWeight: 900, margin: 0 }}>Relatório de Custos</p>
          <p style={{ fontSize: 12, color: '#6b7280', margin: '2px 0 0' }}>
            Orçamento {doc.numero ? `Nº ${doc.numero}` : 'sem número'}
          </p>
        </div>
      </div>

      <div style={{
        border: `1px solid ${ALERTA}`, background: '#fef2f2', color: ALERTA,
        padding: '6px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, marginBottom: 14,
      }}>
        🔒 USO INTERNO — contém custos e margens. Não enviar ao cliente.
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 18 }}>
        <div>
          <p style={{ margin: 0, fontWeight: 700 }}>Cliente: {doc.clienteNome || '—'}</p>
          {doc.titulo && <p style={{ margin: '2px 0 0', color: '#4b5563' }}>Orçamento: {doc.titulo}</p>}
        </div>
        <p style={{ margin: 0, color: '#4b5563' }}>Data: {fmtData(doc.data)}</p>
      </div>

      {/* Itens */}
      {doc.itens.length === 0 && (
        <p style={{ textAlign: 'center', color: '#9ca3af', padding: '24px 0' }}>Nenhum item</p>
      )}
      {doc.itens.map((it, idx) => {
        const { linhas, custo } = linhasDoItem(it);
        const precoItem = Number(it.total);
        const lucroItem = precoItem - custo;
        const margemItem = precoItem > 0 ? (lucroItem / precoItem) * 100 : 0;
        const d = it.detalhe_placa;
        return (
          <div key={it.id ?? idx} style={{ marginBottom: 18, breakInside: 'avoid', pageBreakInside: 'avoid' }}>
            <div style={{ background: '#f3f4f6', padding: '7px 10px', borderRadius: '6px 6px 0 0' }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 800 }}>
                Item {idx + 1} — {it.descricao}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 10, color: '#6b7280' }}>
                {d
                  ? `Placa ${fmtNum(d.largura)} × ${fmtNum(d.altura)} m · qtd ${fmtNum(d.quantidade)} · área ${fmtNum(d.area_total_m2)} m² · perímetro ${fmtNum(d.perimetro_m)} m`
                  : `Quantidade ${fmtNum(Number(it.quantidade))}`}
              </p>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Categoria</th>
                  <th style={th}>Detalhe do cálculo</th>
                  <th style={thR}>Custo</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l, i) => (
                  <tr key={i} style={l.destaque ? { background: '#f9fafb' } : undefined}>
                    <td style={{ ...td, fontWeight: l.destaque ? 800 : 600, whiteSpace: 'nowrap' }}>{l.categoria}</td>
                    <td style={{ ...td, color: '#4b5563' }}>{l.detalhe}</td>
                    <td style={{ ...tdR, fontWeight: l.destaque ? 800 : 400 }}>{fmtBRL(l.valor)}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={2} style={{ ...td, fontWeight: 800, background: '#fef2f2', color: ALERTA }}>
                    Custo total do item
                  </td>
                  <td style={{ ...tdR, fontWeight: 800, background: '#fef2f2', color: ALERTA }}>{fmtBRL(custo)}</td>
                </tr>
                <tr>
                  <td colSpan={2} style={{ ...td, fontWeight: 700 }}>Preço de venda do item</td>
                  <td style={{ ...tdR, fontWeight: 700 }}>{fmtBRL(precoItem)}</td>
                </tr>
                <tr>
                  <td colSpan={2} style={{ ...td, fontWeight: 700, color: lucroItem >= 0 ? '#15803d' : ALERTA }}>
                    Lucro do item (margem {fmtPct(margemItem)})
                  </td>
                  <td style={{ ...tdR, fontWeight: 700, color: lucroItem >= 0 ? '#15803d' : ALERTA }}>{fmtBRL(lucroItem)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        );
      })}

      {/* Custo × preço por item */}
      {doc.itens.length > 1 && (
        <div style={{ breakInside: 'avoid', pageBreakInside: 'avoid', marginBottom: 18 }}>
          <p style={{ fontSize: 13, fontWeight: 900, margin: '0 0 6px', borderBottom: `2px solid ${COR}`, paddingBottom: 4 }}>
            Custo × preço por item
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Item</th>
                <th style={thR}>Custo</th>
                <th style={thR}>Preço</th>
                <th style={thR}>Lucro</th>
                <th style={thR}>Margem</th>
              </tr>
            </thead>
            <tbody>
              {doc.itens.map((it, idx) => {
                const { custo } = linhasDoItem(it);
                const preco = Number(it.total);
                const l = preco - custo;
                return (
                  <tr key={it.id ?? idx}>
                    <td style={td}>{idx + 1}. {it.descricao}</td>
                    <td style={tdR}>{fmtBRL(custo)}</td>
                    <td style={tdR}>{fmtBRL(preco)}</td>
                    <td style={{ ...tdR, color: l >= 0 ? '#15803d' : ALERTA }}>{fmtBRL(l)}</td>
                    <td style={tdR}>{fmtPct(preco > 0 ? (l / preco) * 100 : 0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Resumo geral */}
      <div style={{ breakInside: 'avoid', pageBreakInside: 'avoid', marginTop: 8 }}>
        <p style={{ fontSize: 13, fontWeight: 900, margin: '0 0 6px', borderBottom: `2px solid ${COR}`, paddingBottom: 4 }}>
          Resumo geral de custos
        </p>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Categoria</th>
              <th style={th}>Detalhe</th>
              <th style={thR}>Custo</th>
              <th style={thR}>% do custo</th>
            </tr>
          </thead>
          <tbody>
            {resumo.material > 0 && (
              <tr>
                <td style={{ ...td, fontWeight: 600 }}>Material / impressão</td>
                <td style={td}></td>
                <td style={tdR}>{fmtBRL(resumo.material)}</td>
                <td style={tdR}>{pct(resumo.material)}</td>
              </tr>
            )}
            {resumo.estrutura > 0 && (
              <>
                <tr>
                  <td style={{ ...td, fontWeight: 600 }}>Estrutura — metalon</td>
                  <td style={td}></td>
                  <td style={tdR}>{fmtBRL(estruturaMetalon)}</td>
                  <td style={tdR}>{pct(estruturaMetalon)}</td>
                </tr>
                <tr>
                  <td style={{ ...td, fontWeight: 600 }}>Estrutura — mão de obra</td>
                  <td style={td}></td>
                  <td style={tdR}>{fmtBRL(estruturaMaoObra)}</td>
                  <td style={tdR}>{pct(estruturaMaoObra)}</td>
                </tr>
              </>
            )}
            {Array.from(acabPorNome.entries()).map(([nome, a]) => (
              <tr key={nome}>
                <td style={{ ...td, fontWeight: 600 }}>Acabamento</td>
                <td style={{ ...td, color: '#4b5563' }}>{nome} · {fmtNum(a.qtd)} {a.un} no total</td>
                <td style={tdR}>{fmtBRL(a.custo)}</td>
                <td style={tdR}>{pct(a.custo)}</td>
              </tr>
            ))}
            {acabPorNome.size > 1 && (
              <tr style={{ background: '#f9fafb' }}>
                <td style={{ ...td, fontWeight: 800 }}>Subtotal acabamentos</td>
                <td style={td}></td>
                <td style={{ ...tdR, fontWeight: 800 }}>{fmtBRL(resumo.acabamentos)}</td>
                <td style={{ ...tdR, fontWeight: 800 }}>{pct(resumo.acabamentos)}</td>
              </tr>
            )}
            {resumo.instalacao > 0 && (
              <tr>
                <td style={{ ...td, fontWeight: 600 }}>Instalação</td>
                <td style={td}></td>
                <td style={tdR}>{fmtBRL(resumo.instalacao)}</td>
                <td style={tdR}>{pct(resumo.instalacao)}</td>
              </tr>
            )}
            {resumo.outros > 0 && (
              <tr>
                <td style={{ ...td, fontWeight: 600 }}>Outros itens</td>
                <td style={{ ...td, color: '#4b5563' }}>m² / folha / produto avulso</td>
                <td style={tdR}>{fmtBRL(resumo.outros)}</td>
                <td style={tdR}>{pct(resumo.outros)}</td>
              </tr>
            )}
            <tr>
              <td colSpan={2} style={{ ...td, fontSize: 13, fontWeight: 900, background: '#fef2f2', color: ALERTA }}>
                TOTAL DE CUSTOS
              </td>
              <td style={{ ...tdR, fontSize: 13, fontWeight: 900, background: '#fef2f2', color: ALERTA }}>{fmtBRL(resumo.total)}</td>
              <td style={{ ...tdR, background: '#fef2f2', color: ALERTA, fontWeight: 700 }}>{resumo.total > 0 ? '100,0%' : '—'}</td>
            </tr>
          </tbody>
        </table>

        {/* Preço × custo */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 14 }}>
          <tbody>
            <tr>
              <td style={td}>Subtotal de venda (soma dos itens)</td>
              <td style={tdR}>{fmtBRL(subtotal)}</td>
            </tr>
            {doc.descontoPct > 0 && (
              <tr>
                <td style={td}>Desconto ({fmtNum(doc.descontoPct, 1)}%)</td>
                <td style={{ ...tdR, color: ALERTA }}>− {fmtBRL(desconto)}</td>
              </tr>
            )}
            <tr>
              <td style={{ ...td, fontWeight: 800, fontSize: 13 }}>Total cobrado do cliente</td>
              <td style={{ ...tdR, fontWeight: 800, fontSize: 13 }}>{fmtBRL(totalFinal)}</td>
            </tr>
            <tr>
              <td style={{ ...td, fontWeight: 700, color: ALERTA }}>(−) Total de custos</td>
              <td style={{ ...tdR, fontWeight: 700, color: ALERTA }}>− {fmtBRL(resumo.total)}</td>
            </tr>
            <tr>
              <td style={{ ...td, fontWeight: 900, fontSize: 13, color: lucro >= 0 ? '#15803d' : ALERTA, background: '#f0fdf4' }}>
                Lucro bruto (margem {fmtPct(margem)})
              </td>
              <td style={{ ...tdR, fontWeight: 900, fontSize: 13, color: lucro >= 0 ? '#15803d' : ALERTA, background: '#f0fdf4' }}>
                {fmtBRL(lucro)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {doc.observacoes && (
        <p style={{ fontSize: 11, color: '#4b5563', marginTop: 16, whiteSpace: 'pre-line' }}>
          <strong>Observações:</strong> {doc.observacoes}
        </p>
      )}
    </div>
  );
}
