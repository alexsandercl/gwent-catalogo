// Desenvolvimento local (docker-compose ou ambiente-local). NAO e publicado no GitHub Pages:
// o workflow .github/workflows/deploy.yml remove este arquivo antes de enviar a pasta frontend/.
// ATENCAO: credenciais do ambiente academico LOCAL definidas no enunciado; nao use em producao.
// O RESTHeart libera CORS para http://localhost:* por padrao.
export default {
  apiBanco: 'http://localhost:8080/gwent/cartas',
  usuario: 'admin',
  senha: 'secret',
};
