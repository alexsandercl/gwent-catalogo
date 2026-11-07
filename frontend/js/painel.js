// Painel calculado no navegador a partir dos documentos lidos do MongoDB (nunca da API publica).
import { escaparHtml } from './util.js';

const CORES_FACCAO = {
  Monstros: '#c0392b', Nilfgaard: '#d4a72c', 'Reinos do Norte': '#2e6fd8', "Scoia'tael": '#3f9b4b',
  Skellige: '#7d4fc4', Sindicato: '#e07b24', Neutro: '#8b8173',
};
const CORES_RARIDADE = { Lendária: '#e0a526', Épica: '#9b59d0', Rara: '#3a86d4', Comum: '#9aa3ad' };
const COR_RESERVA = ['#4db6ac', '#f06292', '#a1887f', '#90a4ae', '#ffb74d', '#81c784'];

const numero = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const media = (valores) => (valores.length ? valores.reduce((s, v) => s + v, 0) / valores.length : null);
const fmt = (v, casas = 1) => (v == null ? '—' : v.toLocaleString('pt-BR', { maximumFractionDigits: casas, minimumFractionDigits: 0 }));

function contar(cartas, chave) {
  const mapa = new Map();
  for (const c of cartas) {
    const valores = Array.isArray(chave(c)) ? chave(c) : [chave(c)];
    for (const v of valores) {
      const rotulo = v == null || v === '' ? 'Não informado' : String(v);
      mapa.set(rotulo, (mapa.get(rotulo) || 0) + 1);
    }
  }
  return [...mapa.entries()].map(([rotulo, total]) => ({ rotulo, total }))
    .sort((a, b) => b.total - a.total || a.rotulo.localeCompare(b.rotulo, 'pt-BR'));
}

export function calcularPainel(cartas) {
  const poderes = cartas.filter((c) => c.tipo === 'Unidade').map((c) => numero(c.poder)).filter((v) => v != null);
  const provisoes = cartas.map((c) => numero(c.provisoes)).filter((v) => v != null);
  const notas = cartas.map((c) => numero(c.nota)).filter((v) => v != null);
  const comPoder = cartas.filter((c) => numero(c.poder) != null);
  const maisForte = comPoder.reduce((m, c) => (!m || c.poder > m.poder ? c : m), null);
  const favoritas = cartas.filter((c) => c.favorito_equipe === true).length;

  return {
    total: cartas.length,
    poderMedio: media(poderes),
    maiorPoder: maisForte ? { valor: maisForte.poder, nome: maisForte.nome } : null,
    percentualFavoritas: cartas.length ? (favoritas / cartas.length) * 100 : null,
    favoritas,
    provisaoMedia: media(provisoes),
    notaMedia: media(notas),
    avaliadas: notas.length,
    porFaccao: contar(cartas, (c) => c.faccao),
    porRaridade: contar(cartas, (c) => c.raridade),
    porCategoria: contar(cartas, (c) => (Array.isArray(c.categorias) && c.categorias.length ? c.categorias : null)),
    ranking: [...comPoder].sort((a, b) => b.poder - a.poder
      || (numero(b.provisoes) ?? -1) - (numero(a.provisoes) ?? -1)
      || String(a.nome).localeCompare(String(b.nome), 'pt-BR')).slice(0, 5),
  };
}

function corDe(tabela, rotulo, i) {
  return tabela[rotulo] || COR_RESERVA[i % COR_RESERVA.length];
}

function graficoBarras(itens) {
  if (!itens.length) return '<p class="vazio-mini">Sem dados.</p>';
  const max = Math.max(...itens.map((i) => i.total));
  const altLinha = 30;
  const largRotulo = 120;
  const largBarra = 220;
  const alt = itens.length * altLinha;
  const linhas = itens.map((it, i) => {
    const y = i * altLinha;
    const w = Math.max(2, (it.total / max) * largBarra);
    return `<g>
      <text x="${largRotulo - 8}" y="${y + 19}" text-anchor="end" class="g-rotulo">${escaparHtml(it.rotulo)}</text>
      <rect x="${largRotulo}" y="${y + 6}" width="${w}" height="18" rx="4" fill="${corDe(CORES_FACCAO, it.rotulo, i)}"><title>${escaparHtml(it.rotulo)}: ${it.total}</title></rect>
      <text x="${largRotulo + w + 6}" y="${y + 19}" class="g-valor">${it.total}</text>
    </g>`;
  }).join('');
  return `<svg viewBox="0 0 ${largRotulo + largBarra + 40} ${alt}" role="img" aria-label="Cartas por facção">${linhas}</svg>`;
}

