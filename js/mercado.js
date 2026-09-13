// ==========================================
// mercado.js - Controle de entregas ao mercado
// ==========================================

let entregasCache = [];
let entregaEditandoId = null;
let periodoAtual = "mes";

async function verificarSessao() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = "index.html";
  }
}

async function carregarEntregas() {
  const { data, error } = await supabaseClient
    .from("mercado_entregas")
    .select("*")
    .order("data_entrega", { ascending: false });

  if (error) {
    console.error("Erro ao buscar entregas:", error);
    return;
  }

  entregasCache = data || [];
  aplicarFiltro();
}

function calcularIntervaloPeriodo(periodo) {
  const agora = new Date();
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());

  if (periodo === "dia") {
    const inicio = hoje;
    const fim = new Date(hoje);
    fim.setDate(fim.getDate() + 1);
    return { inicio, fim };
  }

  if (periodo === "semana") {
    const diaSemana = hoje.getDay();
    const deslocamento = diaSemana === 0 ? 6 : diaSemana - 1;
    const inicio = new Date(hoje);
    inicio.setDate(inicio.getDate() - deslocamento);
    const fim = new Date(inicio);
    fim.setDate(fim.getDate() + 7);
    return { inicio, fim };
  }

  if (periodo === "mes") {
    const inicio = new Date(agora.getFullYear(), agora.getMonth(), 1);
    const fim = new Date(agora.getFullYear(), agora.getMonth() + 1, 1);
    return { inicio, fim };
  }

  return null;
}

function formatarLabelPeriodo(periodo) {
  const opcoesData = { day: "2-digit", month: "2-digit", year: "numeric" };
  const intervalo = calcularIntervaloPeriodo(periodo);
  if (!intervalo) return "Todas as entregas";

  const fimExibicao = new Date(intervalo.fim);
  fimExibicao.setDate(fimExibicao.getDate() - 1);

  return `${intervalo.inicio.toLocaleDateString("pt-BR", opcoesData)} a ${fimExibicao.toLocaleDateString("pt-BR", opcoesData)}`;
}

function filtrarPorPeriodo(lista, periodo) {
  const intervalo = calcularIntervaloPeriodo(periodo);
  if (!intervalo) return lista;

  return lista.filter((e) => {
    const data = new Date(e.data_entrega + "T00:00:00");
    return data >= intervalo.inicio && data < intervalo.fim;
  });
}

function aplicarFiltro() {
  const filtradas = filtrarPorPeriodo(entregasCache, periodoAtual);
  renderizarResumo(filtradas);
  renderizarTabela(filtradas);
  document.getElementById("periodo-label").textContent = formatarLabelPeriodo(periodoAtual);
}

function configurarFiltro() {
  const botoes = document.querySelectorAll(".botao-periodo");
  botoes.forEach((btn) => {
    btn.addEventListener("click", () => {
      periodoAtual = btn.dataset.periodo;
      botoes.forEach((b) => b.classList.remove("ativo"));
      btn.classList.add("ativo");
      aplicarFiltro();
    });
  });
}

function renderizarResumo(lista) {
  const totalQuantidade = lista.reduce((soma, e) => soma + Number(e.quantidade), 0);
  document.getElementById("resumo-total-quantidade").textContent = totalQuantidade;
  document.getElementById("resumo-total-entregas").textContent = lista.length;
}

function formatarDataCurta(valor) {
  const data = new Date(valor + "T00:00:00");
  return data.toLocaleDateString("pt-BR");
}

function renderizarTabela(lista) {
  const corpo = document.getElementById("tabela-mercado-body");
  corpo.innerHTML = "";

  if (lista.length === 0) {
    corpo.innerHTML = `<tr><td colspan="5">Nenhuma entrega registrada neste período.</td></tr>`;
    return;
  }

  lista.forEach((entrega) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formatarDataCurta(entrega.data_entrega)}</td>
      <td>${entrega.produto}</td>
      <td>${entrega.quantidade} ${entrega.unidade || ""}</td>
      <td>${entrega.observacao || "-"}</td>
      <td class="acoes">
        <button class="botao-icone btn-editar-entrega" data-id="${entrega.id}">✏</button>
        <button class="botao-icone perigo btn-apagar-entrega" data-id="${entrega.id}">🗑</button>
      </td>
    `;
    corpo.appendChild(tr);
  });

  document.querySelectorAll(".btn-editar-entrega").forEach((btn) => {
    btn.addEventListener("click", () => abrirModalEdicao(btn.dataset.id));
  });

  document.querySelectorAll(".btn-apagar-entrega").forEach((btn) => {
    btn.addEventListener("click", () => apagarEntrega(btn.dataset.id));
  });
}

function abrirModalNovo() {
  entregaEditandoId = null;
  document.getElementById("form-mercado").reset();
  document.getElementById("mercado-data").value = new Date().toISOString().slice(0, 10);
  document.getElementById("modal-mercado-titulo").textContent = "Nova Entrega";
  document.getElementById("modalMercado").classList.remove("escondido");
}

function abrirModalEdicao(id) {
  const entrega = entregasCache.find((e) => String(e.id) === String(id));
  if (!entrega) return;

  entregaEditandoId = id;
  document.getElementById("mercado-data").value = entrega.data_entrega;
  document.getElementById("mercado-produto").value = entrega.produto;
  document.getElementById("mercado-quantidade").value = entrega.quantidade;
  document.getElementById("mercado-unidade").value = entrega.unidade || "";
  document.getElementById("mercado-observacao").value = entrega.observacao || "";

  document.getElementById("modal-mercado-titulo").textContent = "Editar Entrega";
  document.getElementById("modalMercado").classList.remove("escondido");
}

function fecharModal() {
  document.getElementById("modalMercado").classList.add("escondido");
  entregaEditandoId = null;
}

async function salvarEntrega(event) {
  event.preventDefault();

  const payload = {
    data_entrega: document.getElementById("mercado-data").value,
    produto: document.getElementById("mercado-produto").value.trim(),
    quantidade: parseFloat(document.getElementById("mercado-quantidade").value) || 0,
    unidade: document.getElementById("mercado-unidade").value.trim() || null,
    observacao: document.getElementById("mercado-observacao").value.trim() || null,
  };

  let error;

  if (entregaEditandoId) {
    ({ error } = await supabaseClient
      .from("mercado_entregas")
      .update(payload)
      .eq("id", entregaEditandoId));
  } else {
    ({ error } = await supabaseClient
      .from("mercado_entregas")
      .insert([payload]));
  }

  if (error) {
    console.error("Erro ao salvar entrega:", error);
    alert("Erro ao salvar: " + error.message);
    return;
  }

  fecharModal();
  await carregarEntregas();
}

async function apagarEntrega(id) {
  const confirmar = confirm("Tem certeza que deseja apagar esse registro?");
  if (!confirmar) return;

  const { error } = await supabaseClient
    .from("mercado_entregas")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Erro ao apagar entrega:", error);
    alert("Erro ao apagar: " + error.message);
    return;
  }

  await carregarEntregas();
}

document.addEventListener("DOMContentLoaded", async () => {
  await verificarSessao();
  configurarFiltro();
  await carregarEntregas();

  document.getElementById("btn-nova-entrega").addEventListener("click", abrirModalNovo);
  document.getElementById("btn-cancelar-mercado").addEventListener("click", fecharModal);
  document.getElementById("form-mercado").addEventListener("submit", salvarEntrega);

  document.getElementById("btn-logout").addEventListener("click", async () => {
    await fazerLogout();
    window.location.href = "index.html";
  });
});