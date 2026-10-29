// src/pages/GestaoCustos/equipamentos/DadosGerais.tsx
// Cadastro do equipamento (novo ou edição). Só nome, valor e vida útil são obrigatórios;
// energia, residual e outros custos são opcionais — preencha só o que se aplica à máquina.
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useDepreciacao } from '../../../hooks/useGestaoBase';
import { calcularCustoEquipamento } from '../../../lib/custoEquipamento';
import type { Equipamento } from '../../../types/equipamento';
import { MoneyInput } from '../../../components/ui/MoneyInput';
import { QtdInput } from '../../../components/ui/QtdInput';
import { InteiroInput } from '../../../components/ui/InteiroInput';
import { DateInput } from '../../../components/ui/DateInput';
import { AutoTextarea } from '../../../components/ui/AutoTextarea';
import { HelpTooltip } from '../../../components/ui/HelpTooltip';
import { DarkSelect } from '../../../components/ui/DarkSelect';
import { TECNOLOGIAS, tecnologiaDe } from '../../../lib/tecnologias';
import { IN, LABEL, BTN_SALVAR, BTN_CANCELAR, fmtBRL, fmtHora } from './ui';

function paraForm(e?: Equipamento | null) {
  return {
    nome:                e?.nome ?? '',
    tecnologia:          e?.tecnologia ?? '',
    producao_mes:        Number(e?.producao_mes ?? 0),
    data_aquisicao:      e?.data_aquisicao ?? '',
    valor:               Number(e?.valor ?? 0),
    vida_util_anos:      e ? String(e.vida_util_anos) : '',
    valor_residual:      Number(e?.valor_residual ?? 0),
    horas_mes:           Number(e?.horas_mes ?? 160),
    ativo:               e?.ativo ?? true,
    potencia_kw:         e?.potencia_kw != null ? String(e.potencia_kw) : '',
    preco_kwh:           Number(e?.preco_kwh ?? 0),
    energia_hora_manual: Number(e?.energia_hora_manual ?? 0),
    outros_custos_mes:   Number(e?.outros_custos_mes ?? 0),
    observacoes:         e?.observacoes ?? '',
  };
}

