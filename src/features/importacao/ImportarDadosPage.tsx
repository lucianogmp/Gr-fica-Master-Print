// src/features/importacao/ImportarDadosPage.tsx
//
// Tela de importação genérica de dados (Configurações → Importar Dados).
// Fluxo: 1) escolher o que importar + subir o .xlsx  2) conferir/ajustar o
// mapeamento de colunas  3) revisar prévia com validação e duplicidade
// 4) executar a importação em lotes e mostrar o resultado.
//
// Sobre duplicidade: campos marcados como chave 'forte' (CPF/CNPJ, e-mail)
// bloqueiam a linha por padrão se já existirem no banco. Campos 'fraca'
// (nome, telefone) só marcam a linha como "possível duplicado" — muito comum
// aqui ter cliente cadastrado só com o nome, então nome repetido não pode
// travar a importação sozinho, só avisar pra revisão manual.
//
import { supabase } from '../../lib/supabase';
import * as XLSX from 'xlsx';
import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { DarkSelect } from '../../components/ui/DarkSelect';
import { TABELAS_IMPORTAVEIS, type TabelaImportavel } from './importConfig';
import { sugerirMapeamento, normalizar, detectarLinhaCabecalho } from './mapeamento';
import { lerPlanilha, parseNumeroBR, parseDataBR, parseBooleano, vazio, type AbaPlanilha } from '../../lib/planilha';

type Etapa = 'upload' | 'mapear' | 'revisar' | 'concluido';
type StatusLinha = 'ok' | 'duplicado_forte' | 'duplicado_possivel' | 'erro';

interface LinhaRevisao {
  linhaOriginal: number; // número da linha na planilha (pra localizar erro)
  dados: Record<string, any>;
  status: StatusLinha;
  motivo?: string;
}

interface ResultadoImportacao {
  inseridos: number;
  ignorados: number;
  erros: { linha: number; motivo: string }[];
}

const TAMANHO_LOTE = 300;

function normalizarTelefone(v: string): string {
  return String(v ?? '').replace(/\D/g, '');
}

type Conv = { valor: any } | { erro: string };

/** Converte o valor cru da célula para o tipo do campo (número BR, data, texto limpo...). */
function converterCampo(campo: import('./importConfig').CampoImportavel | undefined, bruto: any): Conv {
  if (!campo) return { valor: null };
  if (vazio(bruto)) return { valor: null };
  const rotulo = campo.label;

  if (campo.tipo === 'numero') {
    const n = parseNumeroBR(bruto);
    if (n === null) return { valor: null };
    if (Number.isNaN(n)) return { erro: `${rotulo}: "${bruto}" não é um número válido` };
    return { valor: n };
  }
  if (campo.tipo === 'data') {
    const d = parseDataBR(bruto);
    if (d === null) return { valor: null };
    if (d === undefined) return { erro: `${rotulo}: "${bruto}" não é uma data válida (use dd/mm/aaaa)` };
    return { valor: d };
  }
  if (campo.tipo === 'booleano') {
    const b = parseBooleano(bruto);
    if (b === null) return { erro: `${rotulo}: "${bruto}" não é sim/não` };
    return { valor: b };
  }

  let texto: string;
  if (typeof bruto === 'number') {
    // CPF/CNPJ e CEP lidos como número perdem o zero da frente
    const inteiro = Number.isInteger(bruto) ? String(bruto) : String(bruto);
    if (campo.chave === 'cpf_cnpj') texto = inteiro.length <= 11 ? inteiro.padStart(11, '0') : inteiro.padStart(14, '0');
    else if (campo.chave === 'cep') texto = inteiro.padStart(8, '0');
    else texto = inteiro;
  } else if (bruto instanceof Date) {
    texto = parseDataBR(bruto) ?? '';
  } else {
    texto = String(bruto).trim();
  }
  if (!texto) return { valor: null };

  if (campo.transformar) {
    const t = campo.transformar(texto);
    if (t && typeof t === 'object' && 'erro' in t) return { erro: t.erro };
    return { valor: t === '' ? null : t };
  }
  return { valor: texto };
}

