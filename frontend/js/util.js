// Escapa texto vindo do banco/API antes de inserir em HTML.
export function escaparHtml(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

// Compara sem diferenciar maiusculas nem acentos ("Lendária" ~ "lendaria").
export function normalizar(texto) {
  return String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
