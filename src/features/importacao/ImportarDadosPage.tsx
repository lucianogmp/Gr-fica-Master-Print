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
import { TABELAS_IMPORTAVEIS, type TabelaImportavel } from './importConfig';
import { sugerirMapeamento, normalizar } from './mapeamento';

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

export default function ImportarDadosPage() {
  const queryClient = useQueryClient();
  const [etapa, setEtapa] = useState<Etapa>('upload');
  const [tabelaEscolhida, setTabelaEscolhida] = useState<TabelaImportavel | null>(null);

  const [nomeArquivo, setNomeArquivo] = useState<string>('');
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

  async function handleArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo || !tabelaEscolhida) return;

    setErroGeral(null);
    setNomeArquivo(arquivo.name);

    try {
      const buffer = await arquivo.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
      const primeiraAba = workbook.SheetNames[0];
      const planilha = workbook.Sheets[primeiraAba];

      const linhas: any[][] = XLSX.utils.sheet_to_json(planilha, { header: 1, defval: '' });

      if (linhas.length < 2) {
        setErroGeral('A planilha não tem linhas de dados abaixo do cabeçalho.');
        return;
      }

      const cabecalhosBrutos = (linhas[0] as any[]).map((c) => String(c ?? '').trim());
      const dados = linhas.slice(1).filter((l) => l.some((v) => String(v ?? '').trim() !== ''));

      setCabecalhos(cabecalhosBrutos);
      setLinhasBrutas(dados);
      setMapeamento(sugerirMapeamento(cabecalhosBrutos, tabelaEscolhida.campos));
      setEtapa('mapear');
    } catch {
      setErroGeral('Não consegui ler esse arquivo. Confirme se é um .xlsx válido.');
    }
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
    return camposDisponiveis.filter((c) => c.obrigatorio).every((c) => chavesMapeadas.has(c.chave));
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
        for (const { idx, chave } of colunasComMapa) {
          const valor = linha[idx];
          dados[chave] = typeof valor === 'string' ? valor.trim() : valor;
        }
        return { linhaOriginal: i + 2, dados };
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

      const revisao: LinhaRevisao[] = linhasMontadas.map(({ linhaOriginal, dados }) => {
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
          lote.forEach((l) => erros.push({ linha: l.linhaOriginal, motivo: error.message }));
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
        Traga clientes e outros cadastros do sistema antigo para cá, a partir de uma planilha .xlsx.
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
            <select
              className="w-full bg-gray-800 border border-gray-700 rounded-md p-2 text-sm"
              value={tabelaEscolhida?.tabela ?? ''}
              onChange={(e) => {
                const t = TABELAS_IMPORTAVEIS.find((x) => x.tabela === e.target.value) ?? null;
                setTabelaEscolhida(t);
              }}
            >
              <option value="">Selecione...</option>
              {TABELAS_IMPORTAVEIS.map((t) => (
                <option key={t.tabela} value={t.tabela}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {tabelaEscolhida && (
            <div>
              <label className="block text-sm font-medium mb-2">
                Planilha (.xlsx) exportada do sistema antigo
              </label>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleArquivo}
                className="block w-full text-sm text-gray-300 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-blue-600 file:text-white file:text-sm hover:file:bg-blue-500"
              />
              <p className="text-xs text-gray-500 mt-2">
                A primeira linha da planilha deve conter os nomes das colunas.
              </p>
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

          <div className="border border-gray-800 rounded-md divide-y divide-gray-800">
            {cabecalhos.map((coluna) => (
              <div key={coluna} className="flex items-center gap-3 p-3">
                <div className="w-1/2 text-sm text-gray-300 truncate">{coluna || '(sem nome)'}</div>
                <div className="w-1/2">
                  <select
                    className="w-full bg-gray-800 border border-gray-700 rounded-md p-1.5 text-sm"
                    value={mapeamento[coluna] ?? ''}
                    onChange={(e) => atualizarMapeamento(coluna, e.target.value)}
                  >
                    <option value="">Ignorar esta coluna</option>
                    {camposDisponiveis.map((campo) => (
                      <option key={campo.chave} value={campo.chave}>
                        {campo.label}
                        {campo.obrigatorio ? ' *' : ''}
                      </option>
                    ))}
                  </select>
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
