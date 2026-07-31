// ==========================================
// financeiro.js - Versão simplificada (só movimentações manuais)
// ==========================================

let movimentacaoEditandoId = null;
let movimentacoesCache = [];

// --- Proteção de rota ---
async function verificarSessao() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = "index.html";
  }
}

// --- Buscar todas as movimentações ---
async function carregarMovimentacoes() {
  const { data, error } = await supabaseClient
    .from("movimentacoes")
    .select("*")
    .order("data_movimentacao", { ascending: false });

  if (error) {
    console.error("Erro ao buscar movimentações:", error);
    return;
  }

  movimentacoesCache = data;
  renderizarResumo(data);
  renderizarTabela(data);
}

// --- Calcula os 4 cards de resumo ---
function renderizarResumo(lista) {
  const receitas = lista.filter((m) => m.categoria === "receita");
  const despesas = lista.filter((m) => m.categoria === "despesa");

  const totalReceita = receitas.reduce((soma, m) => soma + Number(m.valor), 0);
  const totalDespesa = despesas.reduce((soma, m) => soma + Number(m.valor), 0);
  const lucro = totalReceita - totalDespesa;
  const totalPendente = lista
    .filter((m) => m.status === "pendente")
    .reduce((soma, m) => soma + Number(m.valor), 0);

  document.getElementById("resumo-receita").textContent = formatarPreco(totalReceita);
  document.getElementById("resumo-despesas").textContent = formatarPreco(totalDespesa);
  document.getElementById("resumo-lucro").textContent = formatarPreco(lucro);
  document.getElementById("resumo-pendentes").textContent = formatarPreco(totalPendente);
}

function formatarDataCurta(valor) {
  const data = new Date(valor + "T00:00:00");
  return data.toLocaleDateString("pt-BR");
}

// --- Renderiza a tabela ---
function renderizarTabela(lista) {
  const tbody = document.getElementById("tabela-financeiro-body");
  tbody.innerHTML = "";

  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6">Nenhuma movimentação cadastrada ainda.</td></tr>`;
    return;
  }

  lista.forEach((mov) => {
    const badgeClasse = mov.status === "pago" ? "badge-sucesso" : "badge-alerta";
    const badgeTexto = mov.status === "pago" ? "Pago" : "Pendente";
    const categoriaTexto = mov.categoria === "receita" ? "Receita" : "Despesa";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formatarDataCurta(mov.data_movimentacao)}</td>
      <td>${mov.descricao}</td>
      <td>${categoriaTexto}</td>
      <td>${formatarPreco(mov.valor)}</td>
      <td><span class="badge ${badgeClasse}">${badgeTexto}</span></td>
      <td class="acoes">
        <button class="botao-icone btn-editar-mov" data-id="${mov.id}">✏</button>
        <button class="botao-icone perigo btn-apagar-mov" data-id="${mov.id}">🗑</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  document.querySelectorAll(".btn-editar-mov").forEach((btn) => {
    btn.addEventListener("click", () => abrirModalEdicao(btn.dataset.id));
  });

  document.querySelectorAll(".btn-apagar-mov").forEach((btn) => {
    btn.addEventListener("click", () => apagarMovimentacao(btn.dataset.id));
  });
}

// --- Modal: novo / editar ---
function abrirModalNovo() {
  movimentacaoEditandoId = null;
  document.getElementById("form-movimentacao").reset();
  document.querySelector("#modalFinanceiro h2").textContent = "Nova Movimentação";
  document.getElementById("modalFinanceiro").classList.remove("escondido");
}

function abrirModalEdicao(id) {
  const item = movimentacoesCache.find((m) => String(m.id) === String(id));
  if (!item) return;

  movimentacaoEditandoId = id;

  document.getElementById("mov-descricao").value = item.descricao;
  document.getElementById("mov-valor").value = item.valor;
  document.getElementById("mov-categoria").value = item.categoria;
  document.getElementById("mov-status").value = item.status;

  document.querySelector("#modalFinanceiro h2").textContent = "Editar Movimentação";
  document.getElementById("modalFinanceiro").classList.remove("escondido");
}

function fecharModal() {
  document.getElementById("modalFinanceiro").classList.add("escondido");
  movimentacaoEditandoId = null;
}

// --- Salvar (criar ou atualizar) ---
async function salvarMovimentacao(event) {
  event.preventDefault();

  const payload = {
    descricao: document.getElementById("mov-descricao").value.trim(),
    valor: parseFloat(document.getElementById("mov-valor").value) || 0,
    categoria: document.getElementById("mov-categoria").value,
    status: document.getElementById("mov-status").value,
  };

  let error;

  if (movimentacaoEditandoId) {
    ({ error } = await supabaseClient
      .from("movimentacoes")
      .update(payload)
      .eq("id", movimentacaoEditandoId));
  } else {
    ({ error } = await supabaseClient
      .from("movimentacoes")
      .insert([payload]));
  }

  if (error) {
    console.error("Erro ao salvar movimentação:", error);
    alert("Erro ao salvar: " + error.message);
    return;
  }

  fecharModal();
  await carregarMovimentacoes();
}

// --- Apagar ---
async function apagarMovimentacao(id) {
  const confirmar = confirm("Tem certeza que deseja apagar essa movimentação?");
  if (!confirmar) return;

  const { error } = await supabaseClient
    .from("movimentacoes")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Erro ao apagar movimentação:", error);
    alert("Erro ao apagar: " + error.message);
    return;
  }

  await carregarMovimentacoes();
}

// --- Inicialização ---
document.addEventListener("DOMContentLoaded", async () => {
  await verificarSessao();
  await carregarMovimentacoes();

  document.getElementById("btn-nova-movimentacao").addEventListener("click", abrirModalNovo);
  document.getElementById("btn-cancelar-movimentacao").addEventListener("click", fecharModal);
  document.getElementById("form-movimentacao").addEventListener("submit", salvarMovimentacao);

  document.getElementById("btn-logout").addEventListener("click", async () => {
    await fazerLogout();
    window.location.href = "index.html";
  });
});