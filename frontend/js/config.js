// Configuracao do frontend: valores padrao + um arquivo por ambiente.
//  - Desenvolvimento (localhost, Docker ou ambiente-local): js/config.local.js, com o RESTHeart local e as
//    credenciais academicas. Esse arquivo NAO vai para o GitHub Pages: o workflow o remove antes da publicacao.
//  - GitHub Pages: js/config.producao.js, gerado pelo workflow a partir da variavel BACKEND_URL do repositorio.
//    Ele nunca contem senha: no site publicado o usuario digita o login quando o banco pede.
//    Sem BACKEND_URL, apiBanco fica null e o site publicado abre sem banco (import e CRUD indisponiveis).
const PADRAO = {
  apiBanco: null,        // ex.: 'http://localhost:8080/gwent/cartas'
  usuario: null,
  senha: null,
  tamanhoPagina: 100,

  // API publica de origem (somente leitura). Documentacao: https://api.gwent.one/
  apiGwent: 'https://api.gwent.one/',
  idiomaGwent: 'pt',
};

const emDesenvolvimento = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);

async function carregar(arquivo) {
  try {
    return (await import(arquivo)).default ?? {};
  } catch {
    return {}; // arquivo ausente: ficam os valores padrao
  }
}

export const CONFIG = { ...PADRAO, ...(await carregar(emDesenvolvimento ? './config.local.js' : './config.producao.js')) };
