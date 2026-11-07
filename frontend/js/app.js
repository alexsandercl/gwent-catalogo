import {
  ErroHttp, listarCartas, obterCarta, criarCarta, substituirCarta, atualizarParcialmente, excluirCarta,
  idDoDocumento, semCamposDoBanco,
} from './api.js';
import { importarCartas, OPCOES } from './importador.js';
import { renderizarPainel } from './painel.js';
import { escaparHtml, normalizar } from './util.js';

const $ = (sel) => document.querySelector(sel);

const estado = {
  cartas: [],        // documentos lidos do banco
  editando: null,    // documento original em edicao (null = nova carta)
};

// ---------- Avisos ----------
function aviso(tipo, texto, duracaoMs = 5000) {
  const el = document.createElement('div');
  el.className = `aviso ${tipo}`;
  el.textContent = texto;
  const fechar = document.createElement('button');
  fechar.type = 'button';
  fechar.className = 'fechar-aviso';
  fechar.setAttribute('aria-label', 'Fechar aviso');
  fechar.textContent = '×';
  fechar.addEventListener('click', () => el.remove());
  el.append(fechar);
  $('#avisos').append(el);
  if (duracaoMs) setTimeout(() => el.remove(), duracaoMs);
}

function mostrarEstado(html) {
  const el = $('#estado');
  el.hidden = !html;
  el.innerHTML = html || '';
}

// ---------- Carregamento ----------
async function recarregar() {
  if (!estado.cartas.length) mostrarEstado('<div class="carregando"><span class="giro"></span>Carregando cartas do banco…</div>');
  let falhou = false;
  try {
    estado.cartas = await listarCartas();
    mostrarEstado('');
  } catch (e) {
    falhou = true;
    estado.cartas = [];
    mostrarEstado(`<div class="erro-estado"><p>${escaparHtml(e.message)}</p><button type="button" class="botao" id="tentar-novamente">Tentar novamente</button></div>`);
    $('#tentar-novamente').addEventListener('click', recarregar);
  }
  preencherFiltros();
  renderizarLista();
  renderizarPainel(estado.cartas, document);
  if (falhou) $('#indicadores').innerHTML = '<p class="vazio-mini">Painel indisponível: não foi possível ler o banco.</p>';
}

// ---------- Filtros e listagem ----------
function preencherSelect(select, valores, rotuloVazio) {
  const atual = select.value;
  select.innerHTML = `<option value="">${rotuloVazio}</option>`
    + valores.map((v) => `<option value="${escaparHtml(v)}">${escaparHtml(v)}</option>`).join('');
  select.value = valores.includes(atual) ? atual : '';
}

function valoresDistintos(campo) {
  return [...new Set(estado.cartas.map((c) => c[campo]).filter((v) => v != null && v !== ''))]
    .sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'));
}

function preencherFiltros() {
  preencherSelect($('#filtro-faccao'), valoresDistintos('faccao'), 'Todas');
  preencherSelect($('#filtro-tipo'), valoresDistintos('tipo'), 'Todos');
  preencherSelect($('#filtro-raridade'), valoresDistintos('raridade'), 'Todas');
}

