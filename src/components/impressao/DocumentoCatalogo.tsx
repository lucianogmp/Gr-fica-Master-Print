// src/components/impressao/DocumentoCatalogo.tsx
//
// Template visual do Catálogo de Produtos impresso.
// Usado em dois lugares:
//   1) Na pré-visualização ao vivo do editor de layout (Configurações → Impressão → Catálogo)
//   2) Na janela de impressão real (ver imprimirCatalogo.tsx)
//
// IMPORTANTE: assim como DocumentoImpressao.tsx, usa apenas estilos inline
// (style={...}), nunca classes Tailwind — o documento é renderizado dentro
// de uma janela de impressão em branco, sem o CSS compilado do app.

import type { CSSProperties } from 'react';
import { LayoutCatalogoConfig } from '../../types/layoutImpressao';
import type { Configuracoes } from '../../types/configuracoes';

export interface ItemCatalogo {
  nome: string;
  sku?: string | null;
  descricao?: string | null;
  unidade: 'unidade' | 'm2';
  precoVenda: number;
  categoriaNome?: string | null;
}

export interface DocumentoCatalogoData {
  itens: ItemCatalogo[];
}

const fmtBRL = (v: number) =>
  Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface DocumentoCatalogoProps {
  layout: LayoutCatalogoConfig;
  empresa: Partial<Configuracoes>;
  documento: DocumentoCatalogoData;
  /** Estilos extras aplicados na página (ex: sombra na pré-visualização) */
  style?: CSSProperties;
}

const SEM_CATEGORIA = 'Outros';

function agrupar(itens: ItemCatalogo[]): Map<string, ItemCatalogo[]> {
  const grupos = new Map<string, ItemCatalogo[]>();
  for (const item of itens) {
    const chave = item.categoriaNome?.trim() || SEM_CATEGORIA;
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave)!.push(item);
  }
  return grupos;
}

export function DocumentoCatalogo({ layout, empresa, documento: doc, style }: DocumentoCatalogoProps) {
  const cor = layout.corDestaque || '#3b82f6';

  const labelStyle: CSSProperties = {
    fontSize: 10, fontWeight: 700, color: '#6b7280',
    textTransform: 'uppercase', margin: '0 0 4px',
  };

  const grupos = layout.agruparPorCategoria
    ? agrupar(doc.itens)
    : new Map<string, ItemCatalogo[]>([['Produtos', doc.itens]]);

  function TabelaItens({ itens }: { itens: ItemCatalogo[] }) {
    return (
      <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', marginBottom: 20 }}>
        <thead>
          <tr style={{ backgroundColor: cor + '15' }}>
            <th style={{ textAlign: 'left', padding: 8, borderBottom: `1px solid ${cor}` }}>Produto</th>
            {layout.mostrarSku && <th style={{ textAlign: 'left', padding: 8, borderBottom: `1px solid ${cor}` }}>SKU</th>}
            {layout.mostrarUnidade && <th style={{ textAlign: 'center', padding: 8, borderBottom: `1px solid ${cor}` }}>Un.</th>}
            <th style={{ textAlign: 'right', padding: 8, borderBottom: `1px solid ${cor}` }}>Preço</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((it, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td style={{ padding: 8 }}>
                <span style={{ fontWeight: 700 }}>{it.nome}</span>
                {layout.mostrarDescricao && it.descricao && (
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{it.descricao}</div>
                )}
              </td>
              {layout.mostrarSku && <td style={{ padding: 8, color: '#6b7280', fontFamily: 'monospace', fontSize: 11 }}>{it.sku || '—'}</td>}
              {layout.mostrarUnidade && (
                <td style={{ padding: 8, textAlign: 'center' }}>{it.unidade === 'm2' ? 'm²' : 'un'}</td>
              )}
              <td style={{ padding: 8, textAlign: 'right', fontWeight: 700 }}>
                {fmtBRL(it.precoVenda)}
                {it.unidade === 'm2' && <span style={{ fontSize: 10, color: '#6b7280', fontWeight: 400 }}>/m²</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <div
      style={{
        background: '#ffffff',
        color: '#111827',
        padding: 32,
        paddingBottom: 88,
        width: '210mm',
        minHeight: '297mm',
        margin: '0 auto',
        fontFamily: 'Arial, Helvetica, sans-serif',
        boxSizing: 'border-box',
        position: 'relative',
        ...style,
      }}
    >
      {/* Cabeçalho */}
      <div style={{ position: 'relative', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 16 }}>
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
                {layout.mostrarContato && (empresa.empresa_telefone || empresa.empresa_email) && (
                  <p style={{ fontSize: 12, color: '#4b5563', margin: '2px 0 0' }}>
                    {[empresa.empresa_telefone, empresa.empresa_email].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
            )}
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0, position: 'relative', paddingRight: 8 }}>
            <p style={{ fontSize: 22, fontWeight: 900, color: cor, margin: 0, letterSpacing: 0.5 }}>{layout.tituloDocumento}</p>
          </div>
        </div>

        {/* Divisor diagonal — mesmo visual dos outros documentos impressos */}
        <svg
          viewBox="0 0 800 24"
          preserveAspectRatio="none"
          style={{ width: '100%', height: 24, display: 'block' }}
        >
          <polyline points="0,4 620,4 700,22" fill="none" stroke={cor} strokeWidth={2} />
          <polyline points="700,22 800,0 800,24 720,24" fill="#1f2937" opacity={0.85} />
        </svg>
      </div>

      {layout.textoCabecalhoExtra && (
        <p style={{ fontSize: 12, color: '#4b5563', marginBottom: 16, fontStyle: 'italic' }}>{layout.textoCabecalhoExtra}</p>
      )}

      {doc.itens.length === 0 && (
        <p style={{ textAlign: 'center', color: '#9ca3af', padding: '24px 0' }}>Nenhum produto ativo.</p>
      )}

      {Array.from(grupos.entries()).map(([categoria, itens]) => (
        <div key={categoria} style={{ marginBottom: 8 }}>
          {layout.agruparPorCategoria && (
            <p style={{ ...labelStyle, display: 'inline-block', backgroundColor: cor + '15', padding: '3px 10px', borderRadius: 4, marginBottom: 8 }}>
              {categoria}
            </p>
          )}
          <TabelaItens itens={itens} />
        </div>
      ))}

      {/* Rodapé — mesmo padrão visual de DocumentoImpressao.tsx */}
      <div style={{ position: 'fixed', left: 32, right: 32, bottom: 24 }}>
        <div style={{ position: 'relative', height: 32, display: 'flex', alignItems: 'center' }}>
          <div
            style={{
              position: 'absolute', inset: 0,
              backgroundColor: '#374151',
              display: 'flex', alignItems: 'center',
              paddingLeft: 16,
            }}
          >
            <span style={{ fontSize: 11, color: '#e5e7eb' }}>
              {layout.textoRodape || empresa.empresa_rodape || ''}
            </span>
          </div>
          <svg
            viewBox="0 0 120 32"
            preserveAspectRatio="none"
            style={{ position: 'absolute', right: 0, top: 0, height: '100%', width: 120 }}
          >
            <polygon points="40,0 120,0 120,32 0,32" fill={cor} />
          </svg>
        </div>
      </div>
    </div>
  );
}
