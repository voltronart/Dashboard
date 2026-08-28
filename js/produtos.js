// ==========================================
// produtos.js - CRUD de produtos (catálogo geral) - OTIMIZADO
// ==========================================

let produtoEditandoId = null;
let arquivoImagemSelecionado = null;
let imagemAtualUrl = null;

// --- Configurações de otimização ---
const CONFIG_IMAGEM = {
  LARGURA_MAX: 800,      // Reduz imagens maiores que isso
  ALTURA_MAX: 800,
  QUALIDADE: 0.8,        // 80% de qualidade (bom equilíbrio)
  FORMATO: 'image/webp'  // WebP é 25-35% mais leve que JPEG
};

// --- Proteção de rota ---
async function verificarSessao() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = "index.html";
  }
}

// --- Buscar e renderizar produtos ---
async function carregarProdutos() {
  const { data, error } = await supabaseClient
    .from("produtos")
    .select("*")
    .order("nome", { ascending: true });

  if (error) {
    console.error("Erro ao buscar produtos:", error);
    return;
  }

  renderizarTabela(data);
}

function renderizarTabela(produtos) {
  const tbody = document.getElementById("tabela-produtos-body");
  tbody.innerHTML = "";

  if (produtos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6">Nenhum produto cadastrado ainda.</td></tr>`;
    return;
  }

  produtos.forEach((produto) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td data-label>
        ${produto.imagem_url
          ? `<img src="${produto.imagem_url}" 
                  alt="${produto.nome}" 
                  loading="lazy"
                  style="width:48px; height:48px; object-fit:cover; border-radius:6px;">`
          : "-"}
      </td>
      <td data-label>${produto.nome}</td>
      <td data-label>${produto.unidade || "-"}</td>
      <td data-label>${formatarPreco(produto.preco)}</td>
      <td data-label>${produto.disponivel ? "Disponível" : "Indisponível"}</td>
      <td data-label>
        <button class="botao-icone btn-editar" data-id="${produto.id}">Editar</button>
        <button class="botao-icone btn-apagar" data-id="${produto.id}">Apagar</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  document.querySelectorAll(".btn-editar").forEach((btn) => {
    btn.addEventListener("click", () => abrirModalEdicao(btn.dataset.id, produtos));
  });

  document.querySelectorAll(".btn-apagar").forEach((btn) => {
    btn.addEventListener("click", () => apagarProduto(btn.dataset.id));
  });
}

// --- Abrir modal (novo produto) ---
function abrirModalNovo() {
  produtoEditandoId = null;
  arquivoImagemSelecionado = null;
  imagemAtualUrl = null;

  document.getElementById("form-produto").reset();
  document.getElementById("produto-id").value = "";
  document.getElementById("produto-disponivel").checked = true;

  const preview = document.getElementById("preview-imagem");
  preview.src = "";
  preview.style.display = "none";

  document.querySelector("#modal-produto h2").textContent = "Novo produto";
  document.getElementById("modal-produto").classList.remove("escondido");
}

// --- Abrir modal (edição) ---
function abrirModalEdicao(id, produtos) {
  const produto = produtos.find((p) => String(p.id) === String(id));
  if (!produto) return;

  produtoEditandoId = produto.id;
  arquivoImagemSelecionado = null;
  imagemAtualUrl = produto.imagem_url || null;

  document.getElementById("produto-id").value = produto.id;
  document.getElementById("produto-nome").value = produto.nome || "";
  document.getElementById("produto-descricao").value = produto.descricao || "";
  document.getElementById("produto-unidade").value = produto.unidade || "";
  document.getElementById("produto-preco").value = produto.preco || "";
  document.getElementById("produto-disponivel").checked = !!produto.disponivel;

  const preview = document.getElementById("preview-imagem");
  if (produto.imagem_url) {
    preview.src = produto.imagem_url;
    preview.style.display = "block";
  } else {
    preview.src = "";
    preview.style.display = "none";
  }

  document.querySelector("#modal-produto h2").textContent = "Editar produto";
  document.getElementById("modal-produto").classList.remove("escondido");
}

// --- Fechar modal ---
function fecharModal() {
  document.getElementById("modal-produto").classList.add("escondido");
  produtoEditandoId = null;
  arquivoImagemSelecionado = null;
}

// --- Preview da imagem escolhida ---
function configurarPreviewImagem() {
  document.getElementById("produto-imagem").addEventListener("change", async (e) => {
    const arquivo = e.target.files[0];
    if (!arquivo) return;

    // Comprime a imagem antes de mostrar preview
    const imagemComprimida = await comprimirImagem(arquivo);
    arquivoImagemSelecionado = imagemComprimida;

    const preview = document.getElementById("preview-imagem");
    preview.src = URL.createObjectURL(imagemComprimida);
    preview.style.display = "block";
  });
}

// --- 🎯 NOVO: Compressão de imagem com Canvas ---
async function comprimirImagem(arquivo) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let largura = img.width;
        let altura = img.height;

        // Calcula proporção mantendo aspect ratio
        if (largura > CONFIG_IMAGEM.LARGURA_MAX || altura > CONFIG_IMAGEM.ALTURA_MAX) {
          const proporcao = Math.min(
            CONFIG_IMAGEM.LARGURA_MAX / largura,
            CONFIG_IMAGEM.ALTURA_MAX / altura
          );
          largura = largura * proporcao;
          altura = altura * proporcao;
        }

        canvas.width = largura;
        canvas.height = altura;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, largura, altura);

        // Converte para WebP comprimido
        canvas.toBlob(
          (blob) => {
            const arquivoComprimido = new File(
              [blob], 
              `imagem-${Date.now()}.webp`, 
              { type: 'image/webp' }
            );
            resolve(arquivoComprimido);
          },
          CONFIG_IMAGEM.FORMATO,
          CONFIG_IMAGEM.QUALIDADE
        );
      };

      img.src = e.target.result;
    };

    reader.readAsDataURL(arquivo);
  });
}

