// Funções utilitárias compartilhadas na dashboard

function mostrarErro(elementoId, mensagem) {
  const el = document.getElementById(elementoId);
  el.textContent = mensagem;
}

function limparErro(elementoId) {
  const el = document.getElementById(elementoId);
  el.textContent = "";
}

function formatarPreco(valor) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}