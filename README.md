# Catálogo de Cartas Gwent

Aplicação web em grupo que conecta uma **API pública** (fonte: [gwent.one](https://gwent.one)), um **banco NoSQL orientado a documentos** (MongoDB) exposto como API REST pelo **RESTHeart**, e (nas próximas etapas) um frontend com listagem, busca, filtros, formulários e painel de indicadores.

**Tema:** catálogo de cartas do jogo **Gwent** (gwent.one).

Este repositório contém a entrega do **checkpoint de 26/10**: ambiente Docker, modelo do documento JSON, criação do banco/coleção e importação/listagem funcionando via HTTP.

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
- Postman ou Insomnia (coleção em `testes/`) e `curl`

## Estrutura

```
gwent-catalogo/
├── docker-compose.yml                  # MongoDB + RESTHeart (forma oficial de rodar)
├── dados/
│   └── carta-modelo.json               # modelo do documento (carta)
├── testes/
│   ├── gwent.postman_collection.json   # testes A-D (importável no Postman e no Insomnia)
│   └── executar-testes.ps1             # mesmos testes via curl (Windows/PowerShell)
├── ambiente-local/                     # alternativa sem Docker (Windows), mesma API e portas
│   ├── iniciar.ps1                     # sobe mongod.exe (27017) e restheart.exe (8080)
│   ├── parar.ps1
│   └── bin/                            # mongod.exe e restheart.exe (baixados, fora do git)
└── README.md
```

## Containers e portas

| Serviço | Imagem | Porta | Observação |
|---|---|---|---|
| `mongodb` | `mongo:latest` | 27017 | dados persistidos no volume `mongo-data` |
| `restheart` | `softinstigate/restheart:latest` | 8080 | só sobe depois que o MongoDB responde ao healthcheck (`depends_on: service_healthy`) |

API: **http://localhost:8080/gwent**

### Configuração do RESTHeart (diferenças em relação ao enunciado)

Conferido na configuração padrão do RESTHeart 9 (`restheart-default-config.yml` do repositório oficial) e no log de inicialização da versão 9.12.1:

1. **`MONGO_URI` não é lida pelo RESTHeart 9.** A conexão é configurada pela variável `RHO` (RESTHeart Overrides): `/mclient/connection-string->"mongodb://mongodb:27017"`, onde `mongodb` é o nome do serviço na rede do Docker Compose. `MONGO_URI` foi mantida no compose apenas por compatibilidade com o enunciado.
2. **Mount padrão.** No RESTHeart 9, o padrão é `mongo-mounts: [{what: /restheart, where: /}]`. Assim, `PUT /gwent` criaria uma *coleção* `gwent` dentro do banco `restheart`, e não um banco. Para que `/gwent` seja o banco `gwent`, o compose sobrescreve: `/mongo/mongo-mounts[1]->{"what":"*","where":"/"}`.
3. `/http-listener/host->"0.0.0.0"` permite acessar a API de fora do container.

## Autenticação (ambiente acadêmico local)

Basic Auth — usuário **`admin`**, senha **`secret`**. É o usuário que o RESTHeart 9 cria por padrão (`create-user: true`, papel `admin`, que é o `root-role` do autorizador). Use essas credenciais apenas localmente.

## Como iniciar

Pré-requisito: Docker Desktop instalado e em execução.

```bash
docker compose up -d
docker compose ps
```

Aguarde o `gwent-restheart` ficar `running` (alguns segundos depois do MongoDB ficar `healthy`). Para parar: `docker compose down` (os dados continuam no volume; `docker compose down -v` apaga o volume).

### Alternativa sem Docker (Windows)

Usada quando o Docker não roda na máquina (veja "Resultados reais"). Sobe os mesmos serviços, nas mesmas portas e com a mesma configuração do `docker-compose.yml` (variável `RHO` idêntica, só que apontando para `127.0.0.1`):

| Processo | Origem | Porta |
|---|---|---|
| `mongod.exe` | MongoDB Community 9.0.4, zip oficial (`fastdl.mongodb.org`, SHA-256 conferido) | 27017 |
| `restheart.exe` | RESTHeart 9.12.1, executável nativo oficial (`restheart-windows-amd64.exe` do GitHub da SoftInstigate). Não precisa de Java | 8080 |

```powershell
powershell -ExecutionPolicy Bypass -File ambiente-local\iniciar.ps1
powershell -ExecutionPolicy Bypass -File ambiente-local\parar.ps1
```

Os dados do MongoDB ficam em `%LOCALAPPDATA%\GwentCatalogo\dados-mongo`. Ele usa um caminho curto porque o MongoDB (WiredTiger) falhou com `No such file or directory` quando a pasta de dados estava dentro de um caminho muito longo. Os logs ficam em `ambiente-local\logs\`.

## Modelo do documento JSON

Arquivo: [`dados/carta-modelo.json`](dados/carta-modelo.json). Dados da carta conferidos no gwent.one (ID 112102).

```json
{
  "id_gwent_one": 112102,
  "nome": "Geralt: Igni",
  "faccao": "Neutro",
  "tipo": "Unidade",
  "cor": "Ouro",
  "raridade": "Lendária",
  "conjunto": "Jogo Base",
  "poder": 3,
  "provisoes": 10,
  "armadura": 0,
  "categorias": ["Bruxo"],
  "habilidades": [
    { "palavra_chave": "Mobilizar", "efeito": "Destrua a(s) unidade(s) de maior poder em uma fileira inimiga com 40 ou mais de poder total." },
    { "palavra_chave": "Iniciativa", "efeito": "Em vez disso, destrua a(s) unidade(s) de maior poder em uma fileira inimiga com 25 ou mais de poder total." }
  ],
  "fonte": { "site": "gwent.one", "url": "https://gwent.one/en/card/112102" },
  "data_cadastro": "2026-10-26T10:00:00Z",
  "favorito_equipe": true,
  "nota": 9.5
}
```

| Requisito | Atendido por |
|---|---|
| ≥ 6 campos | 17 campos |
| Campo numérico | `poder`, `provisoes`, `armadura`, `nota`, `id_gwent_one` |
| Data ISO 8601 | `data_cadastro` |
| Objeto/lista embutida | `fonte` (objeto), `categorias` (lista), `habilidades` (lista de objetos) |
| Campos da equipe | `favorito_equipe`, `nota` |

## Roteiro de testes (A → D)

Todas as requisições usam **Basic Auth `admin` / `secret`**.

| Teste | Método | URL | Body | Esperado |
|---|---|---|---|---|
| A — criar banco | `PUT` | `http://localhost:8080/gwent` | `{}` | `201 Created` |
| B — criar coleção | `PUT` | `http://localhost:8080/gwent/cartas` | vazio | `201 Created` |
| C — inserir carta | `POST` | `http://localhost:8080/gwent/cartas` | `dados/carta-modelo.json` | `201 Created` |
| D — listar cartas | `GET` | `http://localhost:8080/gwent/cartas` | vazio | `200 OK` |

**Postman/Insomnia:** importe `testes/gwent.postman_collection.json` e execute na ordem A → D (a autenticação já vem configurada na coleção e cada requisição verifica o status esperado).

**curl (PowerShell):**

```powershell
powershell -ExecutionPolicy Bypass -File testes\executar-testes.ps1
```

Observações:
- Repetir A ou B com o recurso já existente devolve `200 OK` (atualização), não `201`. Para reproduzir os `201`, comece com o banco vazio (`docker compose down -v` e `up -d`).
- No teste C, o RESTHeart devolve corpo vazio e o cabeçalho `Location` com a URL do documento criado (`/gwent/cartas/<_id>`).

## Resultados reais dos testes

Executados em 25/10/2026 com `testes/executar-testes.ps1` (curl, Basic Auth `admin:secret`). O ambiente foi o **local sem Docker** (MongoDB 9.0.4 + RESTHeart 9.12.1), começando com o banco vazio.

| Teste | Requisição | Esperado | Obtido | Resposta |
|---|---|---|---|---|
| A | `PUT /gwent` body `{}` | 201 | **201 Created** | corpo vazio |
| B | `PUT /gwent/cartas` | 201 | **201 Created** | corpo vazio |
| C | `POST /gwent/cartas` body `carta-modelo.json` | 201 | **201 Created** | `Location: http://localhost:8080/gwent/cartas/6adebcd17bb2c5addf7282bb` |
| D | `GET /gwent/cartas` | 200 | **200 OK** | lista com a carta "Geralt: Igni", com `_id` e `_etag` gerados e todos os campos do modelo preservados (inclusive acentos, lista e objetos embutidos) |

Verificações extras:
- `GET /` sem autenticação → `401 Unauthorized`; com `admin:secret` → `200`, `["gwent", "restheart"]`. Ou seja, `gwent` foi criado como **banco**, não como coleção.
- `GET /gwent` → `["cartas"]`; `GET /gwent/cartas/_size` → `{"_size": 1}`.
- Repetir A e B com os recursos já existentes → `200 OK`.

### Por que os testes não rodaram no Docker

O `docker-compose.yml` está pronto, mas não pôde ser executado na máquina de testes. Nela foram instalados o WSL 2 e o Docker Desktop 4.96.3, e o hypervisor foi ativado (`hypervisorlaunchtype auto`). Mesmo assim, o Windows instalado é uma versão modificada (XOS) da qual foram removidos arquivos da "Plataforma de Máquina Virtual" (`vmcompute.exe`, `vmwp.exe`, `vmchipset.dll`). Sem eles, o WSL 2 não cria a VM e o Docker Desktop responde `Virtual Machine Platform not enabled / No virtualization available`. Por isso, os testes foram feitos com a alternativa local, que expõe a mesma API. Em qualquer computador com Docker funcionando, basta `docker compose up -d` e rodar os mesmos testes.
