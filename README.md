# Catálogo de Cartas Gwent

Aplicação web em grupo que conecta três peças:

1. **API pública** [api.gwent.one](https://api.gwent.one/) — fonte dos dados (somente leitura);
2. **MongoDB**, banco NoSQL orientado a documentos, exposto como API REST pelo **RESTHeart**;
3. **Frontend** em HTML/CSS/JavaScript que importa as cartas, permite listar, buscar, filtrar, cadastrar, editar, favoritar e excluir, e mostra um **painel** calculado com os dados do banco.

**Tema:** catálogo de cartas do jogo **Gwent: The Witcher Card Game**.

## Integrantes e papéis

| Integrante | Papel |
|---|---|
| Alexsander Carlos de Lima | Infraestrutura (Docker, MongoDB, RESTHeart) |
| Gregory Guths | Modelo de dados e importação da API gwent.one |
| Renan Franco Ramos | Testes HTTP (Postman/Insomnia) e documentação |

## Tecnologias

- Docker e Docker Compose
- MongoDB (`mongo:latest`)
- RESTHeart (`softinstigate/restheart:latest`, versão 9.x; testado com a 9.12.1) — API REST sobre o MongoDB
- Frontend em HTML, CSS e JavaScript puros (módulos ES), **sem bibliotecas**: os gráficos são desenhados em SVG
- nginx (`nginx:alpine`) para servir o frontend no Docker
- Postman ou Insomnia (coleção em `testes/`) e `curl`

## Estrutura

```
gwent-catalogo/
├── .github/workflows/deploy.yml        # publica a pasta frontend/ no GitHub Pages a cada push na main
├── docker-compose.yml                  # MongoDB + RESTHeart + frontend (nginx)
├── frontend/                           # interface web (http://localhost:3000 e GitHub Pages)
│   ├── index.html
│   ├── css/estilos.css
│   └── js/
│       ├── config.js                   # valores padrão + escolha do arquivo de configuração do ambiente
│       ├── config.local.js             # RESTHeart local e credenciais acadêmicas (não é publicado)
│       ├── api.js                      # GET/POST/PUT/PATCH/DELETE no RESTHeart + tratamento de erros HTTP
│       ├── importador.js               # leitura da gwent.one, mapeamento para o modelo, gravação sem duplicatas
│       ├── painel.js                   # indicadores, gráficos, ranking e agrupamento
│       ├── app.js                      # listagem, busca, filtros, formulário, ações
│       └── util.js
├── dados/
│   └── carta-modelo.json               # modelo do documento (carta)
├── testes/
│   ├── gwent.postman_collection.json   # testes A-J (importável no Postman e no Insomnia)
│   └── executar-testes.ps1             # mesmos testes via curl (Windows/PowerShell)
├── ambiente-local/                     # alternativa sem Docker (Windows), mesmas portas
│   ├── iniciar.ps1                     # sobe mongod.exe (27017), restheart.exe (8080) e o frontend (3000)
│   ├── parar.ps1
│   ├── servidor-frontend.ps1           # servidor estático mínimo para a pasta frontend/
│   └── bin/                            # mongod.exe e restheart.exe (baixados, fora do git)
└── README.md
```

## Como funciona

```
Navegador (http://localhost:3000)
 ├── GET  https://api.gwent.one/?key=data&language=pt  → só quando o usuário clica em "Importar da API"
 └── GET/POST/PUT/PATCH/DELETE http://localhost:8080/gwent/cartas  (RESTHeart → MongoDB)
```

- O frontend é só um conjunto de arquivos estáticos. Ele **não tem proxy**: o navegador chama o RESTHeart direto.
- **CORS:** o RESTHeart 9 já responde com `Access-Control-Allow-Origin` para origens `http://localhost:*` e libera `Authorization`, `PUT`, `PATCH` e `DELETE` (conferido com uma requisição `OPTIONS`). A API gwent.one responde com `Access-Control-Allow-Origin: *`. Por isso nenhuma configuração extra foi necessária. Abra a aplicação por `http://localhost:3000`, e não por `127.0.0.1`, porque a liberação do RESTHeart vale para `localhost`.
- O painel e a listagem leem **sempre do banco**. A API pública só é chamada na importação.
- Toda criação, edição e exclusão acontece no banco local. A gwent.one é somente leitura.

## Containers e portas

| Serviço | Imagem | Porta | Observação |
|---|---|---|---|
| `mongodb` | `mongo:latest` | 27017 | dados persistidos no volume `mongo-data` |
| `restheart` | `softinstigate/restheart:latest` | 8080 | só sobe depois que o MongoDB responde ao healthcheck (`depends_on: service_healthy`) |
| `frontend` | `nginx:alpine` | 3000 | serve a pasta `frontend/` (montada só para leitura) |

### Configuração do RESTHeart (diferenças em relação ao enunciado)

Conferido na configuração padrão do RESTHeart 9 (`restheart-default-config.yml` do repositório oficial) e no log de inicialização da versão 9.12.1:

1. **`MONGO_URI` não é lida pelo RESTHeart 9.** A conexão é configurada pela variável `RHO` (RESTHeart Overrides): `/mclient/connection-string->"mongodb://mongodb:27017"`, onde `mongodb` é o nome do serviço na rede do Docker Compose. `MONGO_URI` foi mantida no compose apenas por compatibilidade com o enunciado.
2. **Mount padrão.** No RESTHeart 9, o padrão é `mongo-mounts: [{what: /restheart, where: /}]`. Assim, `PUT /gwent` criaria uma *coleção* `gwent` dentro do banco `restheart`, e não um banco. Para que `/gwent` seja o banco `gwent`, o compose sobrescreve: `/mongo/mongo-mounts[1]->{"what":"*","where":"/"}`.
3. `/http-listener/host->"0.0.0.0"` permite acessar a API de fora do container.

## Autenticação (ambiente acadêmico local)

Basic Auth — usuário **`admin`**, senha **`secret`**. É o usuário que o RESTHeart 9 cria por padrão (`create-user: true`, papel `admin`, que é o `root-role` do autorizador).

> **Somente para uso acadêmico local.** No desenvolvimento, o frontend lê essas credenciais de `frontend/js/config.local.js`, arquivo que **não é publicado** no GitHub Pages. No site publicado, o usuário digita o login numa janela, e ele fica guardado só naquela aba. Para produção ainda seria preciso um usuário com permissões mínimas, HTTPS e, de preferência, autenticação por token.

## Como iniciar e parar

### Com Docker (forma oficial)

```bash
docker compose up -d
docker compose ps
```

Abra **http://localhost:3000**. Para parar: `docker compose down` (os dados continuam no volume; `docker compose down -v` apaga o volume).

### Sem Docker (Windows)

Usado na máquina de desenvolvimento, onde o Docker não roda (veja "Por que os testes não rodaram no Docker"). Sobe os mesmos serviços, nas mesmas portas e com a mesma configuração do `docker-compose.yml`:

| Processo | Origem | Porta |
|---|---|---|
| `mongod.exe` | MongoDB Community 9.0.4, zip oficial (`fastdl.mongodb.org`, SHA-256 conferido) | 27017 |
| `restheart.exe` | RESTHeart 9.12.1, executável nativo oficial (`restheart-windows-amd64.exe` do GitHub da SoftInstigate). Não precisa de Java | 8080 |
| `servidor-frontend.ps1` | servidor estático em PowerShell (faz o papel do nginx) | 3000 |

```powershell
powershell -ExecutionPolicy Bypass -File ambiente-local\iniciar.ps1
powershell -ExecutionPolicy Bypass -File ambiente-local\parar.ps1
```

Os executáveis não estão no repositório (pasta `ambiente-local/bin/`, no `.gitignore`). Quem clonar precisa baixá-los das origens acima. Os dados do MongoDB ficam em `%LOCALAPPDATA%\GwentCatalogo\dados-mongo`, um caminho curto, porque o MongoDB (WiredTiger) falhou com `No such file or directory` quando a pasta de dados estava dentro de um caminho muito longo. Os logs ficam em `ambiente-local\logs\`.

## Publicação no GitHub Pages

O workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) publica **somente a pasta `frontend/`**, sem mover nem copiar arquivos no repositório.

**Endereço público:** **https://alexsandercl.github.io/gwent-catalogo/**

### 1. Habilitar o GitHub Pages (uma vez)

1. No GitHub, abra o repositório → **Settings** → **Pages**.
2. Em **Build and deployment** → **Source**, escolha **GitHub Actions**.

Não é preciso escolher branch nem pasta: quem define o que é publicado é o workflow. Faça isso **antes** do primeiro push com o workflow. Se o workflow rodar antes, o passo "Configurar o GitHub Pages" falha; nesse caso, habilite o Pages e rode de novo em **Actions** → **Publicar frontend no GitHub Pages** → **Run workflow**.

### 2. Como a publicação funciona

A cada `git push` na branch `main` (ou manualmente, em **Actions** → **Run workflow**), o workflow:

1. baixa o repositório (`actions/checkout@v7`) e prepara o Pages (`actions/configure-pages@v6`);
2. **remove `frontend/js/config.local.js`** (endereço e senha do ambiente local) e gera `frontend/js/config.producao.js`, só com o endereço do backend (veja abaixo). Se sobrar a palavra `secret` em `frontend/js`, o workflow para com erro;
3. envia a pasta `frontend/` (`actions/upload-pages-artifact@v5`, com `path: ./frontend`);
4. publica (`actions/deploy-pages@v5`) no ambiente `github-pages`, com as permissões `contents: read`, `pages: write` e `id-token: write`.

O processo não usa Docker e não precisa de nada rodando no seu computador. Essas alterações só acontecem na cópia temporária do GitHub Actions: o repositório não muda.

### 3. Onde acompanhar

Na aba **Actions** do repositório, abra a execução **Publicar frontend no GitHub Pages**. Quando termina com sucesso, o link do site aparece no resumo da execução e em **Settings** → **Pages**.

### 4. Caminhos

O site é servido em `/gwent-catalogo/`, e não na raiz do domínio. Todos os caminhos do frontend já são relativos (`css/estilos.css`, `js/app.js`, `import './api.js'`), e as imagens das cartas usam endereços completos da gwent.one, então nada precisou ser alterado para isso. Foi conferido numa simulação servida em `http://localhost:3001/gwent-catalogo/`: todos os arquivos carregaram com status 200 e sem erros no console.

### 5. O que funciona no site público e o que depende de backend

O GitHub Pages hospeda **apenas arquivos estáticos**: MongoDB e RESTHeart não rodam lá.

| Recurso | Depende de | No GitHub Pages hoje |
|---|---|---|
| Página, layout, busca e filtros (sobre as cartas carregadas) | só o navegador | abre, mas sem cartas para mostrar |
| Listagem e painel | RESTHeart/MongoDB (`GET`) | indisponível |
| Importar da API | api.gwent.one (`GET`) **e** RESTHeart (`POST`) para gravar | indisponível: o botão avisa e nem baixa a API |
| Cadastrar, editar, favoritar, excluir | RESTHeart (`POST`, `PUT`, `PATCH`, `DELETE`) | indisponível |

Sem backend configurado, o site mostra uma faixa avisando que é a "versão pública sem banco de dados", e o painel e o catálogo explicam o motivo, sem erros. Tudo continua funcionando localmente (Docker ou `ambiente-local`).

**Para ligar o site público a um banco**, quando houver um RESTHeart hospedado:

1. O backend precisa responder em **HTTPS**. O site é HTTPS, e o navegador bloqueia chamadas para um endereço HTTP.
2. O RESTHeart precisa liberar CORS para a origem `https://alexsandercl.github.io`. Por padrão ele só libera `http://localhost:*`.
3. No GitHub, crie a variável do repositório em **Settings** → **Secrets and variables** → **Actions** → aba **Variables** → **New repository variable**, com nome `BACKEND_URL` e o endereço da coleção (formato `https://<seu-backend>/gwent/cartas`). Ela não é secreta, porque fica visível no site.
4. Rode o workflow de novo. Ele gera `config.producao.js` com esse endereço.

A senha **nunca** vai para o código publicado: o site pede usuário e senha numa janela quando o banco exige login. Esse fluxo foi testado na simulação, com o `config.producao.js` apontando para o RESTHeart local: senha errada → `HTTP 401` e nova tentativa; senha certa → 44 cartas carregadas e favorito (PATCH) funcionando.

Nenhum backend hospedado foi configurado neste trabalho, então o site público hoje abre **sem banco**.

## Usando a aplicação

1. Abra **http://localhost:3000**.
2. Em **Cartas a importar**, escolha a quantidade (30 a 300; padrão 42) e clique em **Importar da API**.
3. Use a busca (nome ou categoria, sem diferenciar acentos), os filtros de facção, tipo e raridade, **Só favoritas** e a ordenação.
4. **+ Nova carta** abre o formulário de cadastro. **Editar** abre o mesmo formulário com a carta carregada do banco. A estrela marca ou desmarca a favorita. **Excluir** pede confirmação.

O formulário valida: nome com pelo menos 2 caracteres; facção, tipo e raridade obrigatórios; poder inteiro de 0 a 99; provisões de 0 a 30; armadura de 0 a 99; nota de 0 a 10; URL da imagem `http(s)`; e ID gwent.one inteiro e sem repetir outra carta.

Toda operação mostra carregamento, sucesso ou erro com o status HTTP (por exemplo, `Não encontrado (HTTP 404)`), e em seguida recarrega a lista e recalcula o painel.

## Importação da API pública

**Endpoint** (documentado em https://api.gwent.one/):

```
GET https://api.gwent.one/?key=data&language=pt
```

Resposta real (versão do jogo 14.10.0, 1381 cartas, cerca de 1,7 MB), resumida:

```json
{
  "request": { "status": 200, "message": "1381 rows returned", "REQUEST": { "language": "pt", "version": "14.10.0" } },
  "response": {
    "0": {
      "id": { "card": 112101, "art": 1007, "audio": 1207 },
      "attributes": { "set": "BaseSet", "type": "Unit", "color": "Gold", "rarity": "Legendary", "faction": "Neutral",
                      "power": 6, "provision": 9, "armor": 0, "reach": 0, "artist": "...", "factionSecondary": "" },
      "name": "Ciri", "category": "Bruxo",
      "ability": "...", "ability_html": "<span class=\"keyword deploy\">Mobilização</span>: ...",
      "keyword_html": "...", "flavor": "..."
    },
    "1": { "...": "..." }
  }
}
```

**Como a importação funciona** (`frontend/js/importador.js`):

1. Um único `GET` busca a lista completa em português. Se a API estiver fora do ar, responder erro HTTP ou mudar de formato, a tela mostra a mensagem e **nada é gravado**.
2. As cartas do conjunto `NonOwnable` (fichas criadas durante a partida, que não são colecionáveis) são descartadas.
3. A quantidade pedida é dividida igualmente entre as 7 facções. Dentro de cada facção, as cartas são escolhidas espalhadas pela lista ordenada por id, para misturar conjuntos e raridades. A escolha é determinística: a mesma quantidade sempre seleciona as mesmas cartas.
4. Antes de gravar, o importador lê o banco (`GET /gwent/cartas?pagesize=100`, todas as páginas) e monta o conjunto de `id_gwent_one` existentes. **Cartas que já existem são ignoradas**, o que preserva as edições da equipe e evita duplicatas em importações repetidas.
5. Cada carta nova é gravada com `POST /gwent/cartas`, com barra de progresso. No final aparece o resumo (novas, já existentes, erros).

**Mapeamento** — só campos que existem na resposta, mais os campos da equipe:

| Campo no banco | Origem na API |
|---|---|
| `id_gwent_one` | `id.card` |
| `nome` | `name` |
| `faccao`, `faccao_secundaria` | `attributes.faction`, `attributes.factionSecondary` (traduzidos: `Monster` → Monstros, `Northern Realms` → Reinos do Norte...) |
| `tipo`, `cor`, `raridade`, `conjunto` | `attributes.type`, `color`, `rarity`, `set` (traduzidos; `BaseSet` → Jogo Base) |
| `poder`, `provisoes`, `armadura` | `attributes.power`, `provision`, `armor` |
| `categorias` | `category`, separada por vírgula |
| `habilidades` | `ability_html`, uma linha por habilidade: a palavra-chave destacada vira `palavra_chave` e o resto vira `efeito` |
| `artista`, `citacao` | `attributes.artist`, `flavor` |
| `imagem` | `https://gwent.one/image/gwent/assets/card/art/low/{id.art}.jpg`, o mesmo endereço usado nas páginas do gwent.one |
| `fonte` | site, URL da carta, URL da API, versão do jogo, data da importação |
| `data_cadastro` | data e hora da importação (ISO 8601) |
| `favorito_equipe`, `nota` | campos da equipe (começam `false` e `null`) |

## Endpoints do banco e métodos HTTP

Base: `http://localhost:8080/gwent/cartas` · Basic Auth `admin` / `secret` · corpo `application/json`.

| Método | URL | Uso na aplicação | Sucesso |
|---|---|---|---|
| `GET` | `/gwent/cartas?pagesize=100&page=N` | listar todas as cartas (lista, filtros e painel) | 200 |
| `GET` | `/gwent/cartas/{id}` | carregar a versão atual da carta ao abrir **Editar** | 200 |
| `POST` | `/gwent/cartas` | importar da API e cadastrar pelo formulário | 201 |
| `PUT` | `/gwent/cartas/{id}` | salvar o formulário de edição (substitui o documento inteiro, mantendo campos que não aparecem no formulário, como `fonte` e `artista`) | 200 |
| `PATCH` | `/gwent/cartas/{id}` | marcar ou desmarcar favorita (`{"favorito_equipe": true}`) | 200 |
| `DELETE` | `/gwent/cartas/{id}` | excluir, depois de confirmação | 204 |

- `{id}` é o `_id` gerado pelo MongoDB. O RESTHeart o devolve como `{"$oid": "..."}`, e o frontend converte isso para o texto usado na URL.
- `_id` e `_etag` nunca são enviados no corpo: eles são controlados pelo banco.
- Erros tratados explicitamente: falha de conexão, 400, 401, 404, 409, 412, 500 e outros. A mensagem mostra o status e o detalhe devolvido pelo RESTHeart.

## Painel

Calculado no navegador a partir de **todos os documentos do banco** (`frontend/js/painel.js`). Ele é recalculado depois de toda importação, cadastro, edição, favorito ou exclusão.

| Item | Conteúdo |
|---|---|
| 6 indicadores | total de cartas, poder médio (só unidades), maior poder (com o nome da carta), % de favoritas, provisão média, nota média da equipe |
| Gráfico de barras | cartas por facção |
| Gráfico de rosca | cartas por raridade (com percentuais) |
| Ranking | Top 5 por poder (empate: mais provisões, depois nome) |
| Agrupamento | cartas por categoria (Humano, Guerreiro, Mago...) com contagens |

Valores ausentes são ignorados nas médias, e listas vazias mostram "—" ou "Sem dados", sem `NaN`.

### Conclusão possível a partir do painel

Com as 42 cartas importadas (6 por facção), o painel e os filtros mostram que **o custo das cartas cresce muito mais do que o poder**. As lendárias custam em média **10,9 provisões**, contra **4,2** das comuns, mas o poder médio das unidades lendárias é só **5,2**, contra **3,6** das comuns. Em média, uma lendária custa 2,6 vezes mais provisões que uma comum e tem só cerca de 1,4 vez o poder. Ou seja, no Gwent o valor das cartas raras está nas **habilidades**, e não no poder bruto, o que se confirma ao filtrar por "Lendária" e ler as habilidades. *(Números do banco em 07/11/2026; eles mudam conforme a equipe importa ou edita cartas.)*

## Modelo do documento JSON

Arquivo de referência: [`dados/carta-modelo.json`](dados/carta-modelo.json) (ID 112102, conferido no gwent.one). Um documento real gravado pela importação:

```json
{
  "id_gwent_one": 113313,
  "nome": "An Craite: Clamante",
  "faccao": "Skellige",
  "tipo": "Unidade",
  "cor": "Bronze",
  "raridade": "Comum",
  "conjunto": "Jogo Base",
  "poder": 4,
  "provisoes": 4,
  "armadura": 0,
  "categorias": ["Humano", "Guerreiro"],
  "habilidades": [
    { "palavra_chave": "Sede de Sangue 1", "efeito": "no fim do seu turno, reforça em 1 a si." }
  ],
  "artista": "Nemanja Stankovic",
  "citacao": "Qualquer homem, mulher e criança em Skellige consegue cortar um inimigo com um machado. Mas só um grupo seleto consegue cortar as orelhas do inimigo com um grito de fúria.",
  "imagem": "https://gwent.one/image/gwent/assets/card/art/low/1062.jpg",
  "fonte": {
    "site": "gwent.one",
    "url": "https://gwent.one/en/card/113313",
    "api": "https://api.gwent.one/?key=data&language=pt&id=113313",
    "versao_jogo": "14.10.0",
    "importado_em": "2026-11-07T21:13:17.663Z"
  },
  "data_cadastro": "2026-11-07T21:13:17.663Z",
  "favorito_equipe": false,
  "nota": null
}
```

**Dados embutidos:**
- `categorias` é uma **lista** de textos (as raças ou grupos da carta), usada na busca e no agrupamento do painel.
- `habilidades` é uma **lista de objetos**: cada habilidade separa a palavra-chave do jogo (Mobilização, Ordem, Sede de Sangue 1...) do efeito.
- `fonte` é um **objeto** que guarda a origem e a data da importação, para rastrear de onde veio cada carta.

Cartas cadastradas pelo formulário recebem `fonte: { "site": "cadastro manual da equipe" }`. Cartas editadas ganham `data_atualizacao`.

| Requisito | Atendido por |
|---|---|
| ≥ 6 campos | 19 campos na carta importada |
| Campo numérico | `poder`, `provisoes`, `armadura`, `nota`, `id_gwent_one` |
| Data ISO 8601 | `data_cadastro`, `fonte.importado_em`, `data_atualizacao` |
| Objeto/lista embutida | `fonte` (objeto), `categorias` (lista), `habilidades` (lista de objetos) |
| Campos da equipe | `favorito_equipe`, `nota` |

## Testes

Todas as requisições usam **Basic Auth `admin` / `secret`**.

| Teste | Método | URL | Body | Esperado |
|---|---|---|---|---|
| A — criar banco | `PUT` | `/gwent` | `{}` | `201` (`200` se já existir) |
| B — criar coleção | `PUT` | `/gwent/cartas` | vazio | `201` (`200` se já existir) |
| C — inserir carta | `POST` | `/gwent/cartas` | `dados/carta-modelo.json` | `201` + `Location` |
| D — listar cartas | `GET` | `/gwent/cartas?pagesize=100` | vazio | `200` |
| E — buscar por id | `GET` | URL do `Location` de C | vazio | `200` |
| F — substituir | `PUT` | URL de C | carta com `poder` 4 e `nota` 8 | `200` |
| G — alteração parcial | `PATCH` | URL de C | `{"favorito_equipe": false}` | `200` |
| H — conferir F e G | `GET` | URL de C | vazio | `200`, com poder 4, nota 8, favorito `false` e o nome preservado |
| I — excluir | `DELETE` | URL de C | vazio | `204` |
| J — conferir exclusão | `GET` | URL de C | vazio | `404` |

Os testes E–J usam **somente o documento criado no teste C** e o excluem no final, então não alteram nem apagam cartas já existentes no banco.

**curl (PowerShell)** — mostra cada status e termina com "Todos os testes passaram." (código de saída 0) ou com o número de falhas:

```powershell
powershell -ExecutionPolicy Bypass -File testes\executar-testes.ps1
```

**Postman/Insomnia:** importe `testes/gwent.postman_collection.json` e rode na ordem A → J. A autenticação já vem configurada, o teste C guarda a URL do documento na variável `cartaUrl`, e cada requisição verifica o status esperado.

## Resultados reais dos testes

### CRUD completo (07/11/2026)

`testes/executar-testes.ps1`, no ambiente local sem Docker (MongoDB 9.0.4 + RESTHeart 9.12.1), com 44 cartas no banco:

| Teste | Obtido |
|---|---|
| A, B | **200** (banco e coleção já existiam) |
| C | **201**, com `Location` |
| D | **200** |
| E | **200**, com `id_gwent_one` 112102 |
| F | **200** |
| G | **200** |
| H | **200**: poder 4, nota 8, `favorito_equipe` `false`, nome preservado |
| I | **204** |
| J | **404** |

Resultado: "Todos os testes passaram." O banco tinha 44 cartas antes e depois, sem resíduo dos testes. A coleção do Postman foi validada como JSON, mas **não foi executada no Postman** porque ele não estava instalado na máquina de testes. Ela faz as mesmas requisições do script.

### Aplicação no navegador (07/11/2026)

Verificado no navegador, com `http://localhost:3000`:
- importação de 42 cartas reais (de 1381 da API): 42 gravadas; **repetir a importação gravou 0 e manteve o total**;
- busca por categoria ("bruxo" → 3 cartas); filtro de facção combinado com busca por nome;
- favorito (PATCH): estrela ativa e painel de 2 para 3 favoritas;
- edição (GET por id + PUT): validação bloqueou nome vazio, poder 150, nota 11 e URL `ftp://`; salvar com dados válidos atualizou a carta e a nota média do painel, mantendo `fonte`, `artista` e `data_cadastro`;
- cadastro (POST): ID gwent.one repetido foi bloqueado; cadastro válido subiu o total de 44 para 45;
- exclusão (DELETE): **Cancelar** manteve a carta e **Excluir** removeu (total de 45 para 44);
- erros: com o RESTHeart desligado, aparece a mensagem de conexão e o botão "Tentar novamente", que recupera a tela depois de religar; 404 e 500 aparecem com status e detalhe;
- celular (375 px de largura): sem rolagem horizontal, com painel, cartões e formulário empilhados.

### Checkpoint de 26/10 (25/10/2026)

Com o banco vazio: **A 201, B 201, C 201, D 200**. Verificações extras: `GET /` sem autenticação → `401`; com `admin:secret` → `["gwent", "restheart"]` (ou seja, `gwent` é um **banco**).

### Por que os testes não rodaram no Docker

O `docker-compose.yml` (incluindo o serviço `frontend`) está pronto, mas **não pôde ser executado** na máquina de testes. Nela foram instalados o WSL 2 e o Docker Desktop 4.96.3, e o hypervisor foi ativado (`hypervisorlaunchtype auto`). Mesmo assim, o Windows instalado é uma versão modificada (XOS) da qual foram removidos arquivos da "Plataforma de Máquina Virtual" (`vmcompute.exe`, `vmwp.exe`, `vmchipset.dll`). Sem eles, o WSL 2 não cria a VM e o Docker Desktop responde `Virtual Machine Platform not enabled / No virtualization available`. Por isso, todos os testes foram feitos com a alternativa local, que usa as mesmas portas, a mesma configuração do RESTHeart e os mesmos arquivos do frontend. Em um computador com Docker funcionando, basta `docker compose up -d` e abrir `http://localhost:3000`.

## Uso de ferramentas de IA

A equipe usou o **Claude Code (Anthropic)** como assistente de programação durante o trabalho:

- **Ambiente:** diagnóstico de por que o Docker não rodava no Windows XOS e montagem da alternativa sem Docker (download dos binários oficiais, scripts `iniciar.ps1`, `parar.ps1` e `servidor-frontend.ps1`).
- **Configuração do RESTHeart:** leitura da configuração padrão da versão 9, que mostrou que `MONGO_URI` não é usada e que o mount padrão precisava ser alterado.
- **API pública:** leitura da documentação de api.gwent.one e análise da resposta real (formato, campos, valores), usada para definir o mapeamento.
- **Código:** escrita do frontend (`frontend/`), do importador, do painel, do `docker-compose.yml` e dos testes (`testes/`).
- **Publicação:** workflow do GitHub Pages, separação da configuração local (com senha) da publicada e simulação do site em `/gwent-catalogo/`.
- **Testes e documentação:** execução dos testes HTTP, testes da interface no navegador (inclusive na largura de celular) e redação deste README.

Todas as respostas da API e todos os resultados de teste registrados aqui vêm de execuções reais, e não de exemplos inventados.
