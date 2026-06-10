// src/lib/trello.ts
//
// Wrapper para a API REST do Trello.
// Credenciais (api_key e token) são lidas do banco via RPC — nunca hardcoded.
// Todas as funções são async e lançam erros descritivos.

export interface TrelloCard {
  id: string;
  name: string;
  desc: string;
  idList: string;
  idBoard: string;
  due: string | null;
  url: string;
  labels: { id: string; name: string; color: string }[];
}

export interface TrelloList {
  id: string;
  name: string;
  idBoard: string;
}

export interface TrelloCredenciais {
  api_key: string;
  token: string;
}

const BASE = 'https://api.trello.com/1';

async function trelloFetch<T>(
  path: string,
  creds: TrelloCredenciais,
  options: RequestInit = {}
): Promise<T> {
  const sep = path.includes('?') ? '&' : '?';
  const url = `${BASE}${path}${sep}key=${creds.api_key}&token=${creds.token}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Trello API ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

// ── Listas ──────────────────────────────────────────────────────────────────

export async function getTrelloLists(
  boardId: string,
  creds: TrelloCredenciais
): Promise<TrelloList[]> {
  return trelloFetch<TrelloList[]>(`/boards/${boardId}/lists?fields=id,name`, creds);
}

// ── Cards ───────────────────────────────────────────────────────────────────

export async function getTrelloCards(
  listId: string,
  creds: TrelloCredenciais
): Promise<TrelloCard[]> {
  return trelloFetch<TrelloCard[]>(`/lists/${listId}/cards`, creds);
}

export async function criarTrelloCard(
  listId: string,
  card: { name: string; desc?: string; due?: string | null },
  creds: TrelloCredenciais
): Promise<TrelloCard> {
  const params = new URLSearchParams({
    idList: listId,
    name:   card.name,
    ...(card.desc ? { desc: card.desc } : {}),
    ...(card.due  ? { due: card.due }   : {}),
  });

  return trelloFetch<TrelloCard>(`/cards?${params}`, creds, { method: 'POST' });
}

export async function moverTrelloCard(
  cardId: string,
  novaListId: string,
  creds: TrelloCredenciais
): Promise<TrelloCard> {
  return trelloFetch<TrelloCard>(
    `/cards/${cardId}?idList=${novaListId}`,
    creds,
    { method: 'PUT' }
  );
}

export async function atualizarTrelloCard(
  cardId: string,
  updates: { name?: string; desc?: string; due?: string | null; idList?: string },
  creds: TrelloCredenciais
): Promise<TrelloCard> {
  const params = new URLSearchParams(
    Object.fromEntries(
      Object.entries(updates)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => [k, String(v)])
    )
  );

  return trelloFetch<TrelloCard>(`/cards/${cardId}?${params}`, creds, { method: 'PUT' });
}

export async function arquivarTrelloCard(
  cardId: string,
  creds: TrelloCredenciais
): Promise<void> {
  await trelloFetch(`/cards/${cardId}?closed=true`, creds, { method: 'PUT' });
}

// ── Mapeamento de etapas → listas Trello ────────────────────────────────────
// Lê os IDs das listas da tabela configuracoes

export interface TrelloListMap {
  fila:       string | null;
  impressao:  string | null;
  acabamento: string | null;
  pronto:     string | null;
}

export function etapaParaListaId(etapa: string, listMap: TrelloListMap): string | null {
  const mapa: Record<string, keyof TrelloListMap> = {
    fila:       'fila',
    arte:       'fila',        // arte vai para fila no Trello
    impressao:  'impressao',
    acabamento: 'acabamento',
    pronto:     'pronto',
    entregue:   'pronto',      // entregue arquiva o card
  };
  const key = mapa[etapa];
  return key ? listMap[key] : null;
}
