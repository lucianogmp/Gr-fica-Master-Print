// src/components/impressao/DocumentoImpressao.tsx
//
// Template visual do documento impresso (Venda ou Orçamento).
// É usado em dois lugares:
//   1) Na pré-visualização ao vivo do editor de layout (Configurações → Impressão)
//   2) Na impressão real da Venda/Orçamento (window.print())
//
// Sempre renderizado em "papel branco" (fundo claro, texto escuro),
// independente do tema escuro do resto do sistema — é o documento
// que o cliente vai receber.

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
  className?: string;
}

export function DocumentoImpressao({ layout, empresa, documento: doc, className = '' }: DocumentoImpressaoProps) {
  const cor = layout.corDestaque || '#3b82f6';
  const isOrcamento = doc.tipo === 'orcamento';
  const descontoGlobal = Number(doc.descontoGlobalPct ?? 0);
  const colSpanItens =
    1 + // descrição
    (layout.colunasItens.quantidade ? 1 : 0) +
    (layout.colunasItens.unidade ? 1 : 0) +
    (layout.colunasItens.precoUnitario ? 1 : 0) +
    (layout.colunasItens.desconto ? 1 : 0) +
    1; // total

  return (
    <div
      className={`bg-white text-gray-900 p-8 w-[210mm] min-h-[297mm] mx-auto shadow-xl ${className}`}
      style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
    >
      {/* Cabeçalho */}
      <div className="flex justify-between items-start border-b-2 pb-4 mb-6" style={{ borderColor: cor }}>
        <div className="flex items-center gap-3">
          {layout.mostrarLogo && empresa.empresa_logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={empresa.empresa_logo_url} alt="Logo" className="h-14 w-auto object-contain" />
          )}
          {layout.mostrarDadosEmpresa && (
            <div>
              <p className="text-lg font-black leading-tight">{empresa.empresa_nome || 'Sua Empresa'}</p>
              {layout.mostrarCnpj && empresa.empresa_cnpj && (
                <p className="text-xs text-gray-600">CNPJ: {empresa.empresa_cnpj}</p>
              )}
              {layout.mostrarEndereco && empresa.empresa_endereco && (
                <p className="text-xs text-gray-600">{empresa.empresa_endereco}</p>
              )}
              {layout.mostrarContato && (empresa.empresa_telefone || empresa.empresa_email) && (
                <p className="text-xs text-gray-600">
                  {[empresa.empresa_telefone, empresa.empresa_email].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xl font-black" style={{ color: cor }}>{layout.tituloDocumento}</p>
          {layout.mostrarNumeroDocumento && (
            <p className="text-sm text-gray-600">{doc.numero ? `Nº ${doc.numero}` : 'Nº —'}</p>
          )}
          <p className="text-xs text-gray-500">{fmtData(doc.data)}</p>
        </div>
      </div>

      {layout.textoCabecalhoExtra && (
        <p className="text-xs text-gray-600 mb-4 italic">{layout.textoCabecalhoExtra}</p>
      )}

      {/* Cliente */}
      <div className="mb-5">
        <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Cliente</p>
        <p className="text-sm font-bold">{doc.clienteNome || '—'}</p>
        {doc.dataEntrega && (
          <p className="text-xs text-gray-600">Entrega prevista: {fmtData(doc.dataEntrega)}</p>
        )}
        {isOrcamento && layout.mostrarValidade && empresa.orc_validade_dias && (
          <p className="text-xs text-gray-600">Validade da proposta: {empresa.orc_validade_dias} dia(s)</p>
        )}
      </div>

      {/* Itens */}
      <table className="w-full text-xs border-collapse mb-4">
        <thead>
          <tr style={{ backgroundColor: cor + '15' }}>
            <th className="text-left p-2 border-b" style={{ borderColor: cor }}>Descrição</th>
            {layout.colunasItens.quantidade && (
              <th className="text-right p-2 border-b" style={{ borderColor: cor }}>Qtd.</th>
            )}
            {layout.colunasItens.unidade && (
              <th className="text-center p-2 border-b" style={{ borderColor: cor }}>Un.</th>
            )}
            {layout.colunasItens.precoUnitario && (
              <th className="text-right p-2 border-b" style={{ borderColor: cor }}>Preço Unit.</th>
            )}
            {layout.colunasItens.desconto && (
              <th className="text-right p-2 border-b" style={{ borderColor: cor }}>Desc.</th>
            )}
            <th className="text-right p-2 border-b" style={{ borderColor: cor }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {doc.itens.length === 0 && (
            <tr><td colSpan={colSpanItens} className="text-center text-gray-400 py-6">Nenhum item</td></tr>
          )}
          {doc.itens.map((it, i) => (
            <tr key={i} className="border-b border-gray-200">
              <td className="p-2">{it.descricao}</td>
              {layout.colunasItens.quantidade && <td className="p-2 text-right">{it.quantidade}</td>}
              {layout.colunasItens.unidade && <td className="p-2 text-center">{it.unidade || 'un'}</td>}
              {layout.colunasItens.precoUnitario && <td className="p-2 text-right">{fmtBRL(it.precoUnitario)}</td>}
              {layout.colunasItens.desconto && (
                <td className="p-2 text-right">{it.desconto ? `${it.desconto}%` : '—'}</td>
              )}
              <td className="p-2 text-right font-bold">{fmtBRL(it.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totais */}
      <div className="flex justify-end mb-6">
        <div className="w-56 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Subtotal</span>
            <span>{fmtBRL(doc.subtotal)}</span>
          </div>
          {descontoGlobal > 0 && (
            <div className="flex justify-between text-red-600">
              <span>Desconto ({descontoGlobal}%)</span>
              <span>-{fmtBRL((doc.subtotal * descontoGlobal) / 100)}</span>
            </div>
          )}
          <div className="flex justify-between font-black text-base pt-1 border-t" style={{ borderColor: cor }}>
            <span>Total</span>
            <span style={{ color: cor }}>{fmtBRL(doc.total)}</span>
          </div>
        </div>
      </div>

      {/* Observações */}
      {layout.mostrarObservacoes && doc.observacoes && (
        <div className="mb-5">
          <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Observações</p>
          <p className="text-xs text-gray-700 whitespace-pre-wrap">{doc.observacoes}</p>
        </div>
      )}

      {/* Garantia (apenas orçamento) */}
      {isOrcamento && layout.mostrarGarantia && empresa.orc_garantia && (
        <div className="mb-5">
          <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Garantia</p>
          <p className="text-xs text-gray-700 whitespace-pre-wrap">{empresa.orc_garantia}</p>
        </div>
      )}

      {/* Assinatura */}
      {layout.mostrarAssinatura && (
        <div className="mt-12 grid grid-cols-2 gap-8 text-xs text-gray-600">
          <div className="border-t border-gray-400 pt-2 text-center">Assinatura do Cliente</div>
          <div className="border-t border-gray-400 pt-2 text-center">{empresa.empresa_nome || 'Empresa'}</div>
        </div>
      )}

      {/* Rodapé */}
      <div className="mt-10 pt-3 border-t text-[10px] text-gray-500 text-center" style={{ borderColor: cor }}>
        {layout.textoRodape || (isOrcamento ? empresa.orc_rodape : empresa.empresa_rodape) || ''}
      </div>
    </div>
  );
}
