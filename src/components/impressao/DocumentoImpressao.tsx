// src/components/impressao/DocumentoImpressao.tsx
//
// Template visual do documento impresso (Venda ou Orçamento).
// Usado em dois lugares:
//   1) Na pré-visualização ao vivo do editor de layout (Configurações → Impressão)
//   2) Na janela de impressão real (ver imprimirDocumento.tsx)
//
// IMPORTANTE: este componente usa apenas estilos inline (style={...}),
// nunca classes Tailwind. Isso é proposital — quando o documento é
// renderizado dentro da janela de impressão (um documento HTML novo,
// em branco, sem o CSS compilado do app), classes Tailwind não teriam
// nenhum efeito e o documento sairia sem estilo nenhum. Com estilo
// inline, o visual é sempre idêntico, em qualquer contexto.

import type { CSSProperties } from 'react';
import { LayoutImpressaoConfig } from '../../types/layoutImpressao';
import type { Configuracoes } from '../../types/configuracoes';

export interface ItemDocumentoImpressao {
  descricao: string;
  quantidade: number;
  unidade?: string | null;
  precoUnitario: number;
  /** percentual (0-100), ou null/undefined quando não se aplica */
  desconto?: number | null;
  total: number;
}

export interface DocumentoImpressaoData {
  tipo: 'venda' | 'orcamento';
  numero?: number | null;
  /** data de emissão (YYYY-MM-DD ou ISO completo) */
  data?: string | null;
  /** apenas Venda */
  dataEntrega?: string | null;
  clienteNome: string;
  itens: ItemDocumentoImpressao[];
  subtotal: number;
  descontoGlobalPct?: number | null;
  total: number;
  observacoes?: string | null;
}

const fmtBRL = (v: number) =>
  Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtData = (d?: string | null) => {
  if (!d) return '—';
  const iso = d.length === 10 ? `${d}T00:00:00` : d;
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return '—';
  return data.toLocaleDateString('pt-BR');
};

interface DocumentoImpressaoProps {
  layout: LayoutImpressaoConfig;
  empresa: Partial<Configuracoes>;
  documento: DocumentoImpressaoData;
  /** Estilos extras aplicados na página (ex: sombra na pré-visualização) */
  style?: CSSProperties;
}

