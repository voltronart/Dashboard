// ==========================================
// pedidos.js - Listagem e gestão de pedidos
// ==========================================

let pedidosCache = []; // guarda os pedidos carregados pra filtrar sem refazer request

// --- Proteção de rota ---
async function verificarSessao() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = "index.html";
  }
}

// --- Buscar pedidos + nome do cliente relacionado ---
async function carregarPedidos() {
  const { data, error } = await supabaseClient
    .from("pedidos")
    .select("*, clientes(nome)") // join simples: traz o nome do cliente junto
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao buscar pedidos:", error);
    return;
  }

  pedidosCache = data;
  renderizarTabela(pedidosCache);
}

// --- Formata a data de created_at pra pt-BR ---
function formatarData(dataISO) {
  const data = new Date(dataISO);
  return data.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// --- Formata o array de itens (JSON) em texto legível ---
function formatarItens(itens) {
  if (!Array.isArray(itens)) return "-";
  return itens
    .map((item) => `${item.quantidade}x ${item.produto}`)
    .join(", ");
}

// --- Retorna o nome de exibição, considerando restaurante ou avulso ---
function nomeExibicaoPedido(pedido) {
  if (pedido.cliente_id) {
    return pedido.clientes?.nome || "Cliente removido";
  }
  return pedido.nome_avulso ? `${pedido.nome_avulso} (avulso)` : "Cliente avulso";
}

// --- Monta um resumo extra pro pedido avulso: telefone, endereço, pagamento ---
function detalhesExtrasPedido(pedido) {
  if (pedido.cliente_id) return ""; // pedido de restaurante não usa esses campos

  const linhas = [];

  if (pedido.telefone_avulso) {
    linhas.push(`📞 ${pedido.telefone_avulso}`);
  }

  if (pedido.endereco_avulso) {
    linhas.push(`📍 ${pedido.endereco_avulso}`);
  }

  if (pedido.forma_pagamento === "pix") {
    linhas.push(`💳 Pix`);
  } else if (pedido.forma_pagamento === "dinheiro") {
    const trocoTexto = pedido.troco_para
      ? `troco p/ ${formatarPreco(pedido.troco_para)}`
      : "sem troco";
    linhas.push(`💵 Dinheiro (${trocoTexto})`);
  }

  if (linhas.length === 0) return "";

  return `<div class="detalhes-avulso">${linhas.join("<br>")}</div>`;
}

// --- Traduz o status de pagamento pra exibição ---
function traduzirStatusPagamento(status) {
  const mapa = {
    a_receber: "A receber",
    pago: "Pago",
    atrasado: "Atrasado",
  };
  return mapa[status] || status;
}

// --- Retorna os botões de ação disponíveis conforme o status atual ---
function botoesAcaoPorStatus(pedido) {
  const botoes = [];

  if (pedido.status === "pendente") {
    botoes.push(`<button class="botao-icone btn-status" data-id="${pedido.id}" data-novo-status="em_preparo">Marcar em preparo</button>`);
    botoes.push(`<button class="botao-icone btn-status btn-cancelar-pedido" data-id="${pedido.id}" data-novo-status="cancelado">Cancelar</button>`);
  }

  if (pedido.status === "em_preparo") {
    botoes.push(`<button class="botao-icone btn-status" data-id="${pedido.id}" data-novo-status="entregue">Marcar entregue</button>`);
    botoes.push(`<button class="botao-icone btn-status btn-cancelar-pedido" data-id="${pedido.id}" data-novo-status="cancelado">Cancelar</button>`);
  }

  if (pedido.status === "entregue" || pedido.status === "cancelado") {
    botoes.push(`<span class="texto-secundario">Concluído</span>`);
  }

  return botoes.join(" ");
}

// --- Renderiza a tabela, aplicando filtro se houver ---
function renderizarTabela(pedidos) {
  const tbody = document.getElementById("tabela-pedidos-body");
  tbody.innerHTML = "";

  if (pedidos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6">Nenhum pedido encontrado.</td></tr>`;
    return;
  }

  pedidos.forEach((pedido) => {
    const nomeCliente = nomeExibicaoPedido(pedido);
    const extras = detalhesExtrasPedido(pedido);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td data-label>${nomeCliente}${extras}</td>
      <td data-label>${formatarData(pedido.created_at)}</td>
      <td data-label>${formatarItens(pedido.itens)}</td>
      <td data-label>${formatarPreco(pedido.total)}</td>
      <td data-label><span class="badge-status badge-${pedido.status}">${traduzirStatus(pedido.status)}</span></td>
      <td data-label>${botoesAcaoPorStatus(pedido)}</td>
    `;
    tbody.appendChild(tr);
  });

  // Liga os botões de mudança de status
  document.querySelectorAll(".btn-status").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const novoStatus = btn.dataset.novoStatus;
      const ehCancelamento = btn.classList.contains("btn-cancelar-pedido");

      if (ehCancelamento) {
        const confirmar = confirm("Tem certeza que deseja cancelar esse pedido?");
        if (!confirmar) return;
      }

      atualizarStatusPedido(id, novoStatus);
    });
  });
}

// --- Traduz o status pra exibição ---
function traduzirStatus(status) {
  const mapa = {
    pendente: "Pendente",
    em_preparo: "Em preparo",
    entregue: "Entregue",
    cancelado: "Cancelado",
  };
  return mapa[status] || status;
}

// --- Atualiza o status de um pedido no banco ---
async function atualizarStatusPedido(id, novoStatus) {
  const { error } = await supabaseClient
    .from("pedidos")
    .update({ status: novoStatus })
    .eq("id", id);

  if (error) {
    console.error("Erro ao atualizar status:", error);
    alert("Erro ao atualizar status: " + error.message);
    return;
  }

  await carregarPedidos();
}

// --- Aplica o filtro selecionado no dropdown ---
function aplicarFiltro() {
  const statusSelecionado = document.getElementById("filtro-status").value;

  if (!statusSelecionado) {
    renderizarTabela(pedidosCache);
    return;
  }

  const filtrados = pedidosCache.filter((p) => p.status === statusSelecionado);
  renderizarTabela(filtrados);
}

// --- Inicialização ---
document.addEventListener("DOMContentLoaded", async () => {
  await verificarSessao();
  await carregarPedidos();

  document.getElementById("filtro-status").addEventListener("change", aplicarFiltro);

  document.getElementById("btn-logout").addEventListener("click", async () => {
    await fazerLogout();
    window.location.href = "index.html";
  });
});