const ORDENACOES = {
  nome: (a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'),
  poder: (a, b) => (b.poder ?? -1) - (a.poder ?? -1),
  provisoes: (a, b) => (b.provisoes ?? -1) - (a.provisoes ?? -1),
  nota: (a, b) => (b.nota ?? -1) - (a.nota ?? -1),
  recentes: (a, b) => String(b.data_cadastro ?? '').localeCompare(String(a.data_cadastro ?? '')),
};

function cartasFiltradas() {
  const termo = normalizar($('#busca').value.trim());
  const faccao = $('#filtro-faccao').value;
  const tipo = $('#filtro-tipo').value;
  const raridade = $('#filtro-raridade').value;
  const soFavoritas = $('#filtro-favoritas').checked;
  return estado.cartas.filter((c) => {
    if (faccao && c.faccao !== faccao) return false;
    if (tipo && c.tipo !== tipo) return false;
    if (raridade && c.raridade !== raridade) return false;
    if (soFavoritas && c.favorito_equipe !== true) return false;
    if (!termo) return true;
    const categorias = Array.isArray(c.categorias) ? c.categorias.join(' ') : '';
    return normalizar(`${c.nome} ${categorias}`).includes(termo);
  }).sort((a, b) => ORDENACOES[$('#ordenar').value](a, b) || ORDENACOES.nome(a, b));
}

function htmlCarta(c) {
  const id = escaparHtml(idDoDocumento(c));
  const etiqueta = (v, classe = '') => (v ? `<span class="etiqueta ${classe}">${escaparHtml(v)}</span>` : '');
  const estat = (rotulo, v) => `<div><span>${rotulo}</span><strong>${typeof v === 'number' ? v.toLocaleString('pt-BR') : '—'}</strong></div>`;
  const categorias = Array.isArray(c.categorias) && c.categorias.length ? c.categorias.map(escaparHtml).join(', ') : 'Sem categoria';
  const imagem = c.imagem
    ? `<img src="${escaparHtml(c.imagem)}" alt="Arte da carta ${escaparHtml(c.nome)}" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'sem-imagem',textContent:'Imagem indisponível'}))">`
    : '<div class="sem-imagem">Sem imagem</div>';
  return `<article class="carta" data-id="${id}">
    <div class="carta-imagem">${imagem}
      <button type="button" class="favorito ${c.favorito_equipe ? 'ativo' : ''}" data-acao="favorito" data-id="${id}"
        aria-pressed="${c.favorito_equipe === true}" title="${c.favorito_equipe ? 'Desmarcar favorita' : 'Marcar como favorita'}">★</button>
    </div>
    <div class="carta-corpo">
      <h3>${escaparHtml(c.nome ?? '(sem nome)')}</h3>
      <div class="etiquetas">${etiqueta(c.faccao, 'faccao')}${etiqueta(c.tipo)}${etiqueta(c.raridade, 'raridade')}${etiqueta(c.cor)}</div>
      <div class="estatisticas">${estat('Poder', c.poder)}${estat('Provisões', c.provisoes)}${estat('Nota', c.nota)}</div>
      <p class="categorias">${categorias}</p>
      <div class="acoes-carta">
        <button type="button" class="botao" data-acao="editar" data-id="${id}">Editar</button>
        <button type="button" class="botao perigo-leve" data-acao="excluir" data-id="${id}">Excluir</button>
      </div>
    </div>
  </article>`;
}

function renderizarLista() {
  const lista = $('#lista');
  const visiveis = cartasFiltradas();
  $('#contagem').textContent = estado.cartas.length ? `Mostrando ${visiveis.length} de ${estado.cartas.length} carta(s)` : '';
  if (!$('#estado').hidden && !estado.cartas.length) { lista.innerHTML = ''; return; }
  if (!estado.cartas.length) {
    lista.innerHTML = '<div class="vazio">Nenhuma carta no banco ainda. Use <strong>Importar da API</strong> ou <strong>+ Nova carta</strong>.</div>';
  } else if (!visiveis.length) {
    lista.innerHTML = '<div class="vazio">Nenhuma carta corresponde à busca e aos filtros.</div>';
  } else {
    lista.innerHTML = visiveis.map(htmlCarta).join('');
  }
}

// ---------- Acoes nas cartas ----------
async function alternarFavorito(id, botao) {
  const carta = estado.cartas.find((c) => idDoDocumento(c) === id);
  if (!carta) return;
  botao.disabled = true;
  try {
    await atualizarParcialmente(id, { favorito_equipe: !carta.favorito_equipe }); // PATCH
    aviso('sucesso', carta.favorito_equipe ? `"${carta.nome}" saiu das favoritas.` : `"${carta.nome}" marcada como favorita.`);
  } catch (e) {
    aviso('erro', e.message, 8000);
  }
  await recarregar();
}

async function confirmarExclusao(id) {
  const carta = estado.cartas.find((c) => idDoDocumento(c) === id);
  if (!carta) return;
  const dialogo = $('#dialogo-confirmar');
  $('#texto-confirmar').textContent = `A carta "${carta.nome}" será removida do banco. Esta ação não pode ser desfeita.`;
  dialogo.returnValue = '';
  dialogo.showModal();
  dialogo.addEventListener('close', async () => {
    if (dialogo.returnValue !== 'confirmar') return;
    try {
      await excluirCarta(id); // DELETE
      aviso('sucesso', `"${carta.nome}" excluída.`);
    } catch (e) {
      aviso('erro', e instanceof ErroHttp && e.status === 404 ? `"${carta.nome}" já não existia no banco (HTTP 404).` : e.message, 8000);
    }
    await recarregar();
  }, { once: true });
}

// ---------- Formulario ----------
const form = $('#form-carta');

function preencherOpcoes(nome, valores, atual, obrigatorio) {
  const lista = atual && !valores.includes(atual) ? [...valores, atual] : valores;
  form.elements[nome].innerHTML = `<option value="">${obrigatorio ? 'Selecione…' : '—'}</option>`
    + lista.map((v) => `<option value="${escaparHtml(v)}">${escaparHtml(v)}</option>`).join('');
  form.elements[nome].value = atual ?? '';
}

function textoHabilidades(habilidades) {
  if (!Array.isArray(habilidades)) return '';
  return habilidades.map((h) => (h.palavra_chave ? `${h.palavra_chave}: ${h.efeito ?? ''}` : (h.efeito ?? ''))).join('\n');
}

function abrirFormulario(doc = null) {
  estado.editando = doc;
  form.reset();
  limparErros();
  $('#titulo-dialogo').textContent = doc ? `Editar: ${doc.nome}` : 'Nova carta';
  preencherOpcoes('faccao', OPCOES.faccao, doc?.faccao, true);
  preencherOpcoes('tipo', OPCOES.tipo, doc?.tipo, true);
  preencherOpcoes('raridade', OPCOES.raridade, doc?.raridade, true);
  preencherOpcoes('cor', OPCOES.cor, doc?.cor, false);
  if (doc) {
    for (const campo of ['nome', 'poder', 'provisoes', 'armadura', 'conjunto', 'imagem', 'id_gwent_one', 'nota']) {
      form.elements[campo].value = doc[campo] ?? '';
    }
    form.elements.categorias.value = Array.isArray(doc.categorias) ? doc.categorias.join(', ') : '';
    form.elements.habilidades.value = textoHabilidades(doc.habilidades);
    form.elements.favorito_equipe.checked = doc.favorito_equipe === true;
  }
  $('#dialogo-carta').showModal();
  form.elements.nome.focus();
}

function limparErros() {
  form.querySelectorAll('.erro-campo').forEach((el) => { el.textContent = ''; });
  form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
  $('#erro-form').hidden = true;
}

function lerNumero(campo) {
  const bruto = form.elements[campo].value.trim();
  return bruto === '' ? null : Number(bruto);
}

function validar() {
  const erros = {};
  const nome = form.elements.nome.value.trim();
  if (nome.length < 2) erros.nome = 'Informe o nome (mínimo 2 caracteres).';
  for (const campo of ['faccao', 'tipo', 'raridade']) {
    if (!form.elements[campo].value) erros[campo] = 'Campo obrigatório.';
  }
  const inteiro = (campo, min, max, obrigatorio) => {
    const v = lerNumero(campo);
    if (v == null) { if (obrigatorio) erros[campo] = 'Campo obrigatório.'; return; }
    if (!Number.isInteger(v) || v < min || v > max) erros[campo] = `Use um número inteiro entre ${min} e ${max}.`;
  };
  inteiro('poder', 0, 99, true);
  inteiro('provisoes', 0, 30, false);
  inteiro('armadura', 0, 99, false);
  inteiro('id_gwent_one', 1, 999999999, false);

  const nota = lerNumero('nota');
  if (nota != null && (!Number.isFinite(nota) || nota < 0 || nota > 10)) erros.nota = 'A nota deve ficar entre 0 e 10.';

  const idGwent = lerNumero('id_gwent_one');
  if (!erros.id_gwent_one && idGwent != null) {
    const idEditando = estado.editando ? idDoDocumento(estado.editando) : null;
    const outro = estado.cartas.find((c) => c.id_gwent_one === idGwent && idDoDocumento(c) !== idEditando);
    if (outro) erros.id_gwent_one = `Já existe a carta "${outro.nome}" com este ID.`;
  }

  const imagem = form.elements.imagem.value.trim();
  if (imagem) {
    try {
      if (!['http:', 'https:'].includes(new URL(imagem).protocol)) throw new Error();
    } catch { erros.imagem = 'Informe um endereço http(s) válido.'; }
  }
  return erros;
}

function mostrarErros(erros) {
  for (const [campo, msg] of Object.entries(erros)) {
    const el = form.elements[campo];
    el.setAttribute('aria-invalid', 'true');
    el.closest('label').querySelector('.erro-campo').textContent = msg;
  }
  form.elements[Object.keys(erros)[0]].focus();
}

function lerHabilidades() {
  return form.elements.habilidades.value.split('\n').map((l) => l.trim()).filter(Boolean).map((linha) => {
    const m = linha.match(/^([^:.]{1,40}):\s*(.+)$/);
    return m ? { palavra_chave: m[1].trim(), efeito: m[2].trim() } : { palavra_chave: null, efeito: linha };
  });
}

function documentoDoFormulario() {
  const agora = new Date().toISOString();
  const texto = (campo) => form.elements[campo].value.trim() || null;
  const campos = {
    nome: form.elements.nome.value.trim(),
    faccao: texto('faccao'),
    tipo: texto('tipo'),
    raridade: texto('raridade'),
    cor: texto('cor'),
    conjunto: texto('conjunto'),
    poder: lerNumero('poder'),
    provisoes: lerNumero('provisoes'),
    armadura: lerNumero('armadura'),
    categorias: form.elements.categorias.value.split(',').map((s) => s.trim()).filter(Boolean),
    habilidades: lerHabilidades(),
    imagem: texto('imagem'),
    id_gwent_one: lerNumero('id_gwent_one'),
    nota: lerNumero('nota'),
    favorito_equipe: form.elements.favorito_equipe.checked,
  };
  if (estado.editando) {
    // PUT substitui o documento inteiro: mantem os campos que nao aparecem no formulario (fonte, artista...)
    return { ...semCamposDoBanco(estado.editando), ...campos, data_atualizacao: agora };
  }
  return { ...campos, fonte: { site: 'cadastro manual da equipe' }, data_cadastro: agora };
}

form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  limparErros();
  const erros = validar();
  if (Object.keys(erros).length) { mostrarErros(erros); return; }

  const doc = documentoDoFormulario();
  const botao = $('#botao-salvar');
  botao.disabled = true;
  botao.textContent = 'Salvando…';
  try {
    if (estado.editando) {
      await substituirCarta(idDoDocumento(estado.editando), doc); // PUT
      aviso('sucesso', `"${doc.nome}" atualizada.`);
    } else {
      await criarCarta(doc); // POST
      aviso('sucesso', `"${doc.nome}" cadastrada.`);
    }
    $('#dialogo-carta').close();
    await recarregar();
  } catch (e) {
    $('#erro-form').textContent = e.message;
    $('#erro-form').hidden = false;
  } finally {
    botao.disabled = false;
    botao.textContent = 'Salvar';
  }
});

