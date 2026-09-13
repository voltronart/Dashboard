// ==========================================
// mercado.js
// Controle de entregas ao mercado
// ==========================================

// ==========================================
// ESTADO DA PÁGINA
// ==========================================

let entregasCache = [];
let produtosCache = [];

let entregaEditandoId = null;
let entregaEditandoGrupo = null;

let periodoAtual = "mes";


// ==========================================
// SESSÃO
// ==========================================

async function verificarSessao() {

  const {
    data: { session }
  } = await supabaseClient.auth.getSession();

  if (!session) {
    window.location.href = "index.html";
  }
}


// ==========================================
// PRODUTOS
// ==========================================

async function carregarProdutos() {

  const { data, error } = await supabaseClient
    .from("produtos")
    .select("id, nome, unidade")
    .order("nome", { ascending: true });

  if (error) {

    console.error("Erro ao carregar produtos:", error);

    alert("Não foi possível carregar os produtos.");

    return;
  }

  produtosCache = data || [];

  console.log("Produtos carregados:", produtosCache);
}


// ==========================================
// ENTREGAS
// ==========================================

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


// ==========================================
// FILTRO DE PERÍODO
// ==========================================

function calcularIntervaloPeriodo(periodo) {

  const agora = new Date();

  const hoje = new Date(
    agora.getFullYear(),
    agora.getMonth(),
    agora.getDate()
  );


  // ------------------------------
  // DIA
  // ------------------------------

  if (periodo === "dia") {

    const inicio = hoje;

    const fim = new Date(hoje);

    fim.setDate(fim.getDate() + 1);

    return {
      inicio,
      fim
    };
  }


  // ------------------------------
  // SEMANA
  // ------------------------------

  if (periodo === "semana") {

    const diaSemana = hoje.getDay();

    const deslocamento =
      diaSemana === 0
        ? 6
        : diaSemana - 1;

    const inicio = new Date(hoje);

    inicio.setDate(
      inicio.getDate() - deslocamento
    );

    const fim = new Date(inicio);

    fim.setDate(
      fim.getDate() + 7
    );

    return {
      inicio,
      fim
    };
  }


  // ------------------------------
  // MÊS
  // ------------------------------

  if (periodo === "mes") {

    const inicio = new Date(
      agora.getFullYear(),
      agora.getMonth(),
      1
    );

    const fim = new Date(
      agora.getFullYear(),
      agora.getMonth() + 1,
      1
    );

    return {
      inicio,
      fim
    };
  }


  // ------------------------------
  // TUDO
  // ------------------------------

  return null;
}


function formatarLabelPeriodo(periodo) {

  const opcoesData = {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  };

  const intervalo =
    calcularIntervaloPeriodo(periodo);

  if (!intervalo) {
    return "Todas as entregas";
  }

  const fimExibicao =
    new Date(intervalo.fim);

  fimExibicao.setDate(
    fimExibicao.getDate() - 1
  );

  return `${intervalo.inicio.toLocaleDateString(
    "pt-BR",
    opcoesData
  )} a ${fimExibicao.toLocaleDateString(
    "pt-BR",
    opcoesData
  )}`;
}


function filtrarPorPeriodo(lista, periodo) {

  const intervalo =
    calcularIntervaloPeriodo(periodo);

  if (!intervalo) {
    return lista;
  }

  return lista.filter((entrega) => {

    const data = new Date(
      entrega.data_entrega + "T00:00:00"
    );

    return (
      data >= intervalo.inicio &&
      data < intervalo.fim
    );
  });
}


function aplicarFiltro() {

  const filtradas =
    filtrarPorPeriodo(
      entregasCache,
      periodoAtual
    );

  renderizarResumo(filtradas);

  renderizarTabela(filtradas);

  document.getElementById(
    "periodo-label"
  ).textContent =
    formatarLabelPeriodo(periodoAtual);
}


function configurarFiltro() {

  const botoes =
    document.querySelectorAll(
      ".botao-periodo"
    );

  botoes.forEach((btn) => {

    btn.addEventListener("click", () => {

      periodoAtual =
        btn.dataset.periodo;

      botoes.forEach((b) => {
        b.classList.remove("ativo");
      });

      btn.classList.add("ativo");

      aplicarFiltro();
    });
  });
}


// ==========================================
// RESUMO
// ==========================================

function contarEntregasUnicas(lista) {

  const grupos = new Set();

  lista.forEach((entrega) => {

    // Entrega nova possui grupo_entrega.
    if (entrega.grupo_entrega) {

      grupos.add(
        `grupo-${entrega.grupo_entrega}`
      );

      return;
    }

    // Registros antigos não possuem grupo.
    // Cada registro antigo será considerado
    // uma entrega independente.

    grupos.add(
      `registro-${entrega.id}`
    );
  });

  return grupos.size;
}


