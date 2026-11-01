// src/lib/versiculos.ts
//
// Versículos do "Versículo do dia" (Dashboard). Um por dia, o mesmo para todo
// mundo, trocando à meia-noite (horário local). Para acrescentar, trocar ou
// corrigir o texto de algum, é só editar esta lista — a ordem do ano se ajusta sozinha.
// Texto no estilo da tradução Almeida; pequenas diferenças de redação em relação
// à sua Bíblia são normais.

export interface Versiculo { texto: string; ref: string; }

const BASE: Versiculo[] = [
  { ref: 'Provérbios 16:3',  texto: 'Entrega ao Senhor as tuas obras, e teus pensamentos serão estabelecidos.' },
  { ref: 'Salmos 37:5',      texto: 'Entrega o teu caminho ao Senhor; confia nele, e ele o fará.' },
  { ref: 'Filipenses 4:13',  texto: 'Posso todas as coisas em Cristo que me fortalece.' },
  { ref: 'Josué 1:9',        texto: 'Não to mandei eu? Esforça-te, e tem bom ânimo; não pasmes, nem te espantes, porque o Senhor teu Deus é contigo, por onde quer que andares.' },
  { ref: 'Salmos 23:1',      texto: 'O Senhor é o meu pastor, nada me faltará.' },
  { ref: 'Isaías 41:10',     texto: 'Não temas, porque eu sou contigo; não te assombres, porque eu sou o teu Deus; eu te fortaleço, e te ajudo, e te sustento com a destra da minha justiça.' },
  { ref: 'Provérbios 3:5-6', texto: 'Confia no Senhor de todo o teu coração, e não te estribes no teu próprio entendimento. Reconhece-o em todos os teus caminhos, e ele endireitará as tuas veredas.' },
  { ref: 'Jeremias 29:11',   texto: 'Porque eu bem sei os pensamentos que tenho a vosso respeito, diz o Senhor; pensamentos de paz, e não de mal, para vos dar o fim que esperais.' },
  { ref: 'Romanos 8:28',     texto: 'E sabemos que todas as coisas contribuem juntamente para o bem daqueles que amam a Deus.' },
  { ref: 'Mateus 6:33',      texto: 'Mas, buscai primeiro o reino de Deus, e a sua justiça, e todas estas coisas vos serão acrescentadas.' },
  { ref: 'Salmos 121:1-2',   texto: 'Elevo os meus olhos para os montes, de onde vem o meu socorro. O meu socorro vem do Senhor, que fez os céus e a terra.' },
  { ref: 'Provérbios 22:29', texto: 'Viste um homem diligente na sua obra? Perante reis será posto; não permanecerá entre os de posição baixa.' },
  { ref: 'Provérbios 10:4',  texto: 'O que trabalha com mão remissa empobrece, mas a mão dos diligentes enriquece.' },
  { ref: 'Colossenses 3:23', texto: 'E tudo quanto fizerdes, fazei-o de todo o coração, como ao Senhor, e não aos homens.' },
  { ref: 'Isaías 40:31',     texto: 'Mas os que esperam no Senhor renovarão as suas forças, subirão com asas como águias; correrão, e não se cansarão; caminharão, e não se fatigarão.' },
  { ref: 'Salmos 46:1',      texto: 'Deus é o nosso refúgio e fortaleza, socorro bem presente na angústia.' },
  { ref: '2 Timóteo 1:7',    texto: 'Porque Deus não nos deu o espírito de temor, mas de fortaleza, e de amor, e de moderação.' },
  { ref: 'Mateus 11:28',     texto: 'Vinde a mim, todos os que estais cansados e oprimidos, e eu vos aliviarei.' },
  { ref: 'Salmos 118:24',    texto: 'Este é o dia que fez o Senhor; regozijemo-nos e alegremo-nos nele.' },
  { ref: 'Lamentações 3:22-23', texto: 'As misericórdias do Senhor são a causa de não sermos consumidos, porque as suas misericórdias não têm fim; novas são cada manhã; grande é a tua fidelidade.' },
  { ref: 'Provérbios 4:23',  texto: 'Sobre tudo o que se deve guardar, guarda o teu coração, porque dele procedem as saídas da vida.' },
  { ref: 'Gálatas 6:9',      texto: 'E não nos cansemos de fazer bem, porque a seu tempo ceifaremos, se não houvermos desfalecido.' },
  { ref: '1 Coríntios 15:58', texto: 'Portanto, meus amados irmãos, sede firmes e constantes, sempre abundantes na obra do Senhor, sabendo que o vosso trabalho não é vão no Senhor.' },
  { ref: 'Salmos 127:1',     texto: 'Se o Senhor não edificar a casa, em vão trabalham os que a edificam.' },
  { ref: 'Provérbios 15:22', texto: 'Onde não há conselho os pensamentos se dissipam, mas com a multidão de conselheiros se estabelecem.' },
  { ref: 'Tiago 1:5',        texto: 'E, se algum de vós tem falta de sabedoria, peça-a a Deus, que a todos dá liberalmente, e o não lança em rosto, e ser-lhe-á dada.' },
  { ref: 'Salmos 34:8',      texto: 'Provai, e vede que o Senhor é bom; bem-aventurado o homem que nele confia.' },
  { ref: 'Mateus 5:16',      texto: 'Assim resplandeça a vossa luz diante dos homens, para que vejam as vossas boas obras, e glorifiquem a vosso Pai, que está nos céus.' },
  { ref: 'Deuteronômio 31:6', texto: 'Esforçai-vos, e tende bom ânimo; não temais, nem tenhais medo deles; porque o Senhor teu Deus é o que vai contigo; não te deixará, nem te desamparará.' },
  { ref: 'Salmos 28:7',      texto: 'O Senhor é a minha força e o meu escudo; nele confiou o meu coração, e fui socorrido.' },
  { ref: 'Romanos 12:12',    texto: 'Alegres na esperança, fortes na tribulação, perseverantes na oração.' },
  { ref: 'Hebreus 11:1',     texto: 'Ora, a fé é o firme fundamento das coisas que se esperam, e a prova das coisas que se não veem.' },
  { ref: 'João 14:27',       texto: 'Deixo-vos a paz, a minha paz vos dou; não a dou como o mundo a dá. Não se turbe o vosso coração, nem se atemorize.' },
  { ref: 'Provérbios 11:25', texto: 'A alma generosa será prosperada, e quem regar também será regado.' },
  { ref: 'Salmos 1:3',       texto: 'Pois será como a árvore plantada junto a ribeiros de águas, a qual dá o seu fruto na estação própria; as suas folhas não cairão, e tudo quanto fizer prosperará.' },
  { ref: 'Provérbios 12:24', texto: 'A mão dos diligentes dominará, mas o remisso será tributário.' },
  { ref: 'Neemias 8:10',     texto: 'Porque a alegria do Senhor é a vossa força.' },
  { ref: 'Marcos 9:23',      texto: 'Jesus disse-lhe: Se tu podes crer, tudo é possível ao que crê.' },
  { ref: 'Mateus 7:7',       texto: 'Pedi, e dar-se-vos-á; buscai, e encontrareis; batei, e abrir-se-vos-á.' },
  { ref: '1 Pedro 5:7',      texto: 'Lançando sobre ele toda a vossa ansiedade, porque ele tem cuidado de vós.' },
  { ref: 'Salmos 55:22',     texto: 'Lança o teu cuidado sobre o Senhor, e ele te susterá; nunca permitirá que o justo seja abalado.' },
  { ref: 'Filipenses 4:19',  texto: 'O meu Deus, segundo as suas riquezas, suprirá todas as vossas necessidades em glória, por Cristo Jesus.' },
  { ref: 'Provérbios 16:9',  texto: 'O coração do homem planeja o seu caminho, mas o Senhor lhe dirige os passos.' },
  { ref: 'Provérbios 19:21', texto: 'Muitos propósitos há no coração do homem, mas o conselho do Senhor permanecerá.' },
  { ref: 'Deuteronômio 8:18', texto: 'Antes te lembrarás do Senhor teu Deus, porque é ele o que te dá força para adquirires riqueza.' },
];

// Lista completa = base + extras, sem repetir a mesma referência.
import { VERSICULOS_EXTRA } from './versiculos_extra';
export const VERSICULOS: Versiculo[] = (() => {
  const vistos = new Set<string>();
  return [...BASE, ...VERSICULOS_EXTRA].filter(v => (vistos.has(v.ref) ? false : (vistos.add(v.ref), true)));
})();

/** Versículo do dia: troca à meia-noite (data local), igual para todos os usuários. */
export function versiculoDoDia(hoje: Date = new Date()): Versiculo {
  const dias = Math.floor(Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()) / 86400000);
  return VERSICULOS[((dias % VERSICULOS.length) + VERSICULOS.length) % VERSICULOS.length];
}