export function DadosGerais({ equipamento, onSalvo, onCancelar }: {
  equipamento?: Equipamento | null;
  onSalvo: () => void;
  onCancelar?: () => void;
}) {
  const { criar, atualizar } = useDepreciacao();
  const [f, setF] = useState(() => paraForm(equipamento));
  const [salvando, setSalvando] = useState(false);
  const set = <K extends keyof ReturnType<typeof paraForm>>(k: K, v: ReturnType<typeof paraForm>[K]) =>
    setF(p => ({ ...p, [k]: v }));

  const vida = parseFloat(f.vida_util_anos) || 0;
  const tec = tecnologiaDe(f.tecnologia);

  // Prévia usando as mesmas regras do cálculo oficial (sem consumíveis/manutenções).
  const previa = calcularCustoEquipamento({
    id: 'previa', nome: f.nome, valor: f.valor, vida_util_anos: vida,
    valor_residual: f.valor_residual, horas_mes: f.horas_mes,
    potencia_kw: parseFloat(f.potencia_kw) || null, preco_kwh: f.preco_kwh || null,
    energia_hora_manual: f.energia_hora_manual || null, outros_custos_mes: f.outros_custos_mes,
    data_aquisicao: f.data_aquisicao || null,
  });

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!f.nome.trim() || !f.valor || !vida) return;
    if (f.valor_residual >= f.valor) {
      toast.error('O valor residual precisa ser menor que o valor de compra.');
      return;
    }
    setSalvando(true);
    try {
      const payload = {
        nome:                f.nome.trim(),
        tecnologia:          f.tecnologia || null,
        producao_mes:        f.producao_mes > 0 ? f.producao_mes : null,
        // o rótulo da tecnologia vira o "tipo" exibido; sem tecnologia, mantém o tipo que já existia
        ...(f.tecnologia ? { categoria: tecnologiaDe(f.tecnologia)?.label ?? null } : {}),
        data_aquisicao:      f.data_aquisicao || null,
        valor:               f.valor,
        vida_util_anos:      vida,
        valor_residual:      f.valor_residual || 0,
        horas_mes:           Math.max(1, f.horas_mes || 160),
        ativo:               f.ativo,
        potencia_kw:         parseFloat(f.potencia_kw) || null,
        preco_kwh:           f.preco_kwh || null,
        energia_hora_manual: f.energia_hora_manual > 0 ? f.energia_hora_manual : null,
        outros_custos_mes:   f.outros_custos_mes || 0,
        observacoes:         f.observacoes.trim() || null,
      } as any;
      if (equipamento) await atualizar({ id: equipamento.id, dados: payload });
      else await criar(payload);
      onSalvo();
    } finally { setSalvando(false); }
  }

  return (
    <form onSubmit={salvar} className="space-y-3">
      {/* Linha 1 — identificação */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[180px]">
          <label className={LABEL}>Nome *</label>
          <input required value={f.nome} onChange={e => set('nome', e.target.value)}
            className={IN + ' w-full'} placeholder="Ex: Plotter de recorte Foison" />
        </div>
        <div style={{ width: 250 }}>
          <label className={LABEL + ' flex items-center gap-1'}>
            Tecnologia
            <HelpTooltip texto="Diz ao sistema que tipo de máquina é: ele sugere os consumíveis certos e mede o custo na unidade certa (por página nas impressoras laser e jato de tinta, por m² nas plotters de impressão, por hora nas demais)." />
          </label>
          <DarkSelect size="sm" value={f.tecnologia} onChange={v => set('tecnologia', v)} placeholder="Escolha a tecnologia"
            options={TECNOLOGIAS.map(t => ({ value: t.key, label: t.exemplos ? `${t.label} — ${t.exemplos}` : t.label }))} />
        </div>
        <div style={{ width: 130 }}>
          <label className={LABEL}>Data da compra</label>
          <DateInput value={f.data_aquisicao} onChange={v => set('data_aquisicao', v)} className={IN + ' w-full'} />
        </div>
        <div>
          <label className={LABEL}>Situação</label>
          <button type="button" onClick={() => set('ativo', !f.ativo)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
              f.ativo ? 'bg-green-500/15 text-green-400 border-green-500/30' : 'bg-gray-500/15 text-gray-400 border-gray-500/30'
            }`}>
            {f.ativo ? 'Ativo' : 'Inativo'}
          </button>
        </div>
      </div>

      {/* Linha 2 — depreciação e horas */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className={LABEL}>Valor de compra *</label>
          <MoneyInput value={f.valor} onChange={v => set('valor', v)} className={IN} style={{ width: 118 }} placeholder="0,00" />
        </div>
        <div>
          <label className={LABEL + ' flex items-center gap-1'}>
            Valor residual
            <HelpTooltip texto="Quanto você acha que a máquina ainda vale no fim da vida útil (revenda/sucata). A depreciação passa a ser (compra − residual) ÷ vida útil. Deixe 0 se não souber." />
          </label>
          <MoneyInput value={f.valor_residual} onChange={v => set('valor_residual', v)} className={IN} style={{ width: 110 }} placeholder="0,00" />
        </div>
        <div>
          <label className={LABEL}>Vida útil (anos) *</label>
          <QtdInput value={f.vida_util_anos} onChange={v => set('vida_util_anos', v)} className={IN} style={{ width: 72 }} placeholder="10" />
        </div>
        <div>
          <label className={LABEL + ' flex items-center gap-1'}>
            Horas/mês
            <HelpTooltip texto="Horas PRODUTIVAS estimadas por mês — o tempo em que a máquina realmente trabalha, não o tempo em que fica ligada. É a base de todo o custo por hora. Se colocar mais do que o real, o custo por hora fica menor do que deveria." />
          </label>
          <InteiroInput value={f.horas_mes} onChange={v => set('horas_mes', v)} max={744} className={IN + ' text-center'} />
        </div>
        {tec && tec.unidadeProducao !== 'hora' && (
          <div>
            <label className={LABEL + ' flex items-center gap-1'}>
              {tec.unidadeProducao === 'página' ? 'Páginas' : 'm²'}/mês
              <HelpTooltip texto={`Quantas ${tec.unidadeProducao === 'página' ? 'páginas' : 'm²'} essa máquina produz por mês. É a base do custo por ${tec.unidadeProducao}. Vazio = o sistema usa uma estimativa (${(tec.producaoPadrao ?? 0).toLocaleString('pt-BR')}/mês) e avisa que é estimada.`} />
            </label>
            <InteiroInput value={f.producao_mes} onChange={v => set('producao_mes', v)} max={9999999} className={IN + ' text-center'}
              placeholder={String(tec.producaoPadrao ?? '')} />
          </div>
        )}
        <div className="flex gap-2">
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-1.5">
            <p className="text-[9px] text-gray-500 uppercase font-bold">Depr./mês</p>
            <p className="text-sm font-black text-yellow-400">{fmtBRL(previa.mensal.depreciacao)}</p>
          </div>
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-1.5">
            <p className="text-[9px] text-gray-500 uppercase font-bold">Depr./hora</p>
            <p className="text-sm font-black text-yellow-400">{fmtHora(previa.hora.depreciacao)}</p>
          </div>
        </div>
      </div>

      {/* Linha 3 — energia e outros custos (opcionais) */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className={LABEL}>Potência (kW)</label>
          <QtdInput value={f.potencia_kw} onChange={v => set('potencia_kw', v)} className={IN} style={{ width: 72 }} placeholder="0,00" />
        </div>
        <div>
          <label className={LABEL}>Preço kWh</label>
          <MoneyInput value={f.preco_kwh} onChange={v => set('preco_kwh', v)} className={IN} style={{ width: 80 }} placeholder="0,00" />
        </div>
        <div>
          <label className={LABEL + ' flex items-center gap-1'}>
            ou Energia R$/h
            <HelpTooltip texto="Se você não sabe a potência, informe direto quanto a máquina gasta de energia por hora. Quando preenchido, este valor vale no lugar de kW × kWh. Deixe zerado se não tiver o dado." />
          </label>
          <MoneyInput value={f.energia_hora_manual} onChange={v => set('energia_hora_manual', v)} className={IN} style={{ width: 90 }} placeholder="0,00" />
        </div>
        <div>
          <label className={LABEL + ' flex items-center gap-1'}>
            Outros custos/mês
            <HelpTooltip texto="Lubrificantes, materiais auxiliares e outros gastos recorrentes dessa máquina (R$ por mês). Não repita aqui o que já está nos consumíveis." />
          </label>
          <MoneyInput value={f.outros_custos_mes} onChange={v => set('outros_custos_mes', v)} className={IN} style={{ width: 110 }} placeholder="0,00" />
        </div>
        {previa.hora.energia > 0 && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-1.5">
            <p className="text-[9px] text-gray-500 uppercase font-bold">Energia/hora</p>
            <p className="text-sm font-black text-blue-300">{fmtHora(previa.hora.energia)}</p>
          </div>
        )}
      </div>

      <div>
        <label className={LABEL}>Observações</label>
        <AutoTextarea value={f.observacoes} onChange={v => set('observacoes', v)} className={IN + ' w-full'} />
      </div>

      <div className="flex justify-end gap-2">
        {onCancelar && <button type="button" onClick={onCancelar} className={BTN_CANCELAR}>Cancelar</button>}
        <button type="submit" disabled={salvando || !f.nome.trim() || !f.valor || !vida} className={BTN_SALVAR}>
          {salvando ? 'Salvando...' : equipamento ? 'Salvar alterações' : 'Criar equipamento'}
        </button>
      </div>
    </form>
  );
}