function renderizarResumo(lista) {

  const totalQuantidade =
    lista.reduce(
      (soma, entrega) =>
        soma + Number(entrega.quantidade),
      0
    );

  const totalEntregas =
    contarEntregasUnicas(lista);

  document.getElementById(
    "resumo-total-quantidade"
  ).textContent =
    totalQuantidade;

  document.getElementById(
    "resumo-total-entregas"
  ).textContent =
    totalEntregas;
}


// ==========================================
// TABELA
// ==========================================

function formatarDataCurta(valor) {

  const data =
    new Date(valor + "T00:00:00");

  return data.toLocaleDateString(
    "pt-BR"
  );
}


function renderizarTabela(lista) {

  const corpo =
    document.getElementById(
      "tabela-mercado-body"
    );

  corpo.innerHTML = "";


  if (lista.length === 0) {

    corpo.innerHTML = `
      <tr>
        <td colspan="5">
          Nenhuma entrega registrada neste período.
        </td>
      </tr>
    `;

    return;
  }


  lista.forEach((entrega) => {

    const tr =
      document.createElement("tr");

    tr.innerHTML = `
      <td>
        ${formatarDataCurta(
          entrega.data_entrega
        )}
      </td>

      <td>
        ${entrega.produto}
      </td>

      <td>
        ${entrega.quantidade}
        ${entrega.unidade || ""}
      </td>

      <td>
        ${entrega.observacao || "-"}
      </td>

      <td class="acoes">

        <button
          class="botao-icone btn-editar-entrega"
          data-id="${entrega.id}"
        >
          ✏
        </button>

        <button
          class="botao-icone perigo btn-apagar-entrega"
          data-id="${entrega.id}"
        >
          🗑
        </button>

      </td>
    `;

    corpo.appendChild(tr);
  });


  document
    .querySelectorAll(".btn-editar-entrega")
    .forEach((btn) => {

      btn.addEventListener(
        "click",
        () => {
          abrirModalEdicao(
            btn.dataset.id
          );
        }
      );
    });


  document
    .querySelectorAll(".btn-apagar-entrega")
    .forEach((btn) => {

      btn.addEventListener(
        "click",
        () => {
          apagarEntrega(
            btn.dataset.id
          );
        }
      );
    });
}


// ==========================================
// LINHAS DE PRODUTOS
// ==========================================

function criarLinhaProduto(dados = {}) {

  const lista =
    document.getElementById(
      "lista-produtos-entrega"
    );


  const linha =
    document.createElement("div");

  linha.className =
    "item-produto-entrega";


  // ------------------------------------------
  // SELECT DO PRODUTO
  // ------------------------------------------

  const select =
    document.createElement("select");

  select.className =
    "mercado-produto-item";

  select.required = true;


  const opcaoInicial =
    document.createElement("option");

  opcaoInicial.value = "";

  opcaoInicial.textContent =
    "Selecione o produto";

  select.appendChild(
    opcaoInicial
  );


  produtosCache.forEach((produto) => {

    const option =
      document.createElement("option");

    option.value =
      produto.nome;

    option.textContent =
      produto.nome;

    select.appendChild(option);
  });


  // Caso o produto antigo não exista
  // mais na tabela produtos.
  if (
    dados.produto &&
    !produtosCache.some(
      (produto) =>
        produto.nome === dados.produto
    )
  ) {

    const option =
      document.createElement("option");

    option.value =
      dados.produto;

    option.textContent =
      dados.produto;

    select.appendChild(option);
  }


  if (dados.produto) {

    select.value =
      dados.produto;
  }


  // ------------------------------------------
  // QUANTIDADE
  // ------------------------------------------

  const quantidade =
    document.createElement("input");

  quantidade.type =
    "number";

  quantidade.className =
    "mercado-quantidade-item";

  quantidade.placeholder =
    "Quantidade";

  quantidade.step =
    "0.01";

  quantidade.min =
    "0";

  quantidade.required =
    true;

  quantidade.value =
    dados.quantidade || "";


  // ------------------------------------------
  // UNIDADE
  // ------------------------------------------

  const unidade =
    document.createElement("input");

  unidade.type =
    "text";

  unidade.className =
    "mercado-unidade-item";

  unidade.placeholder =
    "Unidade";

  unidade.readOnly =
    true;


  // ------------------------------------------
  // BOTÃO REMOVER
  // ------------------------------------------

  const remover =
    document.createElement("button");

  remover.type =
    "button";

  remover.className =
    "botao-icone perigo";

  remover.textContent =
    "🗑";


  // ------------------------------------------
  // ATUALIZAR UNIDADE
  // ------------------------------------------

  function atualizarUnidade() {

    const produtoSelecionado =
      produtosCache.find(
        (produto) =>
          produto.nome === select.value
      );

    unidade.value =
      produtoSelecionado?.unidade || "";
  }


  select.addEventListener(
    "change",
    atualizarUnidade
  );


  // ------------------------------------------
  // REMOVER LINHA
  // ------------------------------------------

  remover.addEventListener(
    "click",
    () => {

      const quantidadeLinhas =
        lista.querySelectorAll(
          ".item-produto-entrega"
        ).length;

      if (quantidadeLinhas <= 1) {

        alert(
          "A entrega precisa ter pelo menos um produto."
        );

        return;
      }

      linha.remove();
    }
  );


  // ------------------------------------------
  // MONTAR LINHA
  // ------------------------------------------

  linha.appendChild(select);

  linha.appendChild(quantidade);

  linha.appendChild(unidade);

  linha.appendChild(remover);

  lista.appendChild(linha);


  // Atualiza unidade quando estiver editando.
  atualizarUnidade();
}


