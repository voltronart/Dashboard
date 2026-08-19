// ==========================================
// cultivos.js - CRUD de cultivos (módulo ES)
// ==========================================
// Usa o `supabaseClient` global, já criado por supabaseConfig.js
// + supabaseClient.js (carregados antes deste script no HTML).

let cultivosCache = [];
let cultivoEditandoId = null;

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

// --- Carregar cultivos ---
async function carregarCultivos() {
  document.getElementById("estado-carregando").style.display = "block";

  const { data, error } = await supabaseClient
    .from("cultivos")
    .select("*")
    .order("nome", { ascending: true });

  document.getElementById("estado-carregando").style.display = "none";

  if (error) {
    console.error("Erro ao buscar cultivos:", error);
    mostrarAlerta("Erro ao carregar cultivos: " + error.message, "erro");
    return;
  }

  cultivosCache = data || [];
  renderizarLista(cultivosCache);
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
    textoVazio.textContent = cultivosCache.length === 0
      ? "Nenhum cultivo cadastrado ainda."
      : "Nenhum cultivo encontrado para essa busca.";
    contagem.textContent = "";
    return;
  }

  estadoVazio.classList.remove("visivel");
  contagem.textContent = `${lista.length} cultivo${lista.length !== 1 ? "s" : ""}`;

  lista.forEach((cultivo) => {
    const card = document.createElement("div");
    card.className = "card-cultivo";
    card.innerHTML = `
      <div class="card-cultivo-topo">
        <div>
          <h3 class="card-cultivo-nome">${cultivo.nome}</h3>
          <p class="card-cultivo-variedade">${cultivo.variedade || "Sem variedade especificada"}</p>
        </div>
        ${cultivo.irrigacao ? `<span class="badge-irrigacao ${cultivo.irrigacao}">${cultivo.irrigacao}</span>` : ""}
      </div>

      ${cultivo.ciclo_dias ? `<div class="card-cultivo-linha"><span>Ciclo</span><span>${cultivo.ciclo_dias} dias</span></div>` : ""}
      ${cultivo.epoca_plantio ? `<div class="card-cultivo-linha"><span>Época de plantio</span><span>${cultivo.epoca_plantio}</span></div>` : ""}
      ${cultivo.espacamento ? `<div class="card-cultivo-linha"><span>Espaçamento</span><span>${cultivo.espacamento}</span></div>` : ""}
      ${cultivo.plantas_por_canteiro ? `<div class="card-cultivo-linha"><span>Plantas/canteiro</span><span>${cultivo.plantas_por_canteiro}</span></div>` : ""}
      ${cultivo.produtividade ? `<div class="card-cultivo-linha"><span>Produtividade</span><span>${cultivo.produtividade}</span></div>` : ""}
      ${cultivo.epoca_procura ? `<div class="card-cultivo-linha"><span>Melhor época/preço</span><span>${cultivo.epoca_procura}</span></div>` : ""}

      <div class="card-cultivo-acoes">
        <button class="btn-editar" data-id="${cultivo.id}">Editar</button>
        <button class="btn-excluir" data-id="${cultivo.id}">Excluir</button>
      </div>
    `;
    container.appendChild(card);
  });

  document.querySelectorAll(".btn-editar").forEach((btn) => {
    btn.addEventListener("click", () => abrirModalEdicao(btn.dataset.id));
  });

  document.querySelectorAll(".btn-excluir").forEach((btn) => {
    btn.addEventListener("click", () => excluirCultivo(btn.dataset.id));
  });
}

// --- Busca (filtro local, sem nova request) ---
function configurarBusca() {
  const input = document.getElementById("busca");
  input.addEventListener("input", () => {
    const termo = input.value.trim().toLowerCase();
    if (!termo) {
      renderizarLista(cultivosCache);
      return;
    }
    const filtrados = cultivosCache.filter((c) =>
      c.nome.toLowerCase().includes(termo) ||
      (c.variedade && c.variedade.toLowerCase().includes(termo))
    );
    renderizarLista(filtrados);
  });
}

// --- Modal: abrir/fechar ---
function abrirModalNovo() {
  cultivoEditandoId = null;
  document.getElementById("form-cultivo").reset();
  document.getElementById("modal-titulo").textContent = "Novo cultivo";
  document.getElementById("overlay").classList.add("aberto");
}