form.querySelector('[data-fechar]').addEventListener('click', () => $('#dialogo-carta').close());

async function editar(id) {
  try {
    abrirFormulario(await obterCarta(id)); // GET /gwent/cartas/{id}: edita sempre a versao atual do banco
  } catch (e) {
    aviso('erro', e instanceof ErroHttp && e.status === 404 ? 'Esta carta não existe mais no banco (HTTP 404).' : e.message, 8000);
    if (e instanceof ErroHttp && e.status === 404) await recarregar();
  }
}

// ---------- Importacao ----------
$('#form-importar').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const campo = $('#qtd-importar');
  const qtd = Number(campo.value);
  if (!Number.isInteger(qtd) || qtd < 30 || qtd > 300) {
    aviso('erro', 'Escolha um número inteiro de 30 a 300 cartas.');
    campo.focus();
    return;
  }
  const botao = $('#botao-importar');
  const progresso = $('#progresso-importar');
  botao.disabled = true;
  progresso.hidden = false;
  try {
    const r = await importarCartas(qtd, ({ etapa, atual, total }) => {
      $('#progresso-texto').textContent = total ? `${etapa} ${atual}/${total}` : etapa;
      $('#progresso-barra').style.width = total ? `${(atual / total) * 100}%` : '0%';
    });
    const resumo = `Importação concluída: ${r.inseridas} carta(s) nova(s) gravada(s), ${r.jaExistiam} já existia(m) no banco `
      + `(de ${r.selecionadas} selecionadas entre ${r.disponiveis} da API, versão do jogo ${r.versao ?? 'desconhecida'}).`;
    aviso(r.erros.length ? 'alerta' : 'sucesso', resumo, 10000);
    if (r.erros.length) {
      aviso('erro', `${r.erros.length} carta(s) não foram gravadas. Primeiro erro: ${r.erros[0].nome}: ${r.erros[0].mensagem}`, 12000);
    }
  } catch (e) {
    aviso('erro', e.message, 12000);
  } finally {
    botao.disabled = false;
    progresso.hidden = true;
    await recarregar();
  }
});

// ---------- Eventos gerais ----------
$('#lista').addEventListener('click', (ev) => {
  const botao = ev.target.closest('button[data-acao]');
  if (!botao) return;
  const { acao, id } = botao.dataset;
  if (acao === 'favorito') alternarFavorito(id, botao);
  if (acao === 'editar') editar(id);
  if (acao === 'excluir') confirmarExclusao(id);
});

for (const sel of ['#busca', '#filtro-faccao', '#filtro-tipo', '#filtro-raridade', '#ordenar', '#filtro-favoritas']) {
  $(sel).addEventListener('input', renderizarLista);
}
$('#botao-limpar').addEventListener('click', () => {
  $('#busca').value = '';
  for (const sel of ['#filtro-faccao', '#filtro-tipo', '#filtro-raridade']) $(sel).value = '';
  $('#ordenar').value = 'nome';
  $('#filtro-favoritas').checked = false;
  renderizarLista();
});
$('#botao-nova').addEventListener('click', () => abrirFormulario());

recarregar();
