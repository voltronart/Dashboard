// ==========================================
// produtos-avulso.js - CRUD de produtos do cardápio avulso
// ==========================================

let produtoEditandoId = null;
let produtoParaExcluirId = null;
let produtosCache = [];

const NOME_BUCKET = "produtos-imagens";

// ==========================================
// Compressão de imagem no navegador (reduz egress do Supabase)
// ==========================================
// Redimensiona para no máximo 800px de largura e converte para
// JPEG com qualidade 75% - reduz o peso do arquivo em até 90%
// sem perda visível de qualidade em um card de produto.
async function comprimirImagem(arquivo, larguraMaxima = 800, qualidade = 0.75) {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      const escala = Math.min(1, larguraMaxima / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = img.width * escala;
      canvas.height = img.height * escala;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Falha ao comprimir a imagem"));
            return;
          }
          resolve(blob);
        },
        "image/jpeg",
        qualidade
      );

      URL.revokeObjectURL(img.src);
    };

    img.onerror = () => reject(new Error("Não foi possível ler a imagem selecionada"));
    img.src = URL.createObjectURL(arquivo);
  });
}

// ==========================================
// Upload de imagem para o Supabase Storage
// ==========================================
// Recebe o arquivo escolhido pelo usuário, comprime, sobe pro
// bucket "produtos-imagens" e retorna a URL pública gerada.
async function fazerUploadImagem(arquivo) {
  const imagemComprimida = await comprimirImagem(arquivo);
  const nomeArquivo = `produto-${Date.now()}.jpg`;

  const { error: erroUpload } = await supabaseClient.storage
    .from(NOME_BUCKET)
    .upload(nomeArquivo, imagemComprimida, {
      cacheControl: "604800", // 7 dias - o navegador do cliente reaproveita a imagem sem baixar de novo
      upsert: false,
      contentType: "image/jpeg",
    });

  if (erroUpload) {
    throw new Error("Erro ao enviar imagem: " + erroUpload.message);
  }

  const { data } = supabaseClient.storage
    .from(NOME_BUCKET)
    .getPublicUrl(nomeArquivo);

  return data.publicUrl;
}

// --- Proteção de rota ---
async function verificarSessao() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = "index.html";
  }
}

// --- Buscar todos os produtos avulsos ---
async function carregarProdutos() {
  const { data, error } = await supabaseClient
    .from("produtos_avulso")
    .select("*")
    .order("nome", { ascending: true });

  if (error) {
    console.error("Erro ao buscar produtos avulsos:", error);
    return;
  }

  produtosCache = data || [];
  renderizarGrid(produtosCache);
}

