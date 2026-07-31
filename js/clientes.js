// ==========================================
// clientes.js - CRUD de clientes (restaurantes)
// ==========================================

// 🔧 Troque essa URL quando souber o endereço final da loja publicada
const URL_BASE_LOJA = "http://127.0.0.1:5500/loja/loja.html";

let clienteEditandoId = null;

// --- Proteção de rota: se não estiver logado, volta pro login ---
async function verificarSessao() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = "index.html";
  }
}

// --- Gerar slug automático a partir do nome ---
function gerarSlug(nome) {
  return nome
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[^a-z0-9]+/g, "-") // troca espaços/símbolos por hífen
    .replace(/(^-|-$)/g, ""); // remove hífen no início/fim
}

// --- Monta o link completo da loja pra um cliente ---
function montarLinkLoja(slug) {
  return `${URL_BASE_LOJA}?cliente=${slug}`;
}

// --- Copia o link pra área de transferência e dá feedback visual ---
async function copiarLinkCliente(slug, botao) {
  const link = montarLinkLoja(slug);

  try {
    await navigator.clipboard.writeText(link);
    const textoOriginal = botao.textContent;
    botao.textContent = "Copiado!";
    botao.disabled = true;
    setTimeout(() => {
      botao.textContent = textoOriginal;
      botao.disabled = false;
    }, 1800);
  } catch (erro) {
    console.error("Erro ao copiar link:", erro);
    // Fallback: mostra o link num prompt pra copiar manualmente
    prompt("Copie o link manualmente:", link);
  }
}

// --- Buscar e renderizar clientes ---
async function carregarClientes() {
  const { data, error } = await supabaseClient
    .from("clientes")
    .select("*")
    .order("nome", { ascending: true });

  if (error) {
    console.error("Erro ao buscar clientes:", error);
    return;
  }

  renderizarTabela(data);
}

function renderizarTabela(clientes) {
  const tbody = document.getElementById("tabela-clientes-body");
  tbody.innerHTML = "";

  if (clientes.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5">Nenhum cliente cadastrado ainda.</td></tr>`;
    return;
  }

  clientes.forEach((cliente) => {
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td data-label="Nome">${cliente.nome}</td>
    <td data-label="Contato">${cliente.contato || "-"}</td>
    <td data-label="Status">${cliente.ativo ? "Ativo" : "Inativo"}</td>
    <td data-label="Link da loja">
      <button class="botao-icone btn-copiar-link" data-slug="${cliente.slug}">Copiar link</button>
    </td>
    <td data-label="Ações">
      <button class="botao-icone btn-editar" data-id="${cliente.id}">Editar</button>
      <button class="botao-icone btn-apagar" data-id="${cliente.id}">Apagar</button>
    </td>
  `;
  tbody.appendChild(tr);
});

  // Liga os botões de editar/apagar/copiar link de cada linha
  document.querySelectorAll(".btn-editar").forEach((btn) => {
    btn.addEventListener("click", () => abrirModalEdicao(btn.dataset.id, clientes));
  });

  document.querySelectorAll(".btn-apagar").forEach((btn) => {
    btn.addEventListener("click", () => apagarCliente(btn.dataset.id));
  });

  document.querySelectorAll(".btn-copiar-link").forEach((btn) => {
    btn.addEventListener("click", () => copiarLinkCliente(btn.dataset.slug, btn));
  });
}

// --- Abrir modal (novo cliente) ---
function abrirModalNovo() {
  clienteEditandoId = null;
  document.getElementById("form-cliente").reset();
  document.getElementById("cliente-id").value = "";
  document.querySelector("#modal-cliente h2").textContent = "Novo cliente";
  document.getElementById("modal-cliente").classList.remove("escondido");
}



// --- Abrir modal (edição) ---
function abrirModalEdicao(id, clientes) {
  const cliente = clientes.find((c) => String(c.id) === String(id));
  if (!cliente) return;

  clienteEditandoId = cliente.id;

  document.getElementById("cliente-id").value = cliente.id;
  document.getElementById("cliente-nome").value = cliente.nome || "";
  document.getElementById("cliente-slug").value = cliente.slug || "";
  document.getElementById("cliente-contato").value = cliente.contato || "";
  document.getElementById("cliente-responsavel").value = cliente.responsavel || "";
  document.getElementById("cliente-pagamento").value = cliente.pagamento || "";
  document.getElementById("cliente-pedido-minimo").value = cliente.pedido_minimo || "";

  document.querySelector("#modal-cliente h2").textContent = "Editar cliente";
  document.getElementById("modal-cliente").classList.remove("escondido");
}

// --- Fechar modal ---
function fecharModal() {
  document.getElementById("modal-cliente").classList.add("escondido");
  clienteEditandoId = null;
}

// --- Salvar (criar ou atualizar) ---
async function salvarCliente(event) {
  event.preventDefault();

  const payload = {
    nome: document.getElementById("cliente-nome").value.trim(),
    slug: document.getElementById("cliente-slug").value.trim(),
    contato: document.getElementById("cliente-contato").value.trim(),
    responsavel: document.getElementById("cliente-responsavel").value.trim(),
    pagamento: document.getElementById("cliente-pagamento").value.trim(),
    pedido_minimo: parseFloat(document.getElementById("cliente-pedido-minimo").value) || 0,
  };

  let error;

  if (clienteEditandoId) {
    ({ error } = await supabaseClient
      .from("clientes")
      .update(payload)
      .eq("id", clienteEditandoId));
  } else {
    ({ error } = await supabaseClient
      .from("clientes")
      .insert([{ ...payload, ativo: true }]));
  }

  if (error) {
    console.error("Erro ao salvar cliente:", error);
    alert("Erro ao salvar cliente: " + error.message);
    return;
  }

  fecharModal();
  await carregarClientes();
}

// --- Apagar cliente ---
async function apagarCliente(id) {
  const confirmar = confirm("Tem certeza que deseja apagar esse cliente? Essa ação não pode ser desfeita.");
  if (!confirmar) return;

  const { error } = await supabaseClient
    .from("clientes")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Erro ao apagar cliente:", error);
    alert("Erro ao apagar cliente: " + error.message);
    return;
  }

  await carregarClientes();
}

// --- Inicialização ---
document.addEventListener("DOMContentLoaded", async () => {
  await verificarSessao();
  await carregarClientes();

  document.getElementById("btn-novo-cliente").addEventListener("click", abrirModalNovo);
  document.getElementById("btn-cancelar-cliente").addEventListener("click", fecharModal);
  document.getElementById("form-cliente").addEventListener("submit", salvarCliente);

  // Gera slug automático conforme digita o nome (só se o slug estiver vazio)
  document.getElementById("cliente-nome").addEventListener("input", (e) => {
    const slugField = document.getElementById("cliente-slug");
    if (!clienteEditandoId && !slugField.dataset.editadoManualmente) {
      slugField.value = gerarSlug(e.target.value);
    }
  });

  // Se o usuário editar o slug manualmente, para de auto-gerar
  document.getElementById("cliente-slug").addEventListener("input", (e) => {
    e.target.dataset.editadoManualmente = "true";
  });

  // Logout
  document.getElementById("btn-logout").addEventListener("click", async () => {
    await fazerLogout();
    window.location.href = "index.html";
  });
});