// ==========================================
// LIMPAR PRODUTOS
// ==========================================

function limparListaProdutos() {

  document.getElementById(
    "lista-produtos-entrega"
  ).innerHTML = "";
}


// ==========================================
// NOVA ENTREGA
// ==========================================

function abrirModalNovo() {

  entregaEditandoId = null;

  entregaEditandoGrupo = null;


  document.getElementById(
    "form-mercado"
  ).reset();


  document.getElementById(
    "mercado-data"
  ).value =
    new Date()
      .toISOString()
      .slice(0, 10);


  limparListaProdutos();


  // Toda nova entrega começa
  // com um produto.
  criarLinhaProduto();


  document.getElementById(
    "modal-mercado-titulo"
  ).textContent =
    "Nova Entrega";


  document.getElementById(
    "modalMercado"
  ).classList.remove("escondido");
}


// ==========================================
// EDITAR ENTREGA
// ==========================================

function abrirModalEdicao(id) {

  const entrega =
    entregasCache.find(
      (e) =>
        String(e.id) === String(id)
    );


  if (!entrega) {
    return;
  }


  entregaEditandoId =
    id;

  entregaEditandoGrupo =
    entrega.grupo_entrega || null;


  let itens;


  // Se possui grupo, pegamos
  // todos os produtos daquela entrega.
  if (entrega.grupo_entrega) {

    itens =
      entregasCache.filter(
        (e) =>
          e.grupo_entrega ===
          entrega.grupo_entrega
      );

  } else {

    // Registro antigo.
    itens = [entrega];
  }


  document.getElementById(
    "mercado-data"
  ).value =
    entrega.data_entrega;


  document.getElementById(
    "mercado-observacao"
  ).value =
    entrega.observacao || "";


  limparListaProdutos();


  itens.forEach((item) => {

    criarLinhaProduto({
      produto: item.produto,
      quantidade: item.quantidade
    });
  });


  document.getElementById(
    "modal-mercado-titulo"
  ).textContent =
    "Editar Entrega";


  document.getElementById(
    "modalMercado"
  ).classList.remove("escondido");
}


// ==========================================
// FECHAR MODAL
// ==========================================

function fecharModal() {

  document.getElementById(
    "modalMercado"
  ).classList.add("escondido");


  entregaEditandoId =
    null;

  entregaEditandoGrupo =
    null;
}


// ==========================================
// SALVAR ENTREGA
// ==========================================

