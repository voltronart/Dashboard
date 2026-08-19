// ==========================================
// canteiros.js - CRUD de canteiros (módulo ES)
// ==========================================
// Usa o `supabaseClient` global, já criado por supabaseConfig.js
// + supabaseClient.js (carregados antes deste script no HTML).

let canteirosCache = [];
let cultivosCache = []; // para popular o select "Cultivo atual"
let canteiroEditandoId = null;

// --- Proteção de rota ---
async function verificarSessao() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = "index.html";
  }
}

function mostrarAlerta(mensagem, tipo = "sucesso") {
  const alerta = document.getElementById("alerta");
  alerta.textContent = mensagem;
  alerta.className = `alert ${tipo}`;
  setTimeout(() => {
    alerta.className = "alert";
  }, 3500);
}

// --- Carregar cultivos (para o select do formulário) ---
async function carregarCultivosParaSelect() {
  const { data, error } = await supabaseClient
    .from("cultivos")
    .select("id, nome")
    .order("nome", { ascending: true });

  if (error) {
    console.error("Erro ao buscar cultivos:", error);
    return;
  }

  cultivosCache = data || [];

  const select = document.getElementById("f-cultivo");
  select.innerHTML = `<option value="">Nenhum / vazio</option>`;
  cultivosCache.forEach((cultivo) => {
    const option = document.createElement("option");
    option.value = cultivo.id;
    option.textContent = cultivo.nome;
    select.appendChild(option);
  });
}

// --- Carregar canteiros + nome do cultivo relacionado ---
async function carregarCanteiros() {
  document.getElementById("estado-carregando").style.display = "block";

  const { data, error } = await supabaseClient
    .from("canteiros")
    .select("*, cultivos(nome)")
    .order("numero", { ascending: true });

  document.getElementById("estado-carregando").style.display = "none";

  if (error) {
    console.error("Erro ao buscar canteiros:", error);
    mostrarAlerta("Erro ao carregar canteiros: " + error.message, "erro");
    return;
  }

  canteirosCache = data || [];
  renderizarLista(canteirosCache);
}

function formatarData(dataISO) {
  if (!dataISO) return null;
  const data = new Date(dataISO + "T00:00:00");
  return data.toLocaleDateString("pt-BR");
}

// --- Renderiza a lista de cards ---
function renderizarLista(lista) {
  const container = document.getElementById("lista");
  const estadoVazio = document.getElementById("estado-vazio");
  const textoVazio = document.getElementById("texto-vazio");
  const contagem = document.getElementById("contagem");

  container.innerHTML = "";

  if (lista.length === 0) {
    estadoVazio.classList.add("visivel");
    textoVazio.textContent = canteirosCache.length === 0
      ? "Nenhum canteiro cadastrado ainda."
      : "Nenhum canteiro encontrado para esse filtro.";
    contagem.textContent = "";
    return;
  }

  estadoVazio.classList.remove("visivel");
  contagem.textContent = `${lista.length} canteiro${lista.length !== 1 ? "s" : ""}`;

  lista.forEach((canteiro) => {
    const statusClasse = (canteiro.status || "Livre").replace(/\s+/g, "-");
    const nomeCultivo = canteiro.cultivos?.nome || null;

    const card = document.createElement("div");
    card.className = "card-canteiro";
    card.innerHTML = `
      <div class="card-canteiro-topo">
        <h3 class="card-canteiro-numero">${canteiro.numero}</h3>
        <span class="badge-status ${statusClasse}">${canteiro.status || "Livre"}</span>
      </div>

      ${canteiro.area ? `<div class="card-canteiro-linha"><span>Área</span><span>${canteiro.area} m²</span></div>` : ""}
      <div class="card-canteiro-linha"><span>Cultivo atual</span><span>${nomeCultivo || "Nenhum"}</span></div>
      ${canteiro.data_preparo ? `<div class="card-canteiro-linha"><span>Preparo</span><span>${formatarData(canteiro.data_preparo)}</span></div>` : ""}
      ${canteiro.observacoes ? `<p class="card-canteiro-obs">${canteiro.observacoes}</p>` : ""}

      <div class="card-canteiro-acoes">
        <button class="btn-editar" data-id="${canteiro.id}">Editar</button>
        <button class="btn-excluir" data-id="${canteiro.id}">Excluir</button>
      </div>
    `;
    container.appendChild(card);
  });

  document.querySelectorAll(".btn-editar").forEach((btn) => {
    btn.addEventListener("click", () => abrirModalEdicao(btn.dataset.id));
  });

  document.querySelectorAll(".btn-excluir").forEach((btn) => {
    btn.addEventListener("click", () => excluirCanteiro(btn.dataset.id));
  });
}

