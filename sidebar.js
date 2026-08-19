// ==========================================
// sidebar.js
// ==========================================
// Injeta o menu lateral no elemento #sidebar-slot.
// Mantém a navegação consistente entre todas as páginas
// da dashboard (financeiro, pedidos, produtos, produção...).
//
// Uso: <div id="sidebar-slot"></div> no HTML, e este script
// carregado antes de precisar do menu.

function montarSidebar() {
  const slot = document.getElementById("sidebar-slot");
  if (!slot) return;

  const paginaAtual = window.location.pathname.split("/").pop();

  const links = [
    { href: "clientes.html", label: "Clientes" },
    { href: "produtos.html", label: "Produtos" },
    { href: "produtos-avulso.html", label: "Produtos Avulso" },
    { href: "pedidos.html", label: "Pedidos" },
    { href: "financeiro.html", label: "Financeiro" },
    { href: "cadastro-cultivos.html", label: "Cultivos" },
    { href: "cadastro-canteiros.html", label: "Canteiros" },
  ];

  const linksHtml = links
    .map((link) => {
      const ativo = link.href === paginaAtual ? "ativo" : "";
      return `<a href="${link.href}" class="nav-link ${ativo}">${link.label}</a>`;
    })
    .join("");

  slot.innerHTML = `
    <aside class="sidebar">
      <div class="sidebar-topo">
        <h2>Jogi Hortaliças</h2>
      </div>
      <nav class="sidebar-nav">
        ${linksHtml}
      </nav>
      <div class="sidebar-rodape">
        <button id="btn-logout" class="nav-link">Sair</button>
      </div>
    </aside>
  `;

  const btnLogout = document.getElementById("btn-logout");
  if (btnLogout) {
    btnLogout.addEventListener("click", async () => {
      if (typeof fazerLogout === "function") {
        await fazerLogout();
      }
      window.location.href = "index.html";
    });
  }
}

document.addEventListener("DOMContentLoaded", montarSidebar);
