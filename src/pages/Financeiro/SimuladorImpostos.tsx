// src/pages/Financeiro/SimuladorImpostos.tsx
// TELA DE TESTE — só simula na tela, não lê nem grava nada no sistema.
// Serve para entender como ficaria a carga de impostos sobre consumo (CBS/IBS, da Reforma Tributária)
// comparando o MEI de hoje (DAS fixo) com o regime regular. Os números são editáveis e são ESTIMATIVAS.
import { useState } from 'react';
import { Calculator, FlaskConical, ExternalLink } from 'lucide-react';
import { MoneyInput } from '../../components/ui/MoneyInput';

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtPct = (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
const IN = 'bg-[#111827] border border-gray-700 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500';

function Campo({ label, dica, children }: { label: string; dica?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] text-gray-400 block mb-1">{label}</label>
      {children}
      {dica && <p className="text-[10px] text-gray-600 mt-0.5 max-w-[220px]">{dica}</p>}
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

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      <div>
        <h1 className="text-2xl font-black text-white flex items-center gap-2">
          <Calculator className="w-6 h-6 text-blue-400" /> Simulador de impostos
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-900/40 text-yellow-400 flex items-center gap-1"><FlaskConical className="w-3 h-3" /> TESTE</span>
        </h1>
        <p className="text-gray-500 text-sm">Só simula aqui na tela — não lê nem altera nada do sistema. Mexa nos números para entender.</p>
      </div>

      <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-4 flex flex-wrap gap-4 items-start">
        <Campo label="Faturamento mensal (todos os CNPJs)"><MoneyInput value={faturamento} onChange={setFaturamento} className={`${IN} w-32 text-right`} /></Campo>
        <Campo label="Vendas para empresa (PJ)" dica="Cliente PJ costuma querer nota com crédito de imposto."><Numero value={pctPJ} onChange={setPctPJ} sufixo="%" /></Campo>
        <Campo label="Compras de insumos no mês"><MoneyInput value={insumos} onChange={setInsumos} className={`${IN} w-32 text-right`} /></Campo>
        <Campo label="Parte das compras que gera crédito" dica="Só conta se o fornecedor destaca CBS/IBS (não MEI/informal)."><Numero value={pctCredito} onChange={setPctCredito} sufixo="%" /></Campo>
        <Campo label="DAS-MEI por CNPJ"><MoneyInput value={das} onChange={setDas} className={`${IN} w-24 text-right`} /></Campo>
        <Campo label="Nº de CNPJs"><Numero value={cnpjs} onChange={v => setCnpjs(Math.max(1, Math.round(v)))} largura="w-16" /></Campo>
        <Campo label="CBS (federal)" dica="Estimativa de referência, ainda não é a alíquota final."><Numero value={cbs} onChange={setCbs} sufixo="%" largura="w-20" /></Campo>
        <Campo label="IBS (estados/municípios)" dica="Estimativa de referência; entra aos poucos até 2033."><Numero value={ibs} onChange={setIbs} sufixo="%" largura="w-20" /></Campo>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-4 space-y-2">
          <h2 className="text-sm font-black text-white">Hoje: MEI (DAS fixo)</h2>
          <p className="text-xs text-gray-400">Você paga o mesmo valor todo mês, vendendo pouco ou muito.</p>
          <div className="text-3xl font-black text-green-400">{fmtBRL(dasTotal)}</div>
          <p className="text-xs text-gray-400">Carga sobre o faturamento: <b className="text-white">{fmtPct(cargaMei)}</b></p>
          <p className="text-[11px] text-gray-500">Nota para cliente final: sem destaque de CBS/IBS. Para cliente PJ, o crédito que ele aproveita é limitado.</p>
        </div>

        <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-4 space-y-2">
          <h2 className="text-sm font-black text-white">Se fosse regime regular (só CBS+IBS)</h2>
          <p className="text-xs text-gray-400">Paga o imposto das vendas e abate o que pagou nas compras (crédito).</p>
          <div className="text-3xl font-black text-orange-400">{fmtBRL(aPagarRegular)}</div>
          <p className="text-xs text-gray-400">
            Débito {fmtBRL(debito)} − crédito {fmtBRL(credito)} · carga <b className="text-white">{fmtPct(cargaRegular)}</b>
          </p>
          <p className="text-xs text-gray-400">Diferença para o MEI: <b className={aPagarRegular > dasTotal ? 'text-red-400' : 'text-green-400'}>{aPagarRegular > dasTotal ? '+' : '−'}{fmtBRL(Math.abs(aPagarRegular - dasTotal))}</b> por mês</p>
          <p className="text-[11px] text-gray-500">Não inclui IRPJ/CSLL, ISS/ICMS nem folha. É só a parte de consumo, para ver a ordem de grandeza.</p>
        </div>

        <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-4 space-y-2">
          <h2 className="text-sm font-black text-white">2026 — período de teste</h2>
          <p className="text-xs text-gray-400">CBS 0,9% + IBS 0,1% sobre a nota; é só informativo e compensável.</p>
          <div className="text-2xl font-black text-white">{fmtBRL(teste2026)}</div>
          <p className="text-[11px] text-gray-500">MEI no regime padrão não precisa destacar isso na nota.</p>
        </div>

        <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-4 space-y-2">
          <h2 className="text-sm font-black text-white">Clientes empresa (PJ)</h2>
          <p className="text-xs text-gray-400">Vendas para PJ: {fmtBRL(vendasPJ)}/mês. No regime regular, o cliente PJ aproveitaria crédito de até:</p>
          <div className="text-2xl font-black text-white">{fmtBRL(creditoPerdidoCliente)}</div>
          <p className="text-[11px] text-gray-500">Teto teórico. Como MEI padrão dá crédito limitado, alguns clientes PJ podem preferir fornecedor com nota cheia — é o ponto para decidir com o contador.</p>
        </div>
      </div>

      <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-4 text-sm text-gray-300 space-y-2">
        <h2 className="text-sm font-black text-white">O que a Receita publicou no GitHub e como isso entra no ERP</h2>
        <p>A Receita Federal (com o Serpro) abriu o código da calculadora oficial da Reforma Tributária — licença MIT, 3 repositórios: regime regular, Simples Nacional e gerador de DANFSe (nota de serviço).</p>
        <p>É feita para <b>sistemas que emitem nota</b> usarem a mesma conta da Receita. Pra você, hoje, isso <b>não muda nada</b>: como MEI você não destaca CBS/IBS. Ela só vira útil se você (a) passar para o Simples Nacional/regime regular ou (b) quiser emitir nota pelo ERP com os tributos calculados.</p>
        <p>O que daria para aplicar no sistema, em ordem de valor: <b>1)</b> este simulador virar uma tela fixa, com os números reais do mês (faturamento, compras e % de vendas para PJ); <b>2)</b> custo de produto passar a considerar crédito de imposto das compras; <b>3)</b> só se mudar de regime: emitir nota com o cálculo oficial (aí sim se usa o código deles, que é em Java/Go e rodaria como um serviço à parte).</p>
        <a className="text-blue-400 hover:underline inline-flex items-center gap-1 text-xs" href="https://github.com/ReceitaFederal" target="_blank" rel="noreferrer">github.com/ReceitaFederal <ExternalLink className="w-3 h-3" /></a>
      </div>
    </div>
  );
}
