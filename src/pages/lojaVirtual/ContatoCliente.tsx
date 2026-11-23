// "Falar com o cliente": monta a mensagem do pedido (itens, valores, recebimento, pagamento, andamento),
// deixa editar antes de enviar e abre o WhatsApp do cliente já com o texto pronto.
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { MessageCircle, Copy } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Modal } from '../../components/ui/Modal';

export type PedidoContato = {
  numero: number | null; cliente_nome: string; total: number | null; observacoes: string | null; cliente_id?: string | null;
  situacaoTexto: string; pagamentoTexto: string | null; vendaNumero: number | null; vendaStatus: string | null;
  /** Código de rastreio dos Correios (quando já foi postado) */
  codigoRastreio?: string | null;
};
type Item = { descricao: string; quantidade: number; total: number };

const brl = (v: number) => Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const linha = (obs: string | null, prefixo: string) => (obs ?? '').split('\n').find(l => l.startsWith(prefixo))?.slice(prefixo.length).trim() ?? '';

/** Telefone do pedido: o "Contato:" que o cliente informou no site; se não tiver, o cadastro do cliente. */
export async function telefoneDoPedido(p: Pick<PedidoContato, 'observacoes' | 'cliente_id'>): Promise<string> {
  const doSite = linha(p.observacoes, 'Contato: ').split('|')[0].replace(/\D/g, '');
  if (doSite.length >= 10) return doSite;
  if (p.cliente_id) {
    const { data } = await supabase.from('clientes').select('telefone').eq('id', p.cliente_id).maybeSingle();
    return String(data?.telefone ?? '').replace(/\D/g, '');
  }
  return '';
}

export function montarMensagemPedido(p: PedidoContato, itens: Item[]): string {
  const primeiro = (p.cliente_nome ?? '').trim().split(/\s+/)[0];
  const lista = itens.map(i => `• ${Number(i.quantidade)} × ${i.descricao} — ${brl(Number(i.total))}`).join('\n');
  const receb = linha(p.observacoes, 'Recebimento: ');
  const andamento = p.vendaNumero ? `Seu pedido já foi aprovado e está em andamento (venda nº ${p.vendaNumero}).` : `Situação: ${p.situacaoTexto}.`;
  return [
    `Olá${primeiro && primeiro !== 'Cliente' ? `, ${primeiro}` : ''}! Aqui é da Gráfica Master Print. 👋`,
    `Estou falando sobre o seu pedido nº ${p.numero ?? '—'} feito pelo nosso site:`,
    '',
    lista || '(itens do pedido)',
    '',
    `*Total: ${brl(Number(p.total ?? 0))}*`,
    receb ? `Recebimento: ${receb}` : '',
    p.pagamentoTexto ? `Pagamento: ${p.pagamentoTexto}` : '',
    andamento,
    '',
    'Qualquer dúvida sobre o pedido, é só responder por aqui. 😊',
  ].filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n');
}

export const LINK_LOJA = 'https://loja-master-print.vercel.app';

/** Aviso de envio: o cliente recebe o código e o link da página do pedido, com a linha do tempo dos Correios. */
export function montarMensagemEnvio(p: PedidoContato): string {
  const primeiro = (p.cliente_nome ?? '').trim().split(/\s+/)[0];
  return [
    `Olá${primeiro && primeiro !== 'Cliente' ? `, ${primeiro}` : ''}! Aqui é da Gráfica Master Print. 📦`,
    `O seu pedido nº ${p.numero ?? '—'} foi enviado pelos Correios!`,
    '',
    `Código de rastreio: *${p.codigoRastreio ?? ''}*`,
    '',
    'Acompanhe o andamento aqui (é só entrar com a sua conta):',
    `${LINK_LOJA}/pedidos/${p.numero ?? ''}`,
    '',
    'Qualquer dúvida, é só responder por aqui. 😊',
  ].join('\n');
}

export function ContatoClienteModal({ pedido, itens, aberto, onClose, modo = 'pedido' }: { pedido: PedidoContato | null; itens: Item[]; aberto: boolean; onClose: () => void; modo?: 'pedido' | 'envio' }) {
  const [texto, setTexto] = useState('');
  const [fone, setFone] = useState('');
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!aberto || !pedido) return;
    setTexto(modo === 'envio' ? montarMensagemEnvio(pedido) : montarMensagemPedido(pedido, itens));
    let vivo = true;
    telefoneDoPedido(pedido).then(t => { if (vivo) setFone(t); });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, pedido?.numero, itens.length, modo, pedido?.codigoRastreio]);

  // A caixa cresce e encolhe com o texto (sem barra de rolagem)
  useEffect(() => {
    const el = area.current;
    if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; }
  }, [texto, aberto]);

  function abrirWhatsApp() {
    const digitos = fone.replace(/\D/g, '');
    if (digitos.length < 10) { toast.error('Informe o telefone do cliente (DDD + número).'); return; }
    const comPais = digitos.length <= 11 ? `55${digitos}` : digitos;
    // Link direto da API (api.whatsapp.com) mantém acentos e emojis no computador
    window.open(`https://api.whatsapp.com/send?phone=${comPais}&text=${encodeURIComponent(texto)}`, '_blank');
  }
  async function copiar() {
    try { await navigator.clipboard.writeText(texto); toast.success('Mensagem copiada.'); } catch { toast.error('Não foi possível copiar.'); }
  }

  return (
    <Modal open={aberto} onClose={onClose} maxWidth="560px" title={`${modo === 'envio' ? 'Avisar envio' : 'Falar com o cliente'} — pedido #${pedido?.numero ?? ''}`}
      actions={
        <>
          <button onClick={copiar} className="px-3 py-2 rounded-lg text-sm font-bold text-gray-300 hover:text-white hover:bg-gray-700 flex items-center gap-1.5"><Copy className="w-4 h-4" /> Copiar</button>
          <button onClick={abrirWhatsApp} className="px-4 py-2 rounded-lg text-sm font-bold bg-green-600 hover:bg-green-500 text-white flex items-center gap-1.5"><MessageCircle className="w-4 h-4" /> Abrir no WhatsApp</button>
        </>
      }>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <label htmlFor="contato-fone" className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">WhatsApp</label>
          <input id="contato-fone" value={fone} onChange={e => setFone(e.target.value)} inputMode="tel" placeholder="DDD + número"
            className="!w-44 !py-1.5 bg-[#111827] border border-gray-700 rounded-lg text-white" />
          <span className="text-[11px] text-gray-500 truncate">{pedido?.cliente_nome}</span>
        </div>
        <div>
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Mensagem (pode editar antes de enviar)</p>
          <textarea ref={area} value={texto} onChange={e => setTexto(e.target.value)} rows={6}
            className="w-full resize-none overflow-hidden bg-[#111827] border border-gray-700 rounded-lg text-white leading-relaxed" />
        </div>
      </div>
    </Modal>
  );
}
