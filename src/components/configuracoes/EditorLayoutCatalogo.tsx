// src/components/configuracoes/EditorLayoutCatalogo.tsx
//
// Editor visual (formulário + preview em tempo real) do layout de impressão
// do Catálogo de Produtos. Usado dentro da aba "Impressão" em Configurações.
//
// O preview usa dados de exemplo (mockCatalogo) — não busca produtos reais,
// é só para visualizar o efeito das opções enquanto edita.

import { LayoutCatalogoConfig } from '../../types/layoutImpressao';
import type { Configuracoes } from '../../types/configuracoes';
import { DocumentoCatalogo, DocumentoCatalogoData } from '../impressao/DocumentoCatalogo';

const IN = "w-full bg-[#111827] border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors";
const CHECK = "flex items-center gap-2 text-sm text-gray-300 cursor-pointer py-0.5";
const CHECKBOX = "w-4 h-4 accent-blue-600";

const MOCK_CATALOGO: DocumentoCatalogoData = {
  itens: [
    { nome: 'Banner Lona 440g', sku: 'BAN-440', descricao: 'Lona fosca, acabamento com ilhós', unidade: 'm2', precoVenda: 65, categoriaNome: 'Banners e Lonas' },
    { nome: 'Adesivo Vinil Recorte', sku: 'ADV-001', descricao: 'Corte eletrônico, aplicação inclusa', unidade: 'm2', precoVenda: 85, categoriaNome: 'Adesivos' },
    { nome: 'Cartão de Visita 300g', sku: 'CV-300', descricao: 'Couché 300g, verniz UV frente', unidade: 'unidade', precoVenda: 0.35, categoriaNome: 'Impressos' },
    { nome: 'Panfleto A5 90g', sku: 'PAN-A5', descricao: 'Couché 90g, frente e verso', unidade: 'unidade', precoVenda: 0.22, categoriaNome: 'Impressos' },
  ],
};

interface EditorLayoutCatalogoProps {
  value: LayoutCatalogoConfig;
  onChange: (v: LayoutCatalogoConfig) => void;
  empresa: Partial<Configuracoes>;
}

export function EditorLayoutCatalogo({ value, onChange, empresa }: EditorLayoutCatalogoProps) {
  function set<K extends keyof LayoutCatalogoConfig>(field: K, v: LayoutCatalogoConfig[K]) {
    onChange({ ...value, [field]: v });
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
              <input type="checkbox" checked={value.mostrarDadosEmpresa} onChange={e => set('mostrarDadosEmpresa', e.target.checked)} className={CHECKBOX} />
              Dados da empresa
            </label>
            <label className={CHECK}>
              <input type="checkbox" checked={value.mostrarCnpj} onChange={e => set('mostrarCnpj', e.target.checked)} className={CHECKBOX} />
              CNPJ
            </label>
            <label className={CHECK}>
              <input type="checkbox" checked={value.mostrarContato} onChange={e => set('mostrarContato', e.target.checked)} className={CHECKBOX} />
              Telefone / e-mail
            </label>
          </div>
        </div>

        <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-3">
          <p className="text-[10px] font-bold text-gray-500 uppercase mb-2">Produtos</p>
          <div className="grid grid-cols-2 gap-x-3">
            <label className={CHECK}>
              <input type="checkbox" checked={value.agruparPorCategoria} onChange={e => set('agruparPorCategoria', e.target.checked)} className={CHECKBOX} />
              Agrupar por categoria
            </label>
            <label className={CHECK}>
              <input type="checkbox" checked={value.mostrarDescricao} onChange={e => set('mostrarDescricao', e.target.checked)} className={CHECKBOX} />
              Descrição do produto
            </label>
            <label className={CHECK}>
              <input type="checkbox" checked={value.mostrarSku} onChange={e => set('mostrarSku', e.target.checked)} className={CHECKBOX} />
              SKU
            </label>
            <label className={CHECK}>
              <input type="checkbox" checked={value.mostrarUnidade} onChange={e => set('mostrarUnidade', e.target.checked)} className={CHECKBOX} />
              Unidade
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
            placeholder="Vazio = usa o rodapé padrão da Empresa"
          />
        </div>
      </div>

      {/* Pré-visualização */}
      <div>
        <p className="text-[10px] font-bold text-gray-500 uppercase mb-2">Pré-visualização (dados de exemplo)</p>
        <div
          className="bg-gray-700 rounded-xl overflow-hidden border border-gray-600"
          style={{ width: 390 }}
        >
          <div className="overflow-auto p-3" style={{ maxHeight: 540 }}>
            <div style={{ transform: 'scale(0.45)', transformOrigin: 'top left', width: '210mm' }}>
              <DocumentoCatalogo layout={value} empresa={empresa} documento={MOCK_CATALOGO} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
