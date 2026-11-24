// src/pages/Financeiro/SimuladorImpostos.tsx
// TELA DE TESTE — só simula na tela, não lê nem grava nada no sistema.
// Serve para entender como ficaria a carga de impostos sobre consumo (CBS/IBS, da Reforma Tributária)
// comparando o MEI de hoje (DAS fixo) com o regime regular. Os números são editáveis e são ESTIMATIVAS.
import { useState } from 'react';
import { Calculator, FlaskConical, ExternalLink } from 'lucide-react';
import { MoneyInput } from '../../components/ui/MoneyInput';

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtPct = (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
const IN = 'bg-[#111827] border border-gray-700 rounded-lg px-2 py-1 text-white text-sm focus:outline-none focus:border-blue-500';

function Campo({ label, dica, children }: { label: string; dica?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] text-gray-400 block mb-0.5">{label}</label>
      {children}
      {dica && <p className="text-[10px] leading-tight text-gray-600 mt-0.5">{dica}</p>}
    </div>
  );
}

function Numero({ value, onChange, sufixo, largura = 'w-24' }: { value: number; onChange: (v: number) => void; sufixo?: string; largura?: string }) {
  return (
    <div className="flex items-center gap-1">
      <input type="number" step="0.1" value={value} onChange={e => onChange(Number(e.target.value) || 0)} className={`${IN} ${largura} text-right`} />
      {sufixo && <span className="text-xs text-gray-500">{sufixo}</span>}
    </div>
  );
}

