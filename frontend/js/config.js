// Configuracao do frontend.
// ATENCAO: credenciais do ambiente academico LOCAL (definidas no enunciado).
// Nao use este arranjo (senha fixa no navegador) em producao.
export const CONFIG = {
  // RESTHeart publicado pelo docker-compose (ou pelo ambiente-local) na porta 8080.
  // O RESTHeart libera CORS para http://localhost:* por padrao.
  apiBanco: 'http://localhost:8080/gwent/cartas',
  usuario: 'admin',
  senha: 'secret',
  tamanhoPagina: 100,

  // API publica de origem (somente leitura). Documentacao: https://api.gwent.one/
  apiGwent: 'https://api.gwent.one/',
  idiomaGwent: 'pt',
};