// --- Faz upload da imagem pro Storage e retorna a URL pública ---
async function fazerUploadImagem(arquivo) {
  const extensao = 'webp'; // Sempre WebP
  const nomeArquivo = `${Date.now()}-${Math.random().toString(36).slice(2)}.${extensao}`;

  const { error: erroUpload } = await supabaseClient
    .storage
    .from("produtos-imagens")
    .upload(nomeArquivo, arquivo);

  if (erroUpload) {
    throw erroUpload;
  }

  const { data } = supabaseClient
    .storage
    .from("produtos-imagens")
    .getPublicUrl(nomeArquivo);

  return data.publicUrl;
}

// --- Salvar (criar ou atualizar) ---
async function salvarProduto(event) {
  event.preventDefault();

  const botaoSalvar = event.target.querySelector('button[type="submit"]');
  botaoSalvar.disabled = true;
  botaoSalvar.textContent = "Salvando...";

  try {
    let urlImagemFinal = imagemAtualUrl;

    if (arquivoImagemSelecionado) {
      urlImagemFinal = await fazerUploadImagem(arquivoImagemSelecionado);
    }

    const payload = {
      nome: document.getElementById("produto-nome").value.trim(),
      descricao: document.getElementById("produto-descricao").value.trim(),
      unidade: document.getElementById("produto-unidade").value.trim(),
      preco: parseFloat(document.getElementById("produto-preco").value) || 0,
      disponivel: document.getElementById("produto-disponivel").checked,
      imagem_url: urlImagemFinal,
    };

    let error;

    if (produtoEditandoId) {
      ({ error } = await supabaseClient
        .from("produtos")
        .update(payload)
        .eq("id", produtoEditandoId));
    } else {
      ({ error } = await supabaseClient
        .from("produtos")
        .insert([payload]));
    }

    if (error) {
      console.error("Erro ao salvar produto:", error);
      alert("Erro ao salvar produto: " + error.message);
      return;
    }

    fecharModal();
    await carregarProdutos();

  } catch (erro) {
    console.error("Erro ao processar upload/salvar:", erro);
    alert("Erro ao salvar produto: " + erro.message);
  } finally {
    botaoSalvar.disabled = false;
    botaoSalvar.textContent = "Salvar";
  }
}

// --- Apagar produto ---
async function apagarProduto(id) {
  const confirmar = confirm("Tem certeza que deseja apagar esse produto? Essa ação não pode ser desfeita.");
  if (!confirmar) return;

  const { error } = await supabaseClient
    .from("produtos")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Erro ao apagar produto:", error);
    alert("Erro ao apagar produto: " + error.message);
    return;
  }

  await carregarProdutos();
}

// --- Inicialização ---
document.addEventListener("DOMContentLoaded", async () => {
  await verificarSessao();
  await carregarProdutos();
  configurarPreviewImagem();

  document.getElementById("btn-novo-produto").addEventListener("click", abrirModalNovo);
  document.getElementById("btn-cancelar-produto").addEventListener("click", fecharModal);
  document.getElementById("form-produto").addEventListener("submit", salvarProduto);

  document.getElementById("btn-logout").addEventListener("click", async () => {
    await fazerLogout();
    window.location.href = "index.html";
  });
});