export function DocumentoImpressao({ layout, empresa, documento: doc, style }: DocumentoImpressaoProps) {
  const cor = layout.corDestaque || '#3b82f6';
  const isOrcamento = doc.tipo === 'orcamento';
  const descontoGlobal = Number(doc.descontoGlobalPct ?? 0);

  const colSpanItens =
    1 +
    (layout.colunasItens.quantidade ? 1 : 0) +
    (layout.colunasItens.unidade ? 1 : 0) +
    (layout.colunasItens.precoUnitario ? 1 : 0) +
    (layout.colunasItens.desconto ? 1 : 0) +
    1;

  const labelStyle: CSSProperties = {
    fontSize: 10, fontWeight: 700, color: '#6b7280',
    textTransform: 'uppercase', margin: '0 0 4px',
  };

  return (
    <div
      style={{
        background: '#ffffff',
        color: '#111827',
        padding: 32,
        width: '210mm',
        minHeight: '297mm',
        margin: '0 auto',
        fontFamily: 'Arial, Helvetica, sans-serif',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: `2px solid ${cor}`, paddingBottom: 16, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {layout.mostrarLogo && empresa.empresa_logo_url && (
            <img src={empresa.empresa_logo_url} alt="Logo" style={{ height: 56, width: 'auto', objectFit: 'contain' }} />
          )}
          {layout.mostrarDadosEmpresa && (
            <div>
              <p style={{ fontSize: 18, fontWeight: 900, margin: 0, lineHeight: 1.2 }}>{empresa.empresa_nome || 'Sua Empresa'}</p>
              {layout.mostrarCnpj && empresa.empresa_cnpj && (
                <p style={{ fontSize: 12, color: '#4b5563', margin: '2px 0 0' }}>CNPJ: {empresa.empresa_cnpj}</p>
              )}
              {layout.mostrarEndereco && empresa.empresa_endereco && (
                <p style={{ fontSize: 12, color: '#4b5563', margin: '2px 0 0' }}>{empresa.empresa_endereco}</p>
              )}
              {layout.mostrarContato && (empresa.empresa_telefone || empresa.empresa_email) && (
                <p style={{ fontSize: 12, color: '#4b5563', margin: '2px 0 0' }}>
                  {[empresa.empresa_telefone, empresa.empresa_email].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <p style={{ fontSize: 20, fontWeight: 900, color: cor, margin: 0 }}>{layout.tituloDocumento}</p>
          {layout.mostrarNumeroDocumento && (
            <p style={{ fontSize: 14, color: '#4b5563', margin: '2px 0 0' }}>{doc.numero ? `Nº ${doc.numero}` : 'Nº —'}</p>
          )}
          <p style={{ fontSize: 12, color: '#6b7280', margin: '2px 0 0' }}>{fmtData(doc.data)}</p>
        </div>
      </div>

      {layout.textoCabecalhoExtra && (
        <p style={{ fontSize: 12, color: '#4b5563', marginBottom: 16, fontStyle: 'italic' }}>{layout.textoCabecalhoExtra}</p>
      )}

      {/* Cliente */}
      <div style={{ marginBottom: 20 }}>
        <p style={labelStyle}>Cliente</p>
        <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>{doc.clienteNome || '—'}</p>
        {doc.dataEntrega && (
          <p style={{ fontSize: 12, color: '#4b5563', margin: '2px 0 0' }}>Entrega prevista: {fmtData(doc.dataEntrega)}</p>
        )}
        {isOrcamento && layout.mostrarValidade && empresa.orc_validade_dias && (
          <p style={{ fontSize: 12, color: '#4b5563', margin: '2px 0 0' }}>Validade da proposta: {empresa.orc_validade_dias} dia(s)</p>
        )}
      </div>

      {/* Itens */}
      <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', marginBottom: 16 }}>
        <thead>
          <tr style={{ backgroundColor: cor + '15' }}>
            <th style={{ textAlign: 'left', padding: 8, borderBottom: `1px solid ${cor}` }}>Descrição</th>
            {layout.colunasItens.quantidade && <th style={{ textAlign: 'right', padding: 8, borderBottom: `1px solid ${cor}` }}>Qtd.</th>}
            {layout.colunasItens.unidade && <th style={{ textAlign: 'center', padding: 8, borderBottom: `1px solid ${cor}` }}>Un.</th>}
            {layout.colunasItens.precoUnitario && <th style={{ textAlign: 'right', padding: 8, borderBottom: `1px solid ${cor}` }}>Preço Unit.</th>}
            {layout.colunasItens.desconto && <th style={{ textAlign: 'right', padding: 8, borderBottom: `1px solid ${cor}` }}>Desc.</th>}
            <th style={{ textAlign: 'right', padding: 8, borderBottom: `1px solid ${cor}` }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {doc.itens.length === 0 && (
            <tr><td colSpan={colSpanItens} style={{ textAlign: 'center', color: '#9ca3af', padding: '24px 0' }}>Nenhum item</td></tr>
          )}
          {doc.itens.map((it, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td style={{ padding: 8 }}>{it.descricao}</td>
              {layout.colunasItens.quantidade && <td style={{ padding: 8, textAlign: 'right' }}>{it.quantidade}</td>}
              {layout.colunasItens.unidade && <td style={{ padding: 8, textAlign: 'center' }}>{it.unidade || 'un'}</td>}
              {layout.colunasItens.precoUnitario && <td style={{ padding: 8, textAlign: 'right' }}>{fmtBRL(it.precoUnitario)}</td>}
              {layout.colunasItens.desconto && (
                <td style={{ padding: 8, textAlign: 'right' }}>{it.desconto ? `${it.desconto}%` : '—'}</td>
              )}
              <td style={{ padding: 8, textAlign: 'right', fontWeight: 700 }}>{fmtBRL(it.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totais */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
        <div style={{ width: 224, fontSize: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ color: '#4b5563' }}>Subtotal</span>
            <span>{fmtBRL(doc.subtotal)}</span>
          </div>
          {descontoGlobal > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626', marginBottom: 4 }}>
              <span>Desconto ({descontoGlobal}%)</span>
              <span>-{fmtBRL((doc.subtotal * descontoGlobal) / 100)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: 16, paddingTop: 4, borderTop: `1px solid ${cor}` }}>
            <span>Total</span>
            <span style={{ color: cor }}>{fmtBRL(doc.total)}</span>
          </div>
        </div>
      </div>

      {/* Observações */}
      {layout.mostrarObservacoes && doc.observacoes && (
        <div style={{ marginBottom: 20 }}>
          <p style={labelStyle}>Observações</p>
          <p style={{ fontSize: 12, color: '#374151', whiteSpace: 'pre-wrap', margin: 0 }}>{doc.observacoes}</p>
        </div>
      )}

      {/* Garantia (apenas orçamento) */}
      {isOrcamento && layout.mostrarGarantia && empresa.orc_garantia && (
        <div style={{ marginBottom: 20 }}>
          <p style={labelStyle}>Garantia</p>
          <p style={{ fontSize: 12, color: '#374151', whiteSpace: 'pre-wrap', margin: 0 }}>{empresa.orc_garantia}</p>
        </div>
      )}

      {/* Assinatura */}
      {layout.mostrarAssinatura && (
        <div style={{ marginTop: 48, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, fontSize: 12, color: '#4b5563' }}>
          <div style={{ borderTop: '1px solid #9ca3af', paddingTop: 8, textAlign: 'center' }}>Assinatura do Cliente</div>
          <div style={{ borderTop: '1px solid #9ca3af', paddingTop: 8, textAlign: 'center' }}>{empresa.empresa_nome || 'Empresa'}</div>
        </div>
      )}

      {/* Rodapé */}
      <div style={{ marginTop: 40, paddingTop: 12, borderTop: `1px solid ${cor}`, fontSize: 10, color: '#6b7280', textAlign: 'center' }}>
        {layout.textoRodape || (isOrcamento ? empresa.orc_rodape : empresa.empresa_rodape) || ''}
      </div>
    </div>
  );
}
