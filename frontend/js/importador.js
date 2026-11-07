// Importacao sob demanda da API publica gwent.one (somente leitura) para o banco local.
// Endpoint: GET https://api.gwent.one/?key=data&language=pt
// Resposta: { request: { status, message, REQUEST: { version, ... } },
//             response: { "0": { id: {card, art, audio}, attributes: {...}, name, category,
//                                ability, ability_html, keyword_html, flavor }, "1": ... } }
import { CONFIG } from './config.js';
import { ErroHttp, mensagemDeStatus, criarCarta, listarCartas } from './api.js';

// Traducao dos codigos da API para os nomes usados no modelo (dados/carta-modelo.json).
// Valores fora destas tabelas sao gravados como vieram da API.
const FACCOES = {
  Neutral: 'Neutro', Monster: 'Monstros', Nilfgaard: 'Nilfgaard', 'Northern Realms': 'Reinos do Norte',
  Scoiatael: "Scoia'tael", Skellige: 'Skellige', Syndicate: 'Sindicato',
};
const TIPOS = { Unit: 'Unidade', Special: 'Especial', Artifact: 'Artefato', Stratagem: 'Estratagema', Ability: 'Habilidade de líder' };
const CORES = { Gold: 'Ouro', Bronze: 'Bronze', Leader: 'Líder' };
const RARIDADES = { Legendary: 'Lendária', Epic: 'Épica', Rare: 'Rara', Common: 'Comum' };
const CONJUNTOS = { BaseSet: 'Jogo Base' };

// Cartas "NonOwnable" sao fichas criadas durante a partida, nao cartas colecionaveis.
const CONJUNTOS_IGNORADOS = new Set(['NonOwnable']);

// Opcoes oferecidas no formulario de cadastro/edicao
export const OPCOES = {
  faccao: Object.values(FACCOES),
  tipo: Object.values(TIPOS),
  raridade: Object.values(RARIDADES),
  cor: Object.values(CORES),
};

const traduzir = (tabela, valor) => (valor in tabela ? tabela[valor] : valor);
const semTags = (html) => html.replace(/<[^>]*>/g, '').trim();

export async function buscarCartasDaApi() {
  const url = `${CONFIG.apiGwent}?key=data&language=${CONFIG.idiomaGwent}`;
  let resposta;
  try {
    resposta = await fetch(url);
  } catch {
    throw new ErroHttp(0, 'Não foi possível acessar a API gwent.one (sem conexão ou bloqueio de rede). Nada foi gravado.');
  }
  if (!resposta.ok) throw new ErroHttp(resposta.status, `API gwent.one: ${mensagemDeStatus(resposta.status)}. Nada foi gravado.`);

  let json;
  try { json = await resposta.json(); } catch {
    throw new Error('A API gwent.one respondeu algo que não é JSON. Nada foi gravado.');
  }
  if (!json || typeof json.response !== 'object' || json.response === null) {
    throw new Error('O formato da resposta da API gwent.one mudou (campo "response" ausente). Nada foi gravado.');
  }
  const cartas = Object.values(json.response).filter(cartaValida);
  if (cartas.length === 0) throw new Error('A API gwent.one não retornou cartas no formato esperado. Nada foi gravado.');
  return { cartas, versao: json.request?.REQUEST?.version ?? null, url };
}

function cartaValida(c) {
  return c && typeof c === 'object' && c.id && Number.isInteger(c.id.card)
    && typeof c.name === 'string' && c.name.trim() !== ''
    && c.attributes && typeof c.attributes === 'object';
}

// Escolhe cartas colecionaveis dividindo a quantidade igualmente entre as faccoes e, dentro de
// cada faccao, pegando cartas espalhadas pela lista ordenada por id (assim entram varios
// conjuntos e raridades, nao so as primeiras cartas lendarias).
// A selecao e deterministica: a mesma quantidade sempre escolhe as mesmas cartas.
export function selecionarCartas(cartas, quantidade) {
  const porFaccao = new Map();
  for (const c of cartas) {
    if (CONJUNTOS_IGNORADOS.has(c.attributes.set)) continue;
    const f = c.attributes.faction ?? '';
    if (!porFaccao.has(f)) porFaccao.set(f, []);
    porFaccao.get(f).push(c);
  }
  const filas = [...porFaccao.keys()].sort().map((f) => porFaccao.get(f).sort((a, b) => a.id.card - b.id.card));

  // Cotas por faccao em rodizio, respeitando o tamanho de cada uma
  const cotas = filas.map(() => 0);
  let restante = Math.min(quantidade, filas.reduce((s, f) => s + f.length, 0));
  while (restante > 0) {
    for (let i = 0; i < filas.length && restante > 0; i++) {
      if (cotas[i] < filas[i].length) { cotas[i]++; restante--; }
    }
  }
  return filas.flatMap((fila, i) => Array.from({ length: cotas[i] }, (_, k) => fila[Math.floor((k * fila.length) / cotas[i])]));
}

