// ==========================================
// financeiro.js - Com filtro de período + data personalizada
// + relatório de recebimento por cliente
// ==========================================

let movimentacaoEditandoId = null;
let movimentacoesCache = [];
let pedidosCache = [];
let periodoAtual = "mes"; // "dia" | "semana" | "mes" | "tudo" | "personalizado"
let dataInicioPersonalizada = null;
let dataFimPersonalizada = null;

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
  aplicarFiltroPeriodo();
}

// --- Buscar pedidos (para o relatório de recebimento por cliente) ---
async function carregarPedidosParaRelatorio() {
  const { data, error } = await supabaseClient
    .from("pedidos")
    .select("*, clientes(nome)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao buscar pedidos:", error);
    return;
  }

  pedidosCache = data || [];
  renderizarRecebimentoPorCliente();
}

// ==========================================
// Filtro de período
// ==========================================

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

  if (periodo === "personalizado" && dataInicioPersonalizada && dataFimPersonalizada) {
    const inicio = new Date(dataInicioPersonalizada + "T00:00:00");
    const fim = new Date(dataFimPersonalizada + "T00:00:00");
    fim.setDate(fim.getDate() + 1); // inclui o dia final inteiro
    return { inicio, fim };
  }

  // "tudo"
  return null;
}

function filtrarPorPeriodo(lista, periodo, campoData) {
  const intervalo = calcularIntervaloPeriodo(periodo);
  if (!intervalo) return lista;

  return lista.filter((item) => {
    const valorData = item[campoData];
    if (!valorData) return false;
    const data = campoData === "data_movimentacao"
      ? new Date(valorData + "T00:00:00")
      : new Date(valorData);
    return data >= intervalo.inicio && data < intervalo.fim;
  });
}

function formatarLabelPeriodo(periodo) {
  const opcoesData = { day: "2-digit", month: "2-digit", year: "numeric" };
  const intervalo = calcularIntervaloPeriodo(periodo);

  if (!intervalo) return "Todos os lançamentos";

  if (periodo === "dia") {
    return `Hoje — ${intervalo.inicio.toLocaleDateString("pt-BR", opcoesData)}`;
  }

  const fimExibicao = new Date(intervalo.fim);
  fimExibicao.setDate(fimExibicao.getDate() - 1);

  return `${intervalo.inicio.toLocaleDateString("pt-BR", opcoesData)} a ${fimExibicao.toLocaleDateString("pt-BR", opcoesData)}`;
}

function aplicarFiltroPeriodo() {
  const listaFiltrada = filtrarPorPeriodo(movimentacoesCache, periodoAtual, "data_movimentacao");
  renderizarResumo(listaFiltrada);
  renderizarTabela(listaFiltrada);

  const label = document.getElementById("periodo-label");
  if (label) {
    label.textContent = formatarLabelPeriodo(periodoAtual);
  }

  renderizarRecebimentoPorCliente();
}

function configurarFiltroPeriodo() {
  const botoes = document.querySelectorAll(".botao-periodo");
  const blocoPersonalizado = document.getElementById("bloco-data-personalizada");

  botoes.forEach((btn) => {
    btn.addEventListener("click", () => {
      periodoAtual = btn.dataset.periodo;

      botoes.forEach((b) => b.classList.remove("ativo"));
      btn.classList.add("ativo");

      if (periodoAtual === "personalizado") {
        blocoPersonalizado.classList.remove("escondido");
      } else {
        blocoPersonalizado.classList.add("escondido");
        aplicarFiltroPeriodo();
      }
    });
  });

  document.getElementById("btn-aplicar-data").addEventListener("click", () => {
    const inicio = document.getElementById("data-inicio").value;
    const fim = document.getElementById("data-fim").value;

    if (!inicio || !fim) {
      alert("Selecione a data inicial e a data final.");
      return;
    }

    if (inicio > fim) {
      alert("A data inicial não pode ser depois da data final.");
      return;
    }

    dataInicioPersonalizada = inicio;
    dataFimPersonalizada = fim;
    aplicarFiltroPeriodo();
  });
}

// ==========================================
// Recebimento por cliente
// ==========================================
function renderizarRecebimentoPorCliente() {
  const corpo = document.getElementById("tabela-recebimento-body");
  if (!corpo) return;

  const pedidosFiltrados = filtrarPorPeriodo(pedidosCache, periodoAtual, "created_at")
    .filter((p) => p.status !== "cancelado");

  // agrupa por nome do cliente (restaurante ou avulso/sacolão)
  const agrupado = {};

  pedidosFiltrados.forEach((pedido) => {
    let chave;
    if (pedido.cliente_id) {
      chave = pedido.clientes?.nome || "Cliente removido";
    } else {
      const origem = pedido.origem === "sacolao" ? "sacolão" : "avulso";
      chave = `${pedido.nome_avulso || "Cliente avulso"} (${origem})`;
    }

    if (!agrupado[chave]) {
      agrupado[chave] = { total: 0, pedidos: 0 };
    }
    agrupado[chave].total += Number(pedido.total);
    agrupado[chave].pedidos += 1;
  });

  const linhas = Object.entries(agrupado).sort((a, b) => b[1].total - a[1].total);

  corpo.innerHTML = "";

  if (linhas.length === 0) {
    corpo.innerHTML = `<tr><td colspan="3">Nenhum pedido neste período.</td></tr>`;
    return;
  }

  linhas.forEach(([nome, dados]) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${nome}</td>
      <td>${dados.pedidos}</td>
      <td>${formatarPreco(dados.total)}</td>
    `;
    corpo.appendChild(tr);
  });
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
    tbody.innerHTML = `<tr><td colspan="6">Nenhuma movimentação neste período.</td></tr>`;
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

  const campoData = document.getElementById("mov-data");
  if (campoData) {
    campoData.value = new Date().toISOString().slice(0, 10);
  }

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

  const campoData = document.getElementById("mov-data");
  if (campoData) {
    campoData.value = item.data_movimentacao;
  }

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

  const campoData = document.getElementById("mov-data");

  const payload = {
    descricao: document.getElementById("mov-descricao").value.trim(),
    valor: parseFloat(document.getElementById("mov-valor").value) || 0,
    categoria: document.getElementById("mov-categoria").value,
    status: document.getElementById("mov-status").value,
  };

  if (campoData && campoData.value) {
    payload.data_movimentacao = campoData.value;
  }

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

// --- Utilitário ---
function formatarPreco(valor) {
  return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// --- Inicialização ---
document.addEventListener("DOMContentLoaded", async () => {
  await verificarSessao();
  configurarFiltroPeriodo();
  await carregarMovimentacoes();
  await carregarPedidosParaRelatorio();

  document.getElementById("btn-nova-movimentacao").addEventListener("click", abrirModalNovo);
  document.getElementById("btn-cancelar-movimentacao").addEventListener("click", fecharModal);
  document.getElementById("form-movimentacao").addEventListener("submit", salvarMovimentacao);

  document.getElementById("btn-logout").addEventListener("click", async () => {
    await fazerLogout();
    window.location.href = "index.html";
  });
});