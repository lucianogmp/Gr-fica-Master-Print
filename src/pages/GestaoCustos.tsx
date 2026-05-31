import { useState } from 'react';
import { useCustosFixos, useDepreciacao } from '../hooks/useGestaoBase';
import { useGestaoCustos } from '../hooks/useGestaoCustos';
import { Modal } from '../components/ui/Modal';
import { KpiCard } from '../components/ui/KpiCard';
import {
  TrendingDown, Building2, DollarSign, Timer, BarChart3, Plus, type LucideIcon,
} from 'lucide-react';

type Aba = 'resumo' | 'fixos' | 'depreciacao';
const fmtBRL = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const IN = "w-full bg-[#111827] border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors";

export function GestaoCustos() {
  const { data: gc }          = useGestaoCustos();
  const { data: fixos = [], criar: criarFixo, atualizar: atualizarFixo, deletar: deletarFixo } = useCustosFixos();
  const { data: deprs = [], criar: criarDepr, deletar: deletarDepr } = useDepreciacao();

  const [aba, setAba]         = useState<Aba>('resumo');
  const [modalFixo, setModalFixo] = useState(false);
  const [modalDepr, setModalDepr] = useState(false);
  const [salvando, setSalvando]   = useState(false);

  // Forms
  const [formFixo, setFormFixo] = useState({ nome: '', categoria: '', valor_mensal: '', ativo: true, observacoes: '' });
  const [formDepr, setFormDepr] = useState({ nome: '', categoria: '', valor: '', vida_util_anos: '', data_aquisicao: '', observacoes: '' });

  const gcData = gc ?? { depr: 0, fixos: 0, total: 0, porHora: 0 };

  async function salvarFixo() {
    if (!formFixo.nome || !formFixo.valor_mensal) return;
    setSalvando(true);
    try {
      await criarFixo({
        nome:         formFixo.nome.trim(),
        categoria:    formFixo.categoria || null,
        valor_mensal: parseFloat(formFixo.valor_mensal),
        ativo:        formFixo.ativo,
        observacoes:  formFixo.observacoes || null,
      } as any);
      setFormFixo({ nome: '', categoria: '', valor_mensal: '', ativo: true, observacoes: '' });
      setModalFixo(false);
    } finally { setSalvando(false); }
  }

  async function salvarDepr() {
    if (!formDepr.nome || !formDepr.valor || !formDepr.vida_util_anos) return;
    setSalvando(true);
    try {
      await criarDepr({
        nome:            formDepr.nome.trim(),
        categoria:       formDepr.categoria || null,
        valor:           parseFloat(formDepr.valor),
        vida_util_anos:  parseFloat(formDepr.vida_util_anos),
        data_aquisicao:  formDepr.data_aquisicao || null,
        observacoes:     formDepr.observacoes || null,
      } as any);
      setFormDepr({ nome: '', categoria: '', valor: '', vida_util_anos: '', data_aquisicao: '', observacoes: '' });
      setModalDepr(false);
    } finally { setSalvando(false); }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white flex items-center gap-2"><TrendingDown className="w-6 h-6 text-blue-400" /> Gestão de Custos</h1>
        <p className="text-gray-500 text-sm">Custos fixos, depreciação e cálculo de overhead</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Custos fixos/mês"  value={fmtBRL(gcData.fixos)}   icon={Building2}    color="text-blue-400" />
        <KpiCard label="Depreciação/mês"   value={fmtBRL(gcData.depr)}    icon={TrendingDown} color="text-yellow-400" />
        <KpiCard label="Overhead total/mês" value={fmtBRL(gcData.total)}  icon={DollarSign}   color="text-red-400" />
        <KpiCard label="Overhead/hora"     value={fmtBRL(gcData.porHora)} icon={Timer}        color="text-purple-400" />
      </div>

      {/* Abas */}
      <div className="flex gap-1 bg-[#1f2937] border border-gray-700 rounded-xl p-1 w-fit">
        {([
          { key: 'resumo',      label: 'Resumo',       icon: BarChart3 },
          { key: 'fixos',       label: 'Custos Fixos', icon: Building2 },
          { key: 'depreciacao', label: 'Depreciação',  icon: TrendingDown },
        ] as { key: Aba; label: string; icon: LucideIcon }[]).map(t => (
          <button key={t.key} onClick={() => setAba(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${aba === t.key ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* ─── RESUMO ─── */}
      {aba === 'resumo' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-[#1f2937] border-t-2 border-blue-500 border-x border-b border-gray-700 rounded-xl p-5">
            <p className="text-xs font-bold text-gray-400 uppercase mb-4">Composição do Overhead Mensal</p>
            <div className="space-y-3">
              <LinhaCusto label="Custos Fixos"   valor={gcData.fixos} total={gcData.total} cor="bg-blue-500" />
              <LinhaCusto label="Depreciação"    valor={gcData.depr}  total={gcData.total} cor="bg-yellow-500" />
              <div className="pt-3 border-t border-gray-700 flex justify-between">
                <span className="font-bold text-white">Total/mês</span>
                <span className="text-lg font-black text-red-400">{fmtBRL(gcData.total)}</span>
              </div>
            </div>
          </div>

          <div className="bg-[#1f2937] border-t-2 border-purple-500 border-x border-b border-gray-700 rounded-xl p-5">
            <p className="text-xs font-bold text-gray-400 uppercase mb-4">Overhead por Período</p>
            <div className="space-y-3">
              {[
                { label: 'Por hora (8h/dia)', valor: gcData.porHora },
                { label: 'Por dia (8h)',       valor: gcData.porHora * 8 },
                { label: 'Por semana',         valor: gcData.porHora * 8 * 5 },
                { label: 'Por mês',            valor: gcData.total },
              ].map(({ label, valor }) => (
                <div key={label} className="flex justify-between items-center py-1 border-b border-gray-800 last:border-0">
                  <span className="text-sm text-gray-400">{label}</span>
                  <span className="font-bold text-purple-400">{fmtBRL(valor)}</span>
                </div>
              ))}
            </div>
            {gcData.total === 0 && (
              <p className="text-xs text-gray-600 mt-3">Cadastre custos fixos ou depreciação para calcular o overhead.</p>
            )}
          </div>
        </div>
      )}

      {/* ─── CUSTOS FIXOS ─── */}
      {aba === 'fixos' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setModalFixo(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all">
              + Novo Custo Fixo
            </button>
          </div>
          <div className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-[10px] font-bold uppercase border-b border-gray-700 bg-gray-800/40">
                  <th className="px-5 py-3 text-left">Nome</th>
                  <th className="px-5 py-3 text-left">Categoria</th>
                  <th className="px-5 py-3 text-right">Valor/mês</th>
                  <th className="px-5 py-3 text-center">Ativo</th>
                  <th className="px-5 py-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {fixos.length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-12 text-center text-gray-600">Nenhum custo fixo cadastrado.</td></tr>
                )}
                {fixos.map(f => (
                  <tr key={f.id} className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors">
                    <td className="px-5 py-3 font-medium text-white">{f.nome}</td>
                    <td className="px-5 py-3 text-gray-400 text-xs">{f.categoria || '—'}</td>
                    <td className="px-5 py-3 text-right font-bold text-red-400">{fmtBRL(f.valor_mensal)}</td>
                    <td className="px-5 py-3 text-center">
                      <button onClick={() => atualizarFixo({ id: f.id, dados: { ativo: !f.ativo } as any })}
                        className={`px-2 py-1 rounded-full text-[10px] font-bold border transition-all ${
                          f.ativo ? 'bg-green-500/15 text-green-400 border-green-500/30' : 'bg-gray-500/15 text-gray-400 border-gray-500/30'
                        }`}>
                        {f.ativo ? 'Ativo' : 'Inativo'}
                      </button>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <button onClick={() => { if (confirm(`Remover "${f.nome}"?`)) deletarFixo(f.id); }}
                        className="text-[10px] font-bold px-2 py-1 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30 transition-all">
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              {fixos.length > 0 && (
                <tfoot>
                  <tr className="border-t border-blue-500/20 bg-blue-900/10">
                    <td colSpan={2} className="px-5 py-2.5 text-right text-xs font-bold text-gray-500 uppercase">Total ativo/mês</td>
                    <td className="px-5 py-2.5 text-right font-black text-blue-400">
                      {fmtBRL(fixos.filter(f => f.ativo).reduce((s, f) => s + Number(f.valor_mensal), 0))}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ─── DEPRECIAÇÃO ─── */}
      {aba === 'depreciacao' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setModalDepr(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all">
              + Novo Ativo
            </button>
          </div>
          <div className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-[10px] font-bold uppercase border-b border-gray-700 bg-gray-800/40">
                  <th className="px-5 py-3 text-left">Nome</th>
                  <th className="px-5 py-3 text-left">Categoria</th>
                  <th className="px-5 py-3 text-right">Valor</th>
                  <th className="px-5 py-3 text-center">Vida útil</th>
                  <th className="px-5 py-3 text-right">Depr./mês</th>
                  <th className="px-5 py-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {deprs.length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-12 text-center text-gray-600">Nenhum ativo cadastrado.</td></tr>
                )}
                {deprs.map(d => {
                  const deprMes = Number(d.valor) / (Number(d.vida_util_anos) * 12);
                  return (
                    <tr key={d.id} className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors">
                      <td className="px-5 py-3 font-medium text-white">{d.nome}</td>
                      <td className="px-5 py-3 text-gray-400 text-xs">{d.categoria || '—'}</td>
                      <td className="px-5 py-3 text-right text-gray-300">{fmtBRL(Number(d.valor))}</td>
                      <td className="px-5 py-3 text-center text-gray-400 text-xs">{d.vida_util_anos} anos</td>
                      <td className="px-5 py-3 text-right font-bold text-yellow-400">{fmtBRL(deprMes)}</td>
                      <td className="px-5 py-3 text-center">
                        <button onClick={() => { if (confirm(`Remover "${d.nome}"?`)) deletarDepr(d.id); }}
                          className="text-[10px] font-bold px-2 py-1 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30 transition-all">
                          Excluir
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal custo fixo */}
      <Modal open={modalFixo} onClose={() => setModalFixo(false)} title={<span className="flex items-center gap-1.5"><Plus className="w-4 h-4" /> Novo Custo Fixo</span>} maxWidth="440px"
        actions={
          <>
            <button onClick={() => setModalFixo(false)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm font-medium transition-all">Cancelar</button>
            <button onClick={salvarFixo} disabled={salvando || !formFixo.nome || !formFixo.valor_mensal}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg text-sm font-bold transition-all">
              {salvando ? 'Salvando...' : 'Criar'}
            </button>
          </>
        }>
        <div className="space-y-4">
          <div><label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Nome *</label>
            <input autoFocus value={formFixo.nome} onChange={e => setFormFixo(f => ({ ...f, nome: e.target.value }))} className={IN} placeholder="Ex: Aluguel do galpão" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Categoria</label>
              <input value={formFixo.categoria} onChange={e => setFormFixo(f => ({ ...f, categoria: e.target.value }))} className={IN} placeholder="Ex: Infraestrutura" /></div>
            <div><label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Valor/mês (R$) *</label>
              <input type="number" min="0" step="0.01" value={formFixo.valor_mensal} onChange={e => setFormFixo(f => ({ ...f, valor_mensal: e.target.value }))} className={IN} placeholder="0,00" /></div>
          </div>
        </div>
      </Modal>

      {/* Modal depreciação */}
      <Modal open={modalDepr} onClose={() => setModalDepr(false)} title={<span className="flex items-center gap-1.5"><Plus className="w-4 h-4" /> Novo Ativo (Depreciação)</span>} maxWidth="440px"
        actions={
          <>
            <button onClick={() => setModalDepr(false)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm font-medium transition-all">Cancelar</button>
            <button onClick={salvarDepr} disabled={salvando || !formDepr.nome || !formDepr.valor || !formDepr.vida_util_anos}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg text-sm font-bold transition-all">
              {salvando ? 'Salvando...' : 'Criar'}
            </button>
          </>
        }>
        <div className="space-y-4">
          <div><label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Nome *</label>
            <input autoFocus value={formDepr.nome} onChange={e => setFormDepr(f => ({ ...f, nome: e.target.value }))} className={IN} placeholder="Ex: Plotter Roland" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Valor de compra (R$) *</label>
              <input type="number" min="0" step="0.01" value={formDepr.valor} onChange={e => setFormDepr(f => ({ ...f, valor: e.target.value }))} className={IN} placeholder="0,00" /></div>
            <div><label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Vida útil (anos) *</label>
              <input type="number" min="1" step="1" value={formDepr.vida_util_anos} onChange={e => setFormDepr(f => ({ ...f, vida_util_anos: e.target.value }))} className={IN} placeholder="5" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Categoria</label>
              <input value={formDepr.categoria} onChange={e => setFormDepr(f => ({ ...f, categoria: e.target.value }))} className={IN} placeholder="Ex: Equipamento" /></div>
            <div><label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Data de aquisição</label>
              <input type="date" value={formDepr.data_aquisicao} onChange={e => setFormDepr(f => ({ ...f, data_aquisicao: e.target.value }))} className={IN} /></div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function LinhaCusto({ label, valor, total, cor }: { label: string; valor: number; total: number; cor: string }) {
  const pct = total > 0 ? (valor / total) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-400">{label}</span>
        <span className="font-bold text-white">{Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
      </div>
      <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${cor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
