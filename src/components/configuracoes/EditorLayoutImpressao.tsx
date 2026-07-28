// src/components/configuracoes/EditorLayoutImpressao.tsx
//
// Editor visual (formulário + preview em tempo real) do layout de impressão
// de Venda ou Orçamento. Usado dentro da aba "Impressão" em Configurações.
//
// O preview usa dados de exemplo (mockDocumento) — não busca uma venda ou
// orçamento real, é só para visualizar o efeito das opções enquanto edita.

import { LayoutImpressaoConfig } from '../../types/layoutImpressao';
import type { Configuracoes } from '../../types/configuracoes';
import { DocumentoImpressao, DocumentoImpressaoData } from '../impressao/DocumentoImpressao';

const IN = "w-full bg-[#111827] border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors";
const CHECK = "flex items-center gap-2 text-sm text-gray-300 cursor-pointer py-0.5";
const CHECKBOX = "w-4 h-4 accent-blue-600";

function mockDocumento(tipo: 'venda' | 'orcamento'): DocumentoImpressaoData {
  return {
    tipo,
    numero: 1042,
    data: new Date().toISOString().slice(0, 10),
    dataEntrega: tipo === 'venda' ? new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10) : null,
    clienteNome: 'Cliente Exemplo Ltda',
    itens: [
      { descricao: 'Banner Lona 2x1m', quantidade: 2, unidade: 'un', precoUnitario: 120, desconto: 0, total: 240 },
      { descricao: 'Cartão de Visita 300g', quantidade: 500, unidade: 'un', precoUnitario: 0.35, desconto: 5, total: 166.25 },
    ],
    subtotal: 406.25,
    descontoGlobalPct: 0,
    total: 406.25,
    observacoes: 'Pagamento 50% na aprovação, 50% na entrega.',
  };
}

interface EditorLayoutImpressaoProps {
  tipo: 'venda' | 'orcamento';
  value: LayoutImpressaoConfig;
  onChange: (v: LayoutImpressaoConfig) => void;
  empresa: Partial<Configuracoes>;
}