// --- Busca + filtro de status combinados ---
function aplicarFiltros() {
  const termo = document.getElementById("busca").value.trim().toLowerCase();
  const status = document.getElementById("filtro-status").value;

  let filtrados = canteirosCache;

  if (termo) {
    filtrados = filtrados.filter((c) => c.numero.toLowerCase().includes(termo));
  }

  if (status) {
    filtrados = filtrados.filter((c) => c.status === status);
  }

  renderizarLista(filtrados);
}

// --- Modal: abrir/fechar ---
function abrirModalNovo() {
  canteiroEditandoId = null;
  document.getElementById("form-canteiro").reset();
  document.getElementById("modal-titulo").textContent = "Novo canteiro";
  document.getElementById("overlay").classList.add("aberto");
}

function abrirModalEdicao(id) {
  const canteiro = canteirosCache.find((c) => String(c.id) === String(id));
  if (!canteiro) return;

  canteiroEditandoId = id;

  document.getElementById("f-numero").value = canteiro.numero || "";
  document.getElementById("f-area").value = canteiro.area || "";
  document.getElementById("f-cultivo").value = canteiro.cultivo_id || "";
  document.getElementById("f-data-preparo").value = canteiro.data_preparo || "";
  document.getElementById("f-status").value = canteiro.status || "Livre";
  document.getElementById("f-observacoes").value = canteiro.observacoes || "";

  document.getElementById("modal-titulo").textContent = "Editar canteiro";
  document.getElementById("overlay").classList.add("aberto");
}

function fecharModal() {
  document.getElementById("overlay").classList.remove("aberto");
  canteiroEditandoId = null;
}

// --- Salvar (criar ou atualizar) ---
async function salvarCanteiro(event) {
  event.preventDefault();

  const botaoSalvar = document.getElementById("btn-salvar");
  botaoSalvar.disabled = true;
  botaoSalvar.textContent = "Salvando...";

  const cultivoSelecionado = document.getElementById("f-cultivo").value;

  const payload = {
    numero: document.getElementById("f-numero").value.trim(),
    area: parseFloat(document.getElementById("f-area").value) || null,
    cultivo_id: cultivoSelecionado ? parseInt(cultivoSelecionado) : null,
    data_preparo: document.getElementById("f-data-preparo").value || null,
    status: document.getElementById("f-status").value,
    observacoes: document.getElementById("f-observacoes").value.trim() || null,
  };

  let error;

  if (canteiroEditandoId) {
    ({ error } = await supabaseClient
      .from("canteiros")
      .update(payload)
      .eq("id", canteiroEditandoId));
  } else {
    ({ error } = await supabaseClient
      .from("canteiros")
      .insert([payload]));
  }

  botaoSalvar.disabled = false;
  botaoSalvar.textContent = "Salvar canteiro";

  if (error) {
    console.error("Erro ao salvar canteiro:", error);
    mostrarAlerta("Erro ao salvar: " + error.message, "erro");
    return;
  }

  fecharModal();
  mostrarAlerta(canteiroEditandoId ? "Canteiro atualizado!" : "Canteiro cadastrado!");
  await carregarCanteiros();
}

// --- Excluir ---
async function excluirCanteiro(id) {
  const confirmar = confirm("Tem certeza que deseja excluir esse canteiro?");
  if (!confirmar) return;

  const { error } = await supabaseClient
    .from("canteiros")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Erro ao excluir canteiro:", error);
    mostrarAlerta("Erro ao excluir: " + error.message, "erro");
    return;
  }

  mostrarAlerta("Canteiro excluído.");
  await carregarCanteiros();
}

// --- Inicialização ---
document.addEventListener("DOMContentLoaded", async () => {
  await verificarSessao();
  await carregarCultivosParaSelect();
  await carregarCanteiros();

  document.getElementById("busca").addEventListener("input", aplicarFiltros);
  document.getElementById("filtro-status").addEventListener("change", aplicarFiltros);

  document.getElementById("btn-novo").addEventListener("click", abrirModalNovo);
  document.getElementById("btn-fechar").addEventListener("click", fecharModal);
  document.getElementById("btn-cancelar").addEventListener("click", fecharModal);
  document.getElementById("form-canteiro").addEventListener("submit", salvarCanteiro);

  document.getElementById("overlay").addEventListener("click", (e) => {
    if (e.target.id === "overlay") fecharModal();
  });
});