// "Mobilizacao: destroi..."       -> { palavra_chave: "Mobilizacao", efeito: "destroi..." }
// "Sede de Sangue 1: no fim..."   -> { palavra_chave: "Sede de Sangue 1", efeito: "no fim..." }
function extrairHabilidades(c) {
  const html = typeof c.ability_html === 'string' ? c.ability_html : '';
  return html.split('\n').map((linha) => linha.trim()).filter(Boolean).map((linha) => {
    const m = linha.match(/^<span class="keyword[^"]*">([^<]+)<\/span>([^:<]{0,10}):\s*(.*)$/);
    return m ? { palavra_chave: (m[1] + m[2]).replace(/:$/, '').trim(), efeito: semTags(m[3]) }
             : { palavra_chave: null, efeito: semTags(linha) };
  }).filter((h) => h.efeito || h.palavra_chave);
}

export function mapearCarta(c, versao, agoraIso) {
  const a = c.attributes;
  const numero = (v) => (Number.isFinite(v) ? v : null);
  const doc = {
    id_gwent_one: c.id.card,
    nome: c.name.trim(),
    faccao: traduzir(FACCOES, a.faction ?? null),
    tipo: traduzir(TIPOS, a.type ?? null),
    cor: traduzir(CORES, a.color ?? null),
    raridade: traduzir(RARIDADES, a.rarity ?? null),
    conjunto: traduzir(CONJUNTOS, a.set ?? null),
    poder: numero(a.power),
    provisoes: numero(a.provision),
    armadura: numero(a.armor),
    categorias: typeof c.category === 'string' ? c.category.split(',').map((s) => s.trim()).filter(Boolean) : [],
    habilidades: extrairHabilidades(c),
    artista: typeof a.artist === 'string' && a.artist.trim() ? a.artist.trim() : null,
    citacao: typeof c.flavor === 'string' && c.flavor.trim() ? c.flavor.trim() : null,
    imagem: Number.isInteger(c.id.art) ? `https://gwent.one/image/gwent/assets/card/art/low/${c.id.art}.jpg` : null,
    fonte: {
      site: 'gwent.one',
      url: `https://gwent.one/en/card/${c.id.card}`,
      api: `${CONFIG.apiGwent}?key=data&language=${CONFIG.idiomaGwent}&id=${c.id.card}`,
      versao_jogo: versao,
      importado_em: agoraIso,
    },
    data_cadastro: agoraIso,
    favorito_equipe: false,
    nota: null,
  };
  if (a.factionSecondary) doc.faccao_secundaria = traduzir(FACCOES, a.factionSecondary);
  return doc;
}

// Busca na API, compara com o banco por id_gwent_one e grava (POST) so as cartas novas.
export async function importarCartas(quantidade, aoProgredir = () => {}) {
  aoProgredir({ etapa: 'Buscando cartas na API gwent.one…' });
  const { cartas, versao } = await buscarCartasDaApi();
  const selecionadas = selecionarCartas(cartas, quantidade);

  aoProgredir({ etapa: 'Conferindo cartas já existentes no banco…' });
  const existentes = new Set((await listarCartas()).map((d) => d.id_gwent_one).filter((v) => v != null));

  const agoraIso = new Date().toISOString();
  const resultado = { disponiveis: cartas.length, selecionadas: selecionadas.length, inseridas: 0, jaExistiam: 0, erros: [], versao };
  for (const [i, c] of selecionadas.entries()) {
    aoProgredir({ etapa: 'Gravando no banco…', atual: i + 1, total: selecionadas.length });
    if (existentes.has(c.id.card)) { resultado.jaExistiam++; continue; }
    try {
      await criarCarta(mapearCarta(c, versao, agoraIso));
      existentes.add(c.id.card);
      resultado.inseridas++;
    } catch (e) {
      resultado.erros.push({ nome: c.name, mensagem: e.message });
      if (e instanceof ErroHttp && (e.status === 0 || e.status === 401)) break; // nao adianta continuar
    }
  }
  return resultado;
}