export function EditorLayoutImpressao({ tipo, value, onChange, empresa }: EditorLayoutImpressaoProps) {
  function set<K extends keyof LayoutImpressaoConfig>(field: K, v: LayoutImpressaoConfig[K]) {
    onChange({ ...value, [field]: v });
  }
  function setColuna(field: keyof LayoutImpressaoConfig['colunasItens'], v: boolean) {
    onChange({ ...value, colunasItens: { ...value.colunasItens, [field]: v } });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Formulário */}
      <div className="space-y-3">
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Título do documento</label>
          <input value={value.tituloDocumento} onChange={e => set('tituloDocumento', e.target.value)} className={IN} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Cor de destaque</label>
            <div className="flex gap-2">
              <input value={value.corDestaque} onChange={e => set('corDestaque', e.target.value)} className={IN} placeholder="#3b82f6" />
              <div className="w-10 h-10 rounded-lg border border-gray-700 flex-shrink-0" style={{ backgroundColor: value.corDestaque }} />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Texto extra no cabeçalho</label>
            <input value={value.textoCabecalhoExtra} onChange={e => set('textoCabecalhoExtra', e.target.value)} className={IN} placeholder="Opcional" />
          </div>
        </div>

        <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-3">
          <p className="text-[10px] font-bold text-gray-500 uppercase mb-2">Exibir no documento</p>

          <div className="grid grid-cols-2 gap-x-3">
            <label className={CHECK}>
              <input type="checkbox" checked={value.mostrarLogo} onChange={e => set('mostrarLogo', e.target.checked)} className={CHECKBOX} />
              Logo da empresa
            </label>
            <label className={CHECK}>
              <input type="checkbox" checked={value.mostrarNumeroDocumento} onChange={e => set('mostrarNumeroDocumento', e.target.checked)} className={CHECKBOX} />
              Número do documento
            </label>
            <label className={CHECK}>
              <input type="checkbox" checked={value.mostrarDadosEmpresa} onChange={e => set('mostrarDadosEmpresa', e.target.checked)} className={CHECKBOX} />
              Dados da empresa
            </label>
            <label className={CHECK}>
              <input type="checkbox" checked={value.mostrarCnpj} onChange={e => set('mostrarCnpj', e.target.checked)} className={CHECKBOX} />
              CNPJ
            </label>
            <label className={CHECK}>
              <input type="checkbox" checked={value.mostrarEndereco} onChange={e => set('mostrarEndereco', e.target.checked)} className={CHECKBOX} />
              Endereço
            </label>
            <label className={CHECK}>
              <input type="checkbox" checked={value.mostrarContato} onChange={e => set('mostrarContato', e.target.checked)} className={CHECKBOX} />
              Telefone / e-mail
            </label>
            <label className={CHECK}>
              <input type="checkbox" checked={value.mostrarObservacoes} onChange={e => set('mostrarObservacoes', e.target.checked)} className={CHECKBOX} />
              Observações
            </label>
            {tipo === 'orcamento' && (
              <>
                <label className={CHECK}>
                  <input type="checkbox" checked={value.mostrarValidade} onChange={e => set('mostrarValidade', e.target.checked)} className={CHECKBOX} />
                  Validade da proposta
                </label>
                <label className={CHECK}>
                  <input type="checkbox" checked={value.mostrarGarantia} onChange={e => set('mostrarGarantia', e.target.checked)} className={CHECKBOX} />
                  Texto de garantia
                </label>
              </>
            )}
            <label className={CHECK}>
              <input type="checkbox" checked={value.mostrarAssinatura} onChange={e => set('mostrarAssinatura', e.target.checked)} className={CHECKBOX} />
              Linha de assinatura
            </label>
          </div>
        </div>

        <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-3">
          <p className="text-[10px] font-bold text-gray-500 uppercase mb-2">Colunas da tabela de itens</p>
          <div className="grid grid-cols-2 gap-x-3">
            <label className={CHECK}>
              <input type="checkbox" checked={value.colunasItens.quantidade} onChange={e => setColuna('quantidade', e.target.checked)} className={CHECKBOX} />
              Quantidade
            </label>
            <label className={CHECK}>
              <input type="checkbox" checked={value.colunasItens.unidade} onChange={e => setColuna('unidade', e.target.checked)} className={CHECKBOX} />
              Unidade
            </label>
            <label className={CHECK}>
              <input type="checkbox" checked={value.colunasItens.precoUnitario} onChange={e => setColuna('precoUnitario', e.target.checked)} className={CHECKBOX} />
              Preço unitário
            </label>
            <label className={CHECK}>
              <input type="checkbox" checked={value.colunasItens.desconto} onChange={e => setColuna('desconto', e.target.checked)} className={CHECKBOX} />
              Desconto
            </label>
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Rodapé personalizado</label>
          <textarea
            rows={2}
            value={value.textoRodape}
            onChange={e => set('textoRodape', e.target.value)}
            className={IN + ' resize-none'}
            placeholder={tipo === 'orcamento' ? 'Vazio = usa o rodapé padrão da aba Orçamentos' : 'Vazio = usa o rodapé padrão da Empresa'}
          />
        </div>
      </div>

      {/* Pré-visualização */}
      <div>
        <p className="text-[10px] font-bold text-gray-500 uppercase mb-2">Pré-visualização (dados de exemplo)</p>
        {/* Largura calculada a partir do tamanho real após o scale(0.45) — como
            transform não encolhe o espaço de layout, "fit-content" não funciona
            aqui, por isso o valor fixo (210mm × 0.45 ≈ 357px + padding). */}
        <div
          className="bg-gray-700 rounded-xl overflow-hidden border border-gray-600"
          style={{ width: 390 }}
        >
          <div className="overflow-auto p-3" style={{ maxHeight: 540 }}>
            <div style={{ transform: 'scale(0.45)', transformOrigin: 'top left', width: '210mm' }}>
              <DocumentoImpressao layout={value} empresa={empresa} documento={mockDocumento(tipo)} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