async function salvarEntrega(event) {

  event.preventDefault();


  const dataEntrega =
    document.getElementById(
      "mercado-data"
    ).value;


  const observacao =
    document.getElementById(
      "mercado-observacao"
    ).value.trim() || null;


  const linhas =
    document.querySelectorAll(
      ".item-produto-entrega"
    );


  if (linhas.length === 0) {

    alert(
      "Adicione pelo menos um produto."
    );

    return;
  }


  const produtosSelecionados = [];

  const itens = [];


  for (const linha of linhas) {

    const produto =
      linha.querySelector(
        ".mercado-produto-item"
      ).value;


    const quantidade =
      parseFloat(
        linha.querySelector(
          ".mercado-quantidade-item"
        ).value
      );


    const unidade =
      linha.querySelector(
        ".mercado-unidade-item"
      ).value.trim() || null;


    if (!produto) {

      alert(
        "Selecione um produto em todas as linhas."
      );

      return;
    }


    if (
      !Number.isFinite(quantidade) ||
      quantidade <= 0
    ) {

      alert(
        "Informe uma quantidade válida para todos os produtos."
      );

      return;
    }


    // Impede o mesmo produto
    // duas vezes na mesma entrega.
    if (
      produtosSelecionados.includes(
        produto
      )
    ) {

      alert(
        `O produto "${produto}" foi adicionado mais de uma vez.`
      );

      return;
    }


    produtosSelecionados.push(
      produto
    );


    itens.push({
      data_entrega: dataEntrega,
      produto,
      quantidade,
      unidade,
      observacao,
      grupo_entrega:
        entregaEditandoGrupo ||
        crypto.randomUUID()
    });
  }


  let error;


  // ========================================
  // NOVA ENTREGA
  // ========================================

  if (!entregaEditandoId) {

    ({ error } =
      await supabaseClient
        .from("mercado_entregas")
        .insert(itens));

  }


  // ========================================
  // EDITANDO ENTREGA COM GRUPO
  // ========================================

  else if (entregaEditandoGrupo) {

    // Remove os produtos antigos
    // daquele grupo.
    const resultadoDelete =
      await supabaseClient
        .from("mercado_entregas")
        .delete()
        .eq(
          "grupo_entrega",
          entregaEditandoGrupo
        );


    if (resultadoDelete.error) {

      console.error(
        "Erro ao atualizar grupo:",
        resultadoDelete.error
      );

      alert(
        "Erro ao atualizar entrega: " +
        resultadoDelete.error.message
      );

      return;
    }


    // Insere novamente os produtos
    // atualizados.
    ({ error } =
      await supabaseClient
        .from("mercado_entregas")
        .insert(itens));
  }


  // ========================================
  // EDITANDO REGISTRO ANTIGO
  // ========================================

  else {

    const resultadoDelete =
      await supabaseClient
        .from("mercado_entregas")
        .delete()
        .eq(
          "id",
          entregaEditandoId
        );


    if (resultadoDelete.error) {

      console.error(
        "Erro ao atualizar entrega antiga:",
        resultadoDelete.error
      );

      alert(
        "Erro ao atualizar entrega: " +
        resultadoDelete.error.message
      );

      return;
    }


    ({ error } =
      await supabaseClient
        .from("mercado_entregas")
        .insert(itens));
  }


  // ========================================
  // TRATAMENTO DE ERRO
  // ========================================

  if (error) {

    console.error(
      "Erro ao salvar entrega:",
      error
    );

    alert(
      "Erro ao salvar: " +
      error.message
    );

    return;
  }


  // ========================================
  // FINALIZAÇÃO
  // ========================================

  fecharModal();

  await carregarEntregas();
}


// ==========================================
// APAGAR ENTREGA
// ==========================================

async function apagarEntrega(id) {

  const entrega =
    entregasCache.find(
      (e) =>
        String(e.id) === String(id)
    );


  if (!entrega) {
    return;
  }


  let mensagem;


  if (entrega.grupo_entrega) {

    mensagem =
      "Essa entrega possui vários produtos. Deseja apagar a entrega inteira?";

  } else {

    mensagem =
      "Tem certeza que deseja apagar esse registro?";
  }


  const confirmar =
    confirm(mensagem);


  if (!confirmar) {
    return;
  }


  let query;


  if (entrega.grupo_entrega) {

    query =
      supabaseClient
        .from("mercado_entregas")
        .delete()
        .eq(
          "grupo_entrega",
          entrega.grupo_entrega
        );

  } else {

    query =
      supabaseClient
        .from("mercado_entregas")
        .delete()
        .eq(
          "id",
          id
        );
  }


  const { error } =
    await query;


  if (error) {

    console.error(
      "Erro ao apagar entrega:",
      error
    );

    alert(
      "Erro ao apagar: " +
      error.message
    );

    return;
  }


  await carregarEntregas();
}


// ==========================================
// INICIALIZAÇÃO
// ==========================================

document.addEventListener(
  "DOMContentLoaded",
  async () => {

    await verificarSessao();

    // Primeiro carregamos os produtos.
    await carregarProdutos();

    configurarFiltro();

    await carregarEntregas();


    // Nova entrega
    document
      .getElementById(
        "btn-nova-entrega"
      )
      .addEventListener(
        "click",
        abrirModalNovo
      );


    // Adicionar produto
    document
      .getElementById(
        "btn-adicionar-produto-entrega"
      )
      .addEventListener(
        "click",
        () => {
          criarLinhaProduto();
        }
      );


    // Cancelar
    document
      .getElementById(
        "btn-cancelar-mercado"
      )
      .addEventListener(
        "click",
        fecharModal
      );


    // Salvar
    document
      .getElementById(
        "form-mercado"
      )
      .addEventListener(
        "submit",
        salvarEntrega
      );


    // Logout
    document
      .getElementById(
        "btn-logout"
      )
      .addEventListener(
        "click",
        async () => {

          await fazerLogout();

          window.location.href =
            "index.html";
        }
      );
  }
);