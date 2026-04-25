export function renderLayout(pages) {
  const root = document.getElementById("app");
  root.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand">Meu Sistema</div>
        <nav class="nav" id="nav"></nav>
        <div class="hint" id="hint"></div>
      </aside>
      <main class="main">
        <div class="topbar">
          <div class="tabs" id="tabs"></div>
        </div>
        <section class="content" id="content"></section>
      </main>
    </div>
  `;

  const nav = root.querySelector("#nav");
  const tabs = root.querySelector("#tabs");
  const content = root.querySelector("#content");
  const hint = root.querySelector("#hint");

  const order = [
    "dashboard",
    "financeiro",
    "orcamento",
    "vendas",
    "clientes",
    "produtos",
    "estoque",
    "producao",
    "configuracoes",
  ];

  nav.innerHTML = order.map((k) => `<button class="nav-btn" data-key="${k}">${pages[k].label}</button>`).join("");
  tabs.innerHTML = order.map((k) => `<button class="tab-btn" data-key="${k}">${pages[k].label}</button>`).join("");

  function mountPage(key) {
    content.innerHTML = `<div class="loading">Carregando...</div>`;
    const page = pages[key];
    page.mount(content);
    order.forEach((k) => {
      nav.querySelectorAll(".nav-btn").forEach((b) => b.classList.toggle("active", b.dataset.key === key));
      tabs.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.key === key));
    });
  }

  root.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-key]");
    if (!btn) return;
    const key = btn.dataset.key;
    window.location.hash = key;
  });

  // default / restore
  const initial = window.location.hash.replace("#", "") || "dashboard";
  mountPage(initial);

  window.addEventListener("hashchange", () => mountPage(window.location.hash.replace("#", "") || "dashboard"));
  hint.textContent = "Starter pronto — vamos preencher as telas e integrações.";
}