function abrirModalEdicao(id) {
  const cultivo = cultivosCache.find((c) => String(c.id) === String(id));
  if (!cultivo) return;

  cultivoEditandoId = id;

  document.getElementById("f-nome").value = cultivo.nome || "";
  document.getElementById("f-variedade").value = cultivo.variedade || "";
  document.getElementById("f-ciclo").value = cultivo.ciclo_dias || "";
  document.getElementById("f-epoca").value = cultivo.epoca_plantio || "";
  document.getElementById("f-espacamento").value = cultivo.espacamento || "";
  document.getElementById("f-plantas").value = cultivo.plantas_por_canteiro || "";
  document.getElementById("f-produtividade").value = cultivo.produtividade || "";
  document.getElementById("f-irrigacao").value = cultivo.irrigacao || "Média";
  document.getElementById("f-adubacao").value = cultivo.adubacao || "";
  document.getElementById("f-pragas").value = cultivo.pragas || "";
  document.getElementById("f-preco").value = cultivo.epoca_procura || "";

  document.getElementById("modal-titulo").textContent = "Editar cultivo";
  document.getElementById("overlay").classList.add("aberto");
}

function fecharModal() {
  document.getElementById("overlay").classList.remove("aberto");
  cultivoEditandoId = null;
}

// --- Salvar (criar ou atualizar) ---
async function salvarCultivo(event) {
  event.preventDefault();

  const botaoSalvar = document.getElementById("btn-salvar");
  botaoSalvar.disabled = true;
  botaoSalvar.textContent = "Salvando...";

  const payload = {
    nome: document.getElementById("f-nome").value.trim(),
    variedade: document.getElementById("f-variedade").value.trim() || null,
    ciclo_dias: parseInt(document.getElementById("f-ciclo").value) || null,
    epoca_plantio: document.getElementById("f-epoca").value.trim() || null,
    espacamento: document.getElementById("f-espacamento").value.trim() || null,
    plantas_por_canteiro: parseInt(document.getElementById("f-plantas").value) || null,
    produtividade: document.getElementById("f-produtividade").value.trim() || null,
    irrigacao: document.getElementById("f-irrigacao").value,
    adubacao: document.getElementById("f-adubacao").value.trim() || null,
    pragas: document.getElementById("f-pragas").value.trim() || null,
    epoca_procura: document.getElementById("f-preco").value.trim() || null,
  };

  let error;

  if (cultivoEditandoId) {
    ({ error } = await supabaseClient
      .from("cultivos")
      .update(payload)
      .eq("id", cultivoEditandoId));
  } else {
    ({ error } = await supabaseClient
      .from("cultivos")
      .insert([payload]));
  }

  botaoSalvar.disabled = false;
  botaoSalvar.textContent = "Salvar cultivo";

  if (error) {
    console.error("Erro ao salvar cultivo:", error);
    mostrarAlerta("Erro ao salvar: " + error.message, "erro");
    return;
  }

  fecharModal();
  mostrarAlerta(cultivoEditandoId ? "Cultivo atualizado!" : "Cultivo cadastrado!");
  await carregarCultivos();
}

// --- Excluir ---
async function excluirCultivo(id) {
  const confirmar = confirm("Tem certeza que deseja excluir esse cultivo? Canteiros que apontam para ele ficarão sem cultivo definido.");
  if (!confirmar) return;

  const { error } = await supabaseClient
    .from("cultivos")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Erro ao excluir cultivo:", error);
    mostrarAlerta("Erro ao excluir: " + error.message, "erro");
    return;
  }

  mostrarAlerta("Cultivo excluído.");
  await carregarCultivos();
}

// --- Inicialização ---
document.addEventListener("DOMContentLoaded", async () => {
  await verificarSessao();
  await carregarCultivos();
  configurarBusca();

  document.getElementById("btn-novo").addEventListener("click", abrirModalNovo);
  document.getElementById("btn-fechar").addEventListener("click", fecharModal);
  document.getElementById("btn-cancelar").addEventListener("click", fecharModal);
  document.getElementById("form-cultivo").addEventListener("submit", salvarCultivo);

  document.getElementById("overlay").addEventListener("click", (e) => {
    if (e.target.id === "overlay") fecharModal();
  });
});