export function SimuladorImpostos() {
  const [faturamento, setFaturamento] = useState(12000);   // faturamento mensal total (os 2 CNPJs)
  const [pctPJ, setPctPJ] = useState(30);                  // % das vendas para empresas (PJ)
  const [insumos, setInsumos] = useState(5000);            // compras mensais de insumos/fornecedores
  const [pctCredito, setPctCredito] = useState(60);        // % dessas compras que gera crédito
  const [das, setDas] = useState(87.05);                   // DAS-MEI por CNPJ
  const [cnpjs, setCnpjs] = useState(2);
  const [cbs, setCbs] = useState(8.8);                     // alíquota de referência (estimativa)
  const [ibs, setIbs] = useState(17.7);                    // alíquota de referência (estimativa)

  const dasTotal = das * cnpjs;
  const cargaMei = faturamento > 0 ? (dasTotal / faturamento) * 100 : 0;

  const aliq = (cbs + ibs) / 100;
  const debito = faturamento * aliq;
  const credito = insumos * (pctCredito / 100) * aliq;
  const aPagarRegular = Math.max(0, debito - credito);
  const cargaRegular = faturamento > 0 ? (aPagarRegular / faturamento) * 100 : 0;

  const teste2026 = faturamento * 0.01; // 0,9% CBS + 0,1% IBS — período de teste, compensável
  const vendasPJ = faturamento * (pctPJ / 100);
  const creditoPerdidoCliente = vendasPJ * aliq;

  const CARD = 'bg-[#1f2937] border border-gray-700 rounded-xl px-3 py-2.5 space-y-1';
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-black text-white flex items-center gap-2">
          <Calculator className="w-5 h-5 text-blue-400" /> Simulador de impostos
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-900/40 text-yellow-400 flex items-center gap-1"><FlaskConical className="w-3 h-3" /> TESTE</span>
        </h1>
        <p className="text-gray-500 text-xs">Só simula aqui na tela — não lê nem altera nada do sistema. Mexa nos números para entender.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-3 items-start">
        {/* Números (editáveis) */}
        <div className={CARD + ' !space-y-0'}>
          <h2 className="text-[11px] font-black text-gray-400 uppercase mb-2">Seus números</h2>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
            <Campo label="Faturamento mensal (todos os CNPJs)"><MoneyInput value={faturamento} onChange={setFaturamento} className={`${IN} w-full text-right`} /></Campo>
            <Campo label="Compras de insumos no mês"><MoneyInput value={insumos} onChange={setInsumos} className={`${IN} w-full text-right`} /></Campo>
            <Campo label="Vendas para empresa (PJ)" dica="PJ costuma querer nota com crédito."><Numero value={pctPJ} onChange={setPctPJ} sufixo="%" largura="w-full" /></Campo>
            <Campo label="Compras que geram crédito" dica="Só se o fornecedor destaca CBS/IBS."><Numero value={pctCredito} onChange={setPctCredito} sufixo="%" largura="w-full" /></Campo>
            <Campo label="DAS-MEI por CNPJ"><MoneyInput value={das} onChange={setDas} className={`${IN} w-full text-right`} /></Campo>
            <Campo label="Nº de CNPJs"><Numero value={cnpjs} onChange={v => setCnpjs(Math.max(1, Math.round(v)))} largura="w-full" /></Campo>
            <Campo label="CBS (federal)" dica="Estimativa; não é a final."><Numero value={cbs} onChange={setCbs} sufixo="%" largura="w-full" /></Campo>
            <Campo label="IBS (estados/municípios)" dica="Estimativa; entra até 2033."><Numero value={ibs} onChange={setIbs} sufixo="%" largura="w-full" /></Campo>
          </div>
        </div>

        {/* Resultados */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className={CARD}>
            <h2 className="text-xs font-black text-white">Hoje: MEI (DAS fixo)</h2>
            <div className="text-2xl font-black text-green-400 leading-none">{fmtBRL(dasTotal)}</div>
            <p className="text-xs text-gray-400">Carga sobre o faturamento: <b className="text-white">{fmtPct(cargaMei)}</b> · mesmo valor vendendo pouco ou muito.</p>
            <p className="text-[10px] text-gray-500">Nota p/ cliente final: sem destaque de CBS/IBS. Cliente PJ aproveita crédito limitado.</p>
          </div>

          <div className={CARD}>
            <h2 className="text-xs font-black text-white">Se fosse regime regular (só CBS+IBS)</h2>
            <div className="text-2xl font-black text-orange-400 leading-none">{fmtBRL(aPagarRegular)}</div>
            <p className="text-xs text-gray-400">Débito {fmtBRL(debito)} − crédito {fmtBRL(credito)} · carga <b className="text-white">{fmtPct(cargaRegular)}</b></p>
            <p className="text-xs text-gray-400">Diferença p/ MEI: <b className={aPagarRegular > dasTotal ? 'text-red-400' : 'text-green-400'}>{aPagarRegular > dasTotal ? '+' : '−'}{fmtBRL(Math.abs(aPagarRegular - dasTotal))}</b>/mês</p>
            <p className="text-[10px] text-gray-500">Sem IRPJ/CSLL, ISS/ICMS nem folha — só a parte de consumo.</p>
          </div>

          <div className={CARD}>
            <h2 className="text-xs font-black text-white">2026 — período de teste</h2>
            <div className="text-2xl font-black text-white leading-none">{fmtBRL(teste2026)}</div>
            <p className="text-xs text-gray-400">CBS 0,9% + IBS 0,1% sobre a nota; só informativo e compensável.</p>
            <p className="text-[10px] text-gray-500">MEI no regime padrão não precisa destacar isso na nota.</p>
          </div>

          <div className={CARD}>
            <h2 className="text-xs font-black text-white">Clientes empresa (PJ)</h2>
            <div className="text-2xl font-black text-white leading-none">{fmtBRL(creditoPerdidoCliente)}</div>
            <p className="text-xs text-gray-400">Vendas p/ PJ: {fmtBRL(vendasPJ)}/mês — crédito máximo que o cliente PJ aproveitaria no regime regular.</p>
            <p className="text-[10px] text-gray-500">Teto teórico; alguns PJ podem preferir nota cheia. Decidir com o contador.</p>
          </div>
        </div>
      </div>

      <div className={CARD + ' text-xs text-gray-300'}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-xs font-black text-white">O que a Receita publicou no GitHub e como isso entra no ERP</h2>
          <a className="text-blue-400 hover:underline inline-flex items-center gap-1 text-[11px]" href="https://github.com/ReceitaFederal" target="_blank" rel="noreferrer">github.com/ReceitaFederal <ExternalLink className="w-3 h-3" /></a>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-x-5 gap-y-1.5 pt-1">
          <p>A Receita (com o Serpro) abriu o código da calculadora oficial da Reforma Tributária — licença MIT, 3 repositórios: regime regular, Simples Nacional e gerador de DANFSe.</p>
          <p>É feita para <b>sistemas que emitem nota</b>. Pra você, hoje, <b>não muda nada</b>: como MEI não destaca CBS/IBS. Só vira útil se for pro Simples/regime regular ou se emitir nota pelo ERP.</p>
          <p>Em ordem de valor: <b>1)</b> este simulador virar tela fixa com os números reais do mês; <b>2)</b> custo de produto considerar crédito das compras; <b>3)</b> só se mudar de regime: emitir nota com o cálculo oficial (Java/Go, serviço à parte).</p>
        </div>
      </div>
    </div>
  );
}