function graficoRosca(itens) {
  if (!itens.length) return '<p class="vazio-mini">Sem dados.</p>';
  const total = itens.reduce((s, i) => s + i.total, 0);
  const r = 60, cx = 80, cy = 80, esp = 26;
  const circ = 2 * Math.PI * r;
  let acumulado = 0;
  const fatias = itens.map((it, i) => {
    const frac = it.total / total;
    const seg = `<circle r="${r}" cx="${cx}" cy="${cy}" fill="none" stroke="${corDe(CORES_RARIDADE, it.rotulo, i)}" stroke-width="${esp}"
      stroke-dasharray="${frac * circ} ${circ}" stroke-dashoffset="${-acumulado * circ}" transform="rotate(-90 ${cx} ${cy})"><title>${escaparHtml(it.rotulo)}: ${it.total}</title></circle>`;
    acumulado += frac;
    return seg;
  }).join('');
  const legenda = itens.map((it, i) => `<li><span class="bolinha" style="background:${corDe(CORES_RARIDADE, it.rotulo, i)}"></span>${escaparHtml(it.rotulo)} <strong>${it.total}</strong> <small>(${fmt((it.total / total) * 100, 0)}%)</small></li>`).join('');
  return `<div class="rosca">
    <svg viewBox="0 0 160 160" role="img" aria-label="Cartas por raridade">${fatias}
      <text x="${cx}" y="${cy - 2}" text-anchor="middle" class="g-centro">${total}</text>
      <text x="${cx}" y="${cy + 16}" text-anchor="middle" class="g-rotulo">cartas</text>
    </svg><ul class="legenda">${legenda}</ul></div>`;
}

export function renderizarPainel(cartas, raiz) {
  const p = calcularPainel(cartas);
  const ind = (titulo, valor, detalhe = '') => `<div class="indicador"><span class="ind-titulo">${titulo}</span><strong class="ind-valor">${valor}</strong><span class="ind-detalhe">${detalhe}</span></div>`;

  raiz.querySelector('#indicadores').innerHTML = [
    ind('Total de cartas', fmt(p.total, 0), 'no banco'),
    ind('Poder médio', fmt(p.poderMedio), 'só unidades'),
    ind('Maior poder', p.maiorPoder ? fmt(p.maiorPoder.valor, 0) : '—', p.maiorPoder ? escaparHtml(p.maiorPoder.nome) : 'sem dados'),
    ind('Favoritas', p.percentualFavoritas == null ? '—' : `${fmt(p.percentualFavoritas)}%`, `${p.favoritas} de ${p.total}`),
    ind('Provisão média', fmt(p.provisaoMedia), 'custo para montar o deck'),
    ind('Nota média', fmt(p.notaMedia), `${p.avaliadas} avaliada(s) pela equipe`),
  ].join('');

  raiz.querySelector('#grafico-faccao').innerHTML = graficoBarras(p.porFaccao);
  raiz.querySelector('#grafico-raridade').innerHTML = graficoRosca(p.porRaridade);

  raiz.querySelector('#ranking').innerHTML = p.ranking.length
    ? p.ranking.map((c, i) => `<li><span class="pos">${i + 1}º</span><span class="r-nome">${escaparHtml(c.nome)}<small>${escaparHtml(c.faccao ?? '—')}</small></span><strong>${c.poder}</strong></li>`).join('')
    : '<li class="vazio-mini">Sem cartas com poder.</li>';

  const categorias = p.porCategoria.slice(0, 15);
  raiz.querySelector('#agrupamento').innerHTML = categorias.length
    ? categorias.map((c) => `<li><span>${escaparHtml(c.rotulo)}</span><strong>${c.total}</strong></li>`).join('')
      + (p.porCategoria.length > 15 ? `<li class="mais">+ ${p.porCategoria.length - 15} categorias</li>` : '')
    : '<li class="vazio-mini">Sem categorias.</li>';
}
