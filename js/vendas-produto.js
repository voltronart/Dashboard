// ==========================================
// vendas-produto.js - Quantidade vendida por produto (semana/mês/tudo)
// ==========================================

let pedidosCache = [];
let periodoAtual = "semana";

// --- Proteção de rota ---
async function verificarSessao() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = "index.html";
  }
}

// --- Buscar pedidos (itens ficam no campo jsonb "itens") ---
async function carregarPedidos() {
  const { data, error } = await supabaseClient
    .from("pedidos")
    .select("id, itens, created_at, status")
    .neq("status", "cancelado")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao buscar pedidos:", error);
    return;
  }

  pedidosCache = data || [];
  aplicarFiltro();
}

// --- Cálculo de intervalo (mesma lógica do financeiro) ---
function calcularIntervaloPeriodo(periodo) {
  const agora = new Date();
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());

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

  return null; // "tudo"
}

function formatarLabelPeriodo(periodo) {
  const opcoesData = { day: "2-digit", month: "2-digit", year: "numeric" };
  const intervalo = calcularIntervaloPeriodo(periodo);
  if (!intervalo) return "Todos os pedidos";

  const fimExibicao = new Date(intervalo.fim);
  fimExibicao.setDate(fimExibicao.getDate() - 1);

  return `${intervalo.inicio.toLocaleDateString("pt-BR", opcoesData)} a ${fimExibicao.toLocaleDateString("pt-BR", opcoesData)}`;
}

// --- Agrega quantidade vendida por nome de produto ---
function agregarVendasPorProduto(pedidos) {
  const agrupado = {};

  pedidos.forEach((pedido) => {
    if (!Array.isArray(pedido.itens)) return;

    const produtosContadosNessePedido = new Set();

    pedido.itens.forEach((item) => {
      const nome = item.produto;
      const quantidade = Number(item.quantidade) || 0;

      if (!agrupado[nome]) {
        agrupado[nome] = { quantidade: 0, pedidos: 0 };
      }

      agrupado[nome].quantidade += quantidade;

      if (!produtosContadosNessePedido.has(nome)) {
        agrupado[nome].pedidos += 1;
        produtosContadosNessePedido.add(nome);
      }
    });
  });

  return Object.entries(agrupado)
    .map(([nome, dados]) => ({ nome, ...dados }))
    .sort((a, b) => b.quantidade - a.quantidade);
}

function renderizarTabela(lista) {
  const corpo = document.getElementById("tabela-vendas-body");
  corpo.innerHTML = "";

  if (lista.length === 0) {
    corpo.innerHTML = `<tr><td colspan="3">Nenhuma venda neste período.</td></tr>`;
    return;
  }

  lista.forEach((item) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.nome}</td>
      <td>${item.quantidade}</td>
      <td>${item.pedidos}</td>
    `;
    corpo.appendChild(tr);
  });
}

function aplicarFiltro() {
  const intervalo = calcularIntervaloPeriodo(periodoAtual);

  const pedidosFiltrados = intervalo
    ? pedidosCache.filter((p) => {
        const data = new Date(p.created_at);
        return data >= intervalo.inicio && data < intervalo.fim;
      })
    : pedidosCache;

  const agregados = agregarVendasPorProduto(pedidosFiltrados);
  renderizarTabela(agregados);

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

// --- Inicialização ---
document.addEventListener("DOMContentLoaded", async () => {
  await verificarSessao();
  configurarFiltro();
  await carregarPedidos();

  document.getElementById("btn-logout").addEventListener("click", async () => {
    await fazerLogout();
    window.location.href = "index.html";
  });
});