function traduzirErro(msg: string): string {
  if (/duplicate key|unique/i.test(msg)) return 'Já existe um registro igual (duplicado)';
  if (/violates not-null/i.test(msg)) return 'Falta um campo obrigatório';
  if (/invalid input syntax/i.test(msg)) return 'Algum valor está em formato inválido (número ou data)';
  if (/row-level security|permission/i.test(msg)) return 'Sem permissão para gravar';
  return msg;
}

export default function ImportarDadosPage() {
  const queryClient = useQueryClient();
  const [etapa, setEtapa] = useState<Etapa>('upload');
  const [tabelaEscolhida, setTabelaEscolhida] = useState<TabelaImportavel | null>(null);

  const [nomeArquivo, setNomeArquivo] = useState<string>('');
  const [abas, setAbas] = useState<AbaPlanilha[]>([]);
  const [abaIdx, setAbaIdx] = useState(0);
  const [linhaCab, setLinhaCab] = useState(0); // índice (0-based) da linha de cabeçalho dentro da aba
  const [cabecalhos, setCabecalhos] = useState<string[]>([]);
  const [linhasBrutas, setLinhasBrutas] = useState<any[][]>([]);
  const [mapeamento, setMapeamento] = useState<Record<string, string>>({});

  const [pularDuplicadosFortes, setPularDuplicadosFortes] = useState(true);
  const [pularDuplicadosPossiveis, setPularDuplicadosPossiveis] = useState(false);
  const [linhasRevisao, setLinhasRevisao] = useState<LinhaRevisao[]>([]);
  // permite decidir linha a linha, sobrepondo a regra global (chave = linhaOriginal)
  const [decisaoManual, setDecisaoManual] = useState<Record<number, boolean>>({});
  const [validando, setValidando] = useState(false);

  const [importando, setImportando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  const camposDisponiveis = tabelaEscolhida?.campos ?? [];

  // ---------- Etapa 1: upload ----------

  /** Monta cabeçalhos/linhas a partir da aba e da linha de cabeçalho escolhidas. */
  function aplicarAba(lista: AbaPlanilha[], idx: number, cab: number) {
    if (!tabelaEscolhida) return;
    const linhas = lista[idx]?.linhas ?? [];
    const brutos = (linhas[cab] ?? []).map((c) => String(c ?? '').trim());
    // nomes únicos (duas colunas "Telefone" não podem se atropelar no mapeamento)
    const vistos: Record<string, number> = {};
    const cabecalhosUnicos = brutos.map((nome, i) => {
      const base = nome || `Coluna ${i + 1}`;
      vistos[base] = (vistos[base] ?? 0) + 1;
      return vistos[base] > 1 ? `${base} (${vistos[base]})` : base;
    });
    const dados = linhas.slice(cab + 1).filter((l) => l.some((v) => !vazio(v)));
    setCabecalhos(cabecalhosUnicos);
    setLinhasBrutas(dados);
    setMapeamento(sugerirMapeamento(cabecalhosUnicos, tabelaEscolhida.campos));
  }

  async function handleArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo || !tabelaEscolhida) return;

    setErroGeral(null);
    setNomeArquivo(arquivo.name);

    try {
      const lista = await lerPlanilha(arquivo);
      if (lista.length === 0 || lista.every((a) => a.linhas.length < 2)) {
        setErroGeral('Não encontrei linhas de dados nesse arquivo. Confira se há uma linha de cabeçalho e linhas abaixo dela.');
        return;
      }
      // escolhe a aba que mais parece ter os dados (mais linhas, desempate por cabeçalho reconhecido)
      let melhor = 0, melhorNota = -1;
      lista.forEach((a, i) => {
        const nota = a.linhas.length + detectarLinhaCabecalho(a.linhas, tabelaEscolhida.campos) * 0;
        if (nota > melhorNota) { melhorNota = nota; melhor = i; }
      });
      const cab = detectarLinhaCabecalho(lista[melhor].linhas, tabelaEscolhida.campos);
      setAbas(lista);
      setAbaIdx(melhor);
      setLinhaCab(cab);
      aplicarAba(lista, melhor, cab);
      setEtapa('mapear');
    } catch (err: any) {
      setErroGeral(`Não consegui ler esse arquivo (${err?.message ?? 'formato inválido'}). Use .xlsx, .xls ou .csv.`);
    }
  }

  function baixarModelo() {
    if (!tabelaEscolhida) return;
    const ws = XLSX.utils.aoa_to_sheet([tabelaEscolhida.campos.map((c) => c.label)]);
    ws['!cols'] = tabelaEscolhida.campos.map((c) => ({ wch: Math.max(14, c.label.length + 4) }));
    const dicas = [
      ['Como preencher'],
      ['Apague esta aba se quiser. Preencha a aba "Modelo" a partir da linha 2, uma linha por registro.'],
      ['Campos com * na lista abaixo são obrigatórios.'],
      [''],
      ...tabelaEscolhida.campos.map((c) => [
        `${c.label}${c.obrigatorio ? ' *' : ''}`,
        c.tipo === 'numero' ? 'número (ex.: 1234,56)' : c.tipo === 'data' ? 'data (ex.: 31/12/2026)' : 'texto',
        c.exemplo ? `ex.: ${c.exemplo}` : '',
      ]),
    ];
    const wsDicas = XLSX.utils.aoa_to_sheet(dicas);
    wsDicas['!cols'] = [{ wch: 48 }, { wch: 28 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Modelo');
    XLSX.utils.book_append_sheet(wb, wsDicas, 'Instruções');
    XLSX.writeFile(wb, `modelo-importacao-${tabelaEscolhida.tabela}.xlsx`);
  }

  // ---------- Etapa 2: mapeamento ----------

  function atualizarMapeamento(coluna: string, chaveCampo: string) {
    setMapeamento((prev) => {
      const novo = { ...prev };
      if (chaveCampo === '') {
        delete novo[coluna];
      } else {
        novo[coluna] = chaveCampo;
      }
      return novo;
    });
  }

  const camposObrigatoriosMapeados = useMemo(() => {
    const chavesMapeadas = new Set(Object.values(mapeamento));
    return camposDisponiveis.filter((c) => c.obrigatorio).every((c) =>
      chavesMapeadas.has(c.chave) ||
      (c.chave === 'nome' && (chavesMapeadas.has('nome_fantasia') || chavesMapeadas.has('razao_social'))));
  }, [mapeamento, camposDisponiveis]);

  async function avancarParaRevisao() {
    if (!tabelaEscolhida) return;
    setValidando(true);
    setErroGeral(null);
    setDecisaoManual({});

    try {
      const colunasComMapa = cabecalhos
        .map((col, idx) => ({ col, idx, chave: mapeamento[col] }))
        .filter((c) => !!c.chave);

      const linhasMontadas = linhasBrutas.map((linha, i) => {
        const dados: Record<string, any> = {};
        const errosConv: string[] = [];
        for (const { idx, chave } of colunasComMapa) {
          const campo = tabelaEscolhida.campos.find((c) => c.chave === chave);
          const conv = converterCampo(campo, linha[idx]);
          if ('erro' in conv) errosConv.push(conv.erro);
          else if (conv.valor !== null) dados[chave] = conv.valor;
        }
        // cliente/fornecedor sem coluna "Nome": usa fantasia ou razão social
        if (vazio(dados.nome) && (dados.nome_fantasia || dados.razao_social)) {
          dados.nome = dados.nome_fantasia || dados.razao_social;
        }
        // linhaOriginal = linha real na planilha (1-based), pra achar o erro lá
        return { linhaOriginal: linhaCab + i + 2, dados, erroConversao: errosConv[0] };
      });

      const camposFortes = tabelaEscolhida.campos.filter((c) => c.chaveDuplicidade === 'forte');
      const camposFracos = tabelaEscolhida.campos.filter((c) => c.chaveDuplicidade === 'fraca');
      const todosCamposChave = [...camposFortes, ...camposFracos];

      // busca no banco os valores existentes de todas as colunas usadas em
      // qualquer nível de duplicidade, pra comparar contra a planilha
      const existentesPorCampo: Record<string, { chave: string; original: string }[]> = {};

      if (todosCamposChave.length > 0) {
        const colunasSelect = todosCamposChave.map((c) => c.chave).join(',');
        const { data: existentes, error } = await supabase.from(tabelaEscolhida.tabela).select(colunasSelect);
        if (error) throw error;

        for (const campo of todosCamposChave) {
          const ehTelefone = campo.chave === 'telefone';
          existentesPorCampo[campo.chave] = (existentes ?? [])
            .map((row: any) => row[campo.chave])
            .filter((v: any) => v !== null && v !== undefined && String(v).trim() !== '')
            .map((v: any) => ({
              chave: ehTelefone ? normalizarTelefone(v) : normalizar(String(v)),
              original: String(v),
            }))
            .filter((x) => x.chave !== '');
        }
      }

      const vistosNestaPlanilha: Record<string, Set<string>> = {};
      todosCamposChave.forEach((c) => (vistosNestaPlanilha[c.chave] = new Set()));

      function chaveNormalizada(campoChave: string, valor: any): string {
        return campoChave === 'telefone' ? normalizarTelefone(valor) : normalizar(String(valor ?? ''));
      }

      const revisao: LinhaRevisao[] = linhasMontadas.map(({ linhaOriginal, dados, erroConversao }) => {
        if (erroConversao) {
          return { linhaOriginal, dados, status: 'erro' as const, motivo: erroConversao };
        }
        // 1) valida obrigatórios
        const campoFaltando = tabelaEscolhida.campos.find(
          (c) => c.obrigatorio && !String(dados[c.chave] ?? '').trim()
        );
        if (campoFaltando) {
          return {
            linhaOriginal,
            dados,
            status: 'erro' as const,
            motivo: `Campo obrigatório "${campoFaltando.label}" está vazio`,
          };
        }

        // 2) duplicidade forte (CPF/CNPJ, e-mail) — checa primeiro, é a mais confiável
        for (const campo of camposFortes) {
          const valor = chaveNormalizada(campo.chave, dados[campo.chave]);
          if (!valor) continue;

          const bateNoBanco = existentesPorCampo[campo.chave]?.find((e) => e.chave === valor);
          if (bateNoBanco) {
            return {
              linhaOriginal,
              dados,
              status: 'duplicado_forte' as const,
              motivo: `${campo.label} "${bateNoBanco.original}" já existe no sistema`,
            };
          }
          if (vistosNestaPlanilha[campo.chave]?.has(valor)) {
            return {
              linhaOriginal,
              dados,
              status: 'duplicado_forte' as const,
              motivo: `${campo.label} "${dados[campo.chave]}" está repetido na própria planilha`,
            };
          }
        }

        // 3) duplicidade fraca (nome, telefone) — só sinaliza, não bloqueia sozinha
        let possivel: { label: string; original: string } | null = null;
        for (const campo of camposFracos) {
          const valor = chaveNormalizada(campo.chave, dados[campo.chave]);
          if (!valor) continue;

          const bateNoBanco = existentesPorCampo[campo.chave]?.find((e) => e.chave === valor);
          if (bateNoBanco && !possivel) {
            possivel = { label: campo.label, original: bateNoBanco.original };
          }
        }

        // registra as chaves (fortes e fracas) desta linha pra comparar com as próximas
        for (const campo of todosCamposChave) {
          const valor = chaveNormalizada(campo.chave, dados[campo.chave]);
          if (valor) vistosNestaPlanilha[campo.chave]?.add(valor);
        }

        if (possivel) {
          return {
            linhaOriginal,
            dados,
            status: 'duplicado_possivel' as const,
            motivo: `Já existe um cadastro com ${possivel.label.toLowerCase()} parecido: "${possivel.original}" — confira se não é a mesma pessoa`,
          };
        }

        return { linhaOriginal, dados, status: 'ok' as const };
      });

      setLinhasRevisao(revisao);
      setEtapa('revisar');
    } catch (err: any) {
      setErroGeral(err?.message ?? 'Erro ao validar os dados antes da importação.');
    } finally {
      setValidando(false);
    }
  }

  // ---------- Etapa 3: revisão + Etapa 4: execução ----------

  const resumo = useMemo(() => {
    const ok = linhasRevisao.filter((l) => l.status === 'ok').length;
    const fortes = linhasRevisao.filter((l) => l.status === 'duplicado_forte').length;
    const possiveis = linhasRevisao.filter((l) => l.status === 'duplicado_possivel').length;
    const erros = linhasRevisao.filter((l) => l.status === 'erro').length;
    return { ok, fortes, possiveis, erros, total: linhasRevisao.length };
  }, [linhasRevisao]);

  function vaiSerImportada(linha: LinhaRevisao): boolean {
    if (linha.status === 'erro') return false;
    const manual = decisaoManual[linha.linhaOriginal];
    if (manual !== undefined) return manual;
    if (linha.status === 'ok') return true;
    if (linha.status === 'duplicado_forte') return !pularDuplicadosFortes;
    return !pularDuplicadosPossiveis; // duplicado_possivel
  }

  const totalSelecionadas = useMemo(
    () => linhasRevisao.filter(vaiSerImportada).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [linhasRevisao, decisaoManual, pularDuplicadosFortes, pularDuplicadosPossiveis]
  );

  async function executarImportacao() {
    if (!tabelaEscolhida) return;
    setImportando(true);
    setProgresso(0);
    setErroGeral(null);

    const linhasParaImportar = linhasRevisao.filter(vaiSerImportada);
    const ignoradas = linhasRevisao.length - linhasParaImportar.length;

    const erros: { linha: number; motivo: string }[] = [];
    let inseridos = 0;

    try {
      for (let i = 0; i < linhasParaImportar.length; i += TAMANHO_LOTE) {
        const lote = linhasParaImportar.slice(i, i + TAMANHO_LOTE);
        const payload = lote.map((l) => l.dados);

        const { error, count } = await supabase
          .from(tabelaEscolhida.tabela)
          .insert(payload, { count: 'exact' });

        if (error) {
          // Uma linha ruim não pode derrubar o lote inteiro: tenta uma a uma e aponta só a que falhou.
          for (const l of lote) {
            const { error: e1 } = await supabase.from(tabelaEscolhida.tabela).insert(l.dados);
            if (e1) erros.push({ linha: l.linhaOriginal, motivo: traduzirErro(e1.message) });
            else inseridos += 1;
          }
        } else {
          inseridos += count ?? payload.length;
        }

        setProgresso(Math.round(((i + lote.length) / linhasParaImportar.length) * 100));
      }

      setResultado({ inseridos, ignorados: ignoradas, erros });
      setEtapa('concluido');
      // os dados foram inseridos direto pelo Supabase, por fora do fluxo normal
      // de cadastro — precisa invalidar o cache do React Query pra as telas
      // de listagem (Clientes, Estoque, etc) mostrarem os registros novos
      // sem precisar dar F5.
      queryClient.invalidateQueries();
    } catch (err: any) {
      setErroGeral(err?.message ?? 'Erro inesperado durante a importação.');
    } finally {
      setImportando(false);
    }
  }

  function recomecar() {
    setEtapa('upload');
    setTabelaEscolhida(null);
    setNomeArquivo('');
    setCabecalhos([]);
    setLinhasBrutas([]);
    setAbas([]);
    setAbaIdx(0);
    setLinhaCab(0);
    setMapeamento({});
    setLinhasRevisao([]);
    setDecisaoManual({});
    setResultado(null);
    setErroGeral(null);
  }

  // ---------- Render ----------

  return (
    <div className="max-w-4xl mx-auto p-6 text-gray-100">
      <h1 className="text-xl font-semibold mb-1">Importar dados</h1>
      <p className="text-sm text-gray-400 mb-6">
        Traga clientes, fornecedores, estoque e contas do sistema antigo para cá, a partir de uma planilha (.xlsx, .xls ou .csv).
      </p>

      <Passos etapaAtual={etapa} />

      {erroGeral && (
        <div className="mt-4 bg-red-950 border border-red-800 text-red-200 text-sm rounded-md p-3">
          {erroGeral}
        </div>
      )}

      {etapa === 'upload' && (
        <div className="mt-6 space-y-5">
          <div>
            <label className="block text-sm font-medium mb-2">O que você quer importar?</label>
            <DarkSelect
              value={tabelaEscolhida?.tabela ?? ''} allowEmpty placeholder="Selecione..."
              onChange={(v) => setTabelaEscolhida(TABELAS_IMPORTAVEIS.find((x) => x.tabela === v) ?? null)}
              options={TABELAS_IMPORTAVEIS.map((t) => ({ value: t.tabela, label: t.label }))}
            />
          </div>

          {tabelaEscolhida && (
            <div>
              <label className="block text-sm font-medium mb-2">
                Planilha exportada do sistema antigo
              </label>
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.txt,.tsv"
                onChange={handleArquivo}
                className="block w-full text-sm text-gray-300 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-blue-600 file:text-white file:text-sm hover:file:bg-blue-500"
              />
              <p className="text-xs text-gray-500 mt-2">
                O sistema acha sozinho a linha dos nomes das colunas (mesmo com títulos acima), aceita CSV com ; ou , e
                converte datas (31/12/2026) e valores (1.234,56) automaticamente.
              </p>
              <button type="button" onClick={baixarModelo}
                className="mt-3 text-xs font-bold text-blue-400 hover:text-blue-300 underline underline-offset-2">
                Baixar planilha modelo de {tabelaEscolhida.label.toLowerCase()} (já com as colunas certas)
              </button>
            </div>
          )}
        </div>
      )}

      {etapa === 'mapear' && tabelaEscolhida && (
        <div className="mt-6">
          <p className="text-sm text-gray-400 mb-4">
            Arquivo <span className="text-gray-200 font-medium">{nomeArquivo}</span> — {linhasBrutas.length}{' '}
            linha(s) encontrada(s). Confira se cada coluna da planilha foi ligada ao campo certo do sistema.
          </p>

          <div className="flex flex-wrap items-center gap-4 mb-4 text-xs text-gray-400">
            {abas.length > 1 && (
              <label className="flex items-center gap-2">Aba:
                <select value={abaIdx}
                  onChange={(e) => { const i = Number(e.target.value); const cab = detectarLinhaCabecalho(abas[i].linhas, camposDisponiveis); setAbaIdx(i); setLinhaCab(cab); aplicarAba(abas, i, cab); }}
                  className="bg-[#111827] border border-gray-700 rounded px-2 py-1 text-gray-200">
                  {abas.map((a, i) => <option key={a.nome} value={i}>{a.nome} ({a.linhas.length} linhas)</option>)}
                </select>
              </label>
            )}
            <label className="flex items-center gap-2">Os nomes das colunas estão na linha
              <input type="number" min={1} max={Math.max(1, abas[abaIdx]?.linhas.length ?? 1)} value={linhaCab + 1}
                onChange={(e) => { const n = Math.max(1, Number(e.target.value) || 1) - 1; setLinhaCab(n); aplicarAba(abas, abaIdx, n); }}
                className="w-16 bg-[#111827] border border-gray-700 rounded px-2 py-1 text-gray-200 text-center" />
            </label>
          </div>

          <div className="border border-gray-800 rounded-md divide-y divide-gray-800">
            {cabecalhos.map((coluna, ci) => (
              <div key={coluna + ci} className="flex items-center gap-3 p-3">
                <div className="w-1/2 min-w-0">
                  <p className="text-sm text-gray-300 truncate">{coluna || '(sem nome)'}</p>
                  <p className="text-[11px] text-gray-600 truncate">
                    {(() => { const ex = linhasBrutas.find((l) => !vazio(l[ci]))?.[ci]; return ex === undefined ? 'sem dados' : `ex.: ${ex instanceof Date ? ex.toLocaleDateString('pt-BR') : String(ex)}`; })()}
                  </p>
                </div>
                <div className="w-1/2">
                  <DarkSelect
                    size="sm" value={mapeamento[coluna] ?? ''} allowEmpty placeholder="Ignorar esta coluna"
                    onChange={(v) => atualizarMapeamento(coluna, v)}
                    options={camposDisponiveis.map((campo) => ({ value: campo.chave, label: campo.label + (campo.obrigatorio ? ' *' : '') }))}
                  />
                </div>
              </div>
            ))}
          </div>

          {!camposObrigatoriosMapeados && (
            <p className="text-sm text-amber-400 mt-3">
              Ligue todas as colunas marcadas com * a algum campo da planilha antes de continuar.
            </p>
          )}

          <div className="flex justify-between mt-5">
            <button onClick={recomecar} className="text-sm text-gray-400 hover:text-gray-200">
              Voltar
            </button>
            <button
              onClick={avancarParaRevisao}
              disabled={!camposObrigatoriosMapeados || validando}
              className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium px-4 py-2 rounded-md"
            >
              {validando ? 'Conferindo...' : 'Conferir prévia'}
            </button>
          </div>
        </div>
      )}

      {etapa === 'revisar' && tabelaEscolhida && (
        <div className="mt-6">
          <div className="grid grid-cols-4 gap-3 mb-4">
            <ResumoCard cor="green" numero={resumo.ok} label="Prontos" />
            <ResumoCard cor="red" numero={resumo.fortes} label="Duplicado confirmado" />
            <ResumoCard cor="amber" numero={resumo.possiveis} label="Possível duplicado" />
            <ResumoCard cor="gray" numero={resumo.erros} label="Com erro" />
          </div>

          <div className="space-y-2 mb-4">
            {resumo.fortes > 0 && (
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={pularDuplicadosFortes}
                  onChange={(e) => setPularDuplicadosFortes(e.target.checked)}
                />
                Pular duplicados confirmados (mesmo CPF/CNPJ ou e-mail já cadastrado)
              </label>
            )}
            {resumo.possiveis > 0 && (
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={pularDuplicadosPossiveis}
                  onChange={(e) => setPularDuplicadosPossiveis(e.target.checked)}
                />
                Também pular os possíveis duplicados (nome/telefone parecido — sem certeza, revise antes)
              </label>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto border border-gray-800 rounded-md">
            <table className="w-full text-xs">
              <thead className="bg-gray-900 sticky top-0">
                <tr>
                  <th className="text-left p-2 w-14">Linha</th>
                  <th className="text-left p-2">Dados</th>
                  <th className="text-left p-2 w-56">Situação</th>
                  <th className="text-center p-2 w-20">Importar?</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {linhasRevisao.map((linha) => {
                  const incluida = vaiSerImportada(linha);
                  return (
                    <tr key={linha.linhaOriginal} className={!incluida ? 'opacity-50' : ''}>
                      <td className="p-2 text-gray-500">{linha.linhaOriginal}</td>
                      <td className="p-2 text-gray-300">
                        {Object.entries(linha.dados)
                          .filter(([, v]) => String(v ?? '').trim() !== '')
                          .slice(0, 4)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(' · ')}
                      </td>
                      <td className="p-2">
                        <Selo status={linha.status} motivo={linha.motivo} />
                      </td>
                      <td className="p-2 text-center">
                        {linha.status !== 'erro' && (
                          <input
                            type="checkbox"
                            checked={incluida}
                            onChange={(e) =>
                              setDecisaoManual((prev) => ({ ...prev, [linha.linhaOriginal]: e.target.checked }))
                            }
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center mt-5">
            <button onClick={() => setEtapa('mapear')} className="text-sm text-gray-400 hover:text-gray-200">
              Voltar ao mapeamento
            </button>
            <button
              onClick={executarImportacao}
              disabled={importando || totalSelecionadas === 0}
              className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium px-4 py-2 rounded-md"
            >
              {importando ? `Importando... ${progresso}%` : `Importar ${totalSelecionadas} registro(s)`}
            </button>
          </div>
        </div>
      )}

      {etapa === 'concluido' && resultado && (
        <div className="mt-6">
          <div className="bg-green-950 border border-green-800 rounded-md p-4 mb-4">
            <p className="text-green-200 font-medium">Importação concluída.</p>
            <p className="text-sm text-green-300 mt-1">
              {resultado.inseridos} registro(s) importado(s)
              {resultado.ignorados > 0 && `, ${resultado.ignorados} não importado(s) (duplicado ou erro)`}
              {resultado.erros.length > 0 && `, ${resultado.erros.length} falharam ao gravar`}.
            </p>
          </div>

          {resultado.erros.length > 0 && (
            <div className="border border-red-900 rounded-md p-3 mb-4 max-h-48 overflow-y-auto">
              <p className="text-sm text-red-300 font-medium mb-2">Linhas com erro ao gravar:</p>
              {resultado.erros.map((e, i) => (
                <p key={i} className="text-xs text-red-400">
                  Linha {e.linha}: {e.motivo}
                </p>
              ))}
            </div>
          )}

          <button
            onClick={recomecar}
            className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-md"
          >
            Importar outra planilha
          </button>
        </div>
      )}
    </div>
  );
}

// ---------- Subcomponentes visuais ----------

function Passos({ etapaAtual }: { etapaAtual: Etapa }) {
  const passos: { chave: Etapa; label: string }[] = [
    { chave: 'upload', label: 'Enviar planilha' },
    { chave: 'mapear', label: 'Mapear colunas' },
    { chave: 'revisar', label: 'Revisar' },
    { chave: 'concluido', label: 'Concluído' },
  ];
  const indiceAtual = passos.findIndex((p) => p.chave === etapaAtual);

  return (
    <div className="flex items-center gap-2 text-xs">
      {passos.map((p, i) => (
        <div key={p.chave} className="flex items-center gap-2">
          <span
            className={
              i <= indiceAtual
                ? 'w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center'
                : 'w-5 h-5 rounded-full bg-gray-800 text-gray-500 flex items-center justify-center'
            }
          >
            {i + 1}
          </span>
          <span className={i <= indiceAtual ? 'text-gray-200' : 'text-gray-600'}>{p.label}</span>
          {i < passos.length - 1 && <span className="w-6 h-px bg-gray-800 mx-1" />}
        </div>
      ))}
    </div>
  );
}

function ResumoCard({
  cor,
  numero,
  label,
}: {
  cor: 'green' | 'amber' | 'red' | 'gray';
  numero: number;
  label: string;
}) {
  const cores = {
    green: 'bg-green-950 border-green-800 text-green-300',
    amber: 'bg-amber-950 border-amber-800 text-amber-300',
    red: 'bg-red-950 border-red-800 text-red-300',
    gray: 'bg-gray-900 border-gray-800 text-gray-400',
  } as const;
  return (
    <div className={`border rounded-md p-3 ${cores[cor]}`}>
      <p className="text-2xl font-semibold">{numero}</p>
      <p className="text-xs opacity-80">{label}</p>
    </div>
  );
}

function Selo({ status, motivo }: { status: StatusLinha; motivo?: string }) {
  if (status === 'ok') return <span className="text-green-400">Pronto</span>;
  if (status === 'duplicado_forte')
    return (
      <span className="text-red-400" title={motivo}>
        Duplicado confirmado
      </span>
    );
  if (status === 'duplicado_possivel')
    return (
      <span className="text-amber-400" title={motivo}>
        Possível duplicado
      </span>
    );
  return (
    <span className="text-gray-500" title={motivo}>
      Erro
    </span>
  );
}