// --- Renderiza o grid de cards administrativos ---
function renderizarGrid(lista) {
  const grid = document.getElementById("grid-produtos-admin");
  grid.innerHTML = "";

  if (lista.length === 0) {
    grid.innerHTML = `<p class="texto-secundario">Nenhum produto cadastrado ainda.</p>`;
    return;
  }

  lista.forEach((produto) => {
    const badgeClasse = produto.disponivel ? "badge-sucesso" : "badge-alerta";
    const badgeTexto = produto.disponivel ? "Disponível" : "Indisponível";

    const card = document.createElement("article");
    card.className = "card card-produto-admin";
    card.innerHTML = `
      <img src="${produto.imagem_url || ""}" alt="${produto.nome}" class="card-produto-admin-imagem">
      <div class="card-produto-admin-corpo">
        <div class="card-produto-admin-topo">
          <h3>${produto.nome}</h3>
          <span class="badge ${badgeClasse}">${badgeTexto}</span>
        </div>
        <p class="texto-secundario">${produto.descricao || "Sem descrição"}</p>
        <p class="card-produto-admin-preco">${formatarPreco(produto.preco)} / ${produto.unidade || "-"}</p>
        <div class="card-produto-admin-acoes">
          <button class="botao-secundario btn-editar-produto" data-id="${produto.id}">Editar</button>
          <button class="botao-icone perigo btn-apagar-produto" data-id="${produto.id}">Apagar</button>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });

  document.querySelectorAll(".btn-editar-produto").forEach((btn) => {
    btn.addEventListener("click", () => abrirModalEdicao(btn.dataset.id));
  });

  document.querySelectorAll(".btn-apagar-produto").forEach((btn) => {
    btn.addEventListener("click", () => abrirConfirmacaoExclusao(btn.dataset.id));
  });
}

// --- Preview da imagem escolhida ---
function configurarPreviewImagem() {
  const inputArquivo = document.getElementById("produto-imagem-arquivo");
  const preview = document.getElementById("produto-imagem-preview");

  inputArquivo.addEventListener("change", () => {
    const arquivo = inputArquivo.files[0];
    if (!arquivo) {
      preview.classList.add("escondido");
      return;
    }

    const leitor = new FileReader();
    leitor.onload = (e) => {
      preview.src = e.target.result;
      preview.classList.remove("escondido");
    };
    leitor.readAsDataURL(arquivo);
  });
}

// --- Modal: novo / editar ---
function abrirModalNovo() {
  produtoEditandoId = null;
  document.getElementById("form-produto").reset();
  document.getElementById("produto-disponivel").checked = true;
  document.getElementById("produto-imagem").value = "";
  document.getElementById("produto-imagem-preview").classList.add("escondido");
  document.getElementById("modal-produto-titulo").textContent = "Novo Produto";
  document.getElementById("modalProduto").classList.remove("escondido");
}

function abrirModalEdicao(id) {
  const item = produtosCache.find((p) => String(p.id) === String(id));
  if (!item) return;

  produtoEditandoId = id;

  document.getElementById("produto-nome").value = item.nome;
  document.getElementById("produto-descricao").value = item.descricao || "";
  document.getElementById("produto-preco").value = item.preco;
  document.getElementById("produto-unidade").value = item.unidade || "";
  document.getElementById("produto-imagem").value = item.imagem_url || "";
  document.getElementById("produto-imagem-arquivo").value = "";

  const preview = document.getElementById("produto-imagem-preview");
  if (item.imagem_url) {
    preview.src = item.imagem_url;
    preview.classList.remove("escondido");
  } else {
    preview.classList.add("escondido");
  }

  document.getElementById("produto-disponivel").checked = !!item.disponivel;

  document.getElementById("modal-produto-titulo").textContent = "Editar Produto";
  document.getElementById("modalProduto").classList.remove("escondido");
}

function fecharModalProduto() {
  document.getElementById("modalProduto").classList.add("escondido");
  produtoEditandoId = null;
}

// --- Salvar (criar ou atualizar) ---
async function salvarProduto(event) {
  event.preventDefault();

  const botaoSalvar = document.querySelector("#form-produto button[type='submit']");
  const inputArquivo = document.getElementById("produto-imagem-arquivo");
  const arquivoSelecionado = inputArquivo.files[0];

  botaoSalvar.disabled = true;
  botaoSalvar.textContent = "Salvando...";

  try {
    // Se uma nova imagem foi escolhida, faz upload primeiro e pega a URL gerada.
    // Se não escolheu nenhuma nova, mantém a URL que já estava (útil ao editar).
    let imagemUrl = document.getElementById("produto-imagem").value.trim() || null;

    if (arquivoSelecionado) {
      imagemUrl = await fazerUploadImagem(arquivoSelecionado);
    }

    const payload = {
      nome: document.getElementById("produto-nome").value.trim(),
      descricao: document.getElementById("produto-descricao").value.trim() || null,
      preco: parseFloat(document.getElementById("produto-preco").value) || 0,
      unidade: document.getElementById("produto-unidade").value.trim() || null,
      imagem_url: imagemUrl,
      disponivel: document.getElementById("produto-disponivel").checked,
    };

    let error;

    if (produtoEditandoId) {
      ({ error } = await supabaseClient
        .from("produtos_avulso")
        .update(payload)
        .eq("id", produtoEditandoId));
    } else {
      ({ error } = await supabaseClient
        .from("produtos_avulso")
        .insert([payload]));
    }

    if (error) {
      console.error("Erro ao salvar produto avulso:", error);
      alert("Erro ao salvar: " + error.message);
      return;
    }

    fecharModalProduto();
    await carregarProdutos();

  } catch (erro) {
    console.error("Erro ao salvar produto:", erro);
    alert(erro.message);
  } finally {
    botaoSalvar.disabled = false;
    botaoSalvar.textContent = "Salvar";
  }
}

// --- Apagar (com modal de confirmação, sem usar confirm() do navegador) ---
function abrirConfirmacaoExclusao(id) {
  produtoParaExcluirId = id;
  document.getElementById("modalConfirmarExclusaoProduto").classList.remove("escondido");
}

function fecharConfirmacaoExclusao() {
  produtoParaExcluirId = null;
  document.getElementById("modalConfirmarExclusaoProduto").classList.add("escondido");
}

async function confirmarExclusaoProduto() {
  if (!produtoParaExcluirId) return;

  const { error } = await supabaseClient
    .from("produtos_avulso")
    .delete()
    .eq("id", produtoParaExcluirId);

  fecharConfirmacaoExclusao();

  if (error) {
    console.error("Erro ao apagar produto avulso:", error);
    alert("Erro ao apagar: " + error.message);
    return;
  }

  await carregarProdutos();
}

// --- Utilitário ---
function formatarPreco(valor) {
  return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// --- Inicialização ---
document.addEventListener("DOMContentLoaded", async () => {
  await verificarSessao();
  await carregarProdutos();
  configurarPreviewImagem();

  document.getElementById("btn-novo-produto").addEventListener("click", abrirModalNovo);
  document.getElementById("btn-cancelar-produto").addEventListener("click", fecharModalProduto);
  document.getElementById("form-produto").addEventListener("submit", salvarProduto);

  document.getElementById("btn-cancelar-exclusao-produto").addEventListener("click", fecharConfirmacaoExclusao);
  document.getElementById("btn-confirmar-exclusao-produto").addEventListener("click", confirmarExclusaoProduto);

  document.getElementById("btn-logout").addEventListener("click", async () => {
    await fazerLogout();
    window.location.href = "index.html";
  });
});
