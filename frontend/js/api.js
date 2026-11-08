// Acesso ao banco: MongoDB exposto pelo RESTHeart em /gwent/cartas.
// Metodos usados: GET (listar/buscar), POST (criar/importar), PUT (substituir),
// PATCH (alteracao parcial) e DELETE (excluir).
import { CONFIG } from './config.js';

export class ErroHttp extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.name = 'ErroHttp';
    this.status = status; // 0 = falha de rede (sem resposta HTTP)
  }
}

const DESCRICAO_STATUS = {
  400: 'Requisição inválida',
  401: 'Não autorizado (confira usuário e senha)',
  403: 'Acesso negado',
  404: 'Não encontrado',
  405: 'Método não permitido',
  409: 'Conflito',
  412: 'Versão do documento desatualizada',
  415: 'Formato do corpo não suportado',
  500: 'Erro interno do servidor',
  503: 'Serviço indisponível',
};

export function mensagemDeStatus(status, detalhe) {
  const base = DESCRICAO_STATUS[status] || (status >= 500 ? 'Erro no servidor' : 'Falha na requisição');
  return `${base} (HTTP ${status})${detalhe ? `: ${detalhe}` : ''}`;
}

// false no GitHub Pages enquanto nenhum backend (variavel BACKEND_URL) estiver configurado
export const bancoConfigurado = Boolean(CONFIG.apiBanco);
export const MENSAGEM_SEM_BANCO = 'Esta versão do site não tem banco de dados configurado. A importação e o cadastro, a edição, '
  + 'os favoritos e a exclusão de cartas precisam do MongoDB/RESTHeart: rode o projeto localmente ou configure um backend hospedado (veja o README).';

// Credenciais: as do config.local.js (desenvolvimento) ou as digitadas pelo usuario,
// guardadas so nesta aba (sessionStorage). Nunca ficam no codigo publicado.
const CHAVE_LOGIN = 'gwent-catalogo-login';
let pedirLogin = async () => null;
export function definirPedidoDeLogin(funcao) { pedirLogin = funcao; }

function loginSalvo() {
  if (CONFIG.usuario) return { usuario: CONFIG.usuario, senha: CONFIG.senha ?? '', fixo: true };
  try { return JSON.parse(sessionStorage.getItem(CHAVE_LOGIN)); } catch { return null; }
}

function salvarLogin(login) {
  try {
    if (login) sessionStorage.setItem(CHAVE_LOGIN, JSON.stringify(login));
    else sessionStorage.removeItem(CHAVE_LOGIN);
  } catch { /* sem sessionStorage: o login vale so ate recarregar a pagina */ }
}

function cabecalhos(comCorpo, login) {
  // No-Auth-Challenge evita a janela de login do proprio navegador quando a resposta for 401
  const h = { 'No-Auth-Challenge': 'true' };
  if (login) h.Authorization = 'Basic ' + btoa(`${login.usuario}:${login.senha}`);
  if (comCorpo) h['Content-Type'] = 'application/json';
  return h;
}

async function requisitar(metodo, caminho = '', corpo, jaPediuLogin = false) {
  if (!bancoConfigurado) throw new ErroHttp(0, MENSAGEM_SEM_BANCO);
  let login = loginSalvo();
  if (!login && !jaPediuLogin) {
    login = await pedirLogin();
    if (!login) throw new ErroHttp(401, mensagemDeStatus(401, 'login cancelado'));
    salvarLogin(login);
    jaPediuLogin = true;
  }

  let resposta;
  try {
    resposta = await fetch(CONFIG.apiBanco + caminho, {
      method: metodo,
      headers: cabecalhos(corpo !== undefined, login),
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
  } catch {
    throw new ErroHttp(0, `Não foi possível conectar ao banco em ${CONFIG.apiBanco}. Verifique se o MongoDB e o RESTHeart estão rodando.`);
  }

  // Login digitado errado: esquece e pede de novo uma vez
  if (resposta.status === 401 && login && !login.fixo && !jaPediuLogin) {
    salvarLogin(null);
    return requisitar(metodo, caminho, corpo, false);
  }

  const texto = await resposta.text();
  let dados = null;
  if (texto) {
    try { dados = JSON.parse(texto); } catch { dados = texto; }
  }
  if (!resposta.ok) {
    if (resposta.status === 401 && login && !login.fixo) salvarLogin(null);
    const detalhe = dados && typeof dados === 'object' ? dados.message : null;
    throw new ErroHttp(resposta.status, mensagemDeStatus(resposta.status, detalhe));
  }
  return { status: resposta.status, dados };
}

// O RESTHeart devolve _id como {"$oid": "..."} para ObjectId; outros tipos vem como valor simples.
export function idDoDocumento(doc) {
  const id = doc && doc._id;
  if (id && typeof id === 'object' && '$oid' in id) return id.$oid;
  return id == null ? '' : String(id);
}

// _id e _etag sao controlados pelo banco e nunca sao enviados como campos editaveis.
export function semCamposDoBanco(doc) {
  const { _id, _etag, ...resto } = doc;
  return resto;
}

const caminhoDoc = (id) => '/' + encodeURIComponent(id);

// GET /gwent/cartas?pagesize=100 (percorre as paginas ate acabar)
export async function listarCartas() {
  const todas = [];
  for (let pagina = 1; ; pagina++) {
    const { dados } = await requisitar('GET', `?pagesize=${CONFIG.tamanhoPagina}&page=${pagina}`);
    if (!Array.isArray(dados)) throw new ErroHttp(200, 'Resposta inesperada do banco ao listar cartas.');
    todas.push(...dados);
    if (dados.length < CONFIG.tamanhoPagina) return todas;
  }
}

// GET /gwent/cartas/{id}
export async function obterCarta(id) {
  return (await requisitar('GET', caminhoDoc(id))).dados;
}

// POST /gwent/cartas
export async function criarCarta(doc) {
  return requisitar('POST', '', semCamposDoBanco(doc));
}

// PUT /gwent/cartas/{id}: substitui o documento inteiro
export async function substituirCarta(id, doc) {
  return requisitar('PUT', caminhoDoc(id), semCamposDoBanco(doc));
}

// PATCH /gwent/cartas/{id}: altera so os campos enviados
export async function atualizarParcialmente(id, campos) {
  return requisitar('PATCH', caminhoDoc(id), semCamposDoBanco(campos));
}

// DELETE /gwent/cartas/{id}
export async function excluirCarta(id) {
  return requisitar('DELETE', caminhoDoc(id));
}
