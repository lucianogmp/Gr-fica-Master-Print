// ─── Modal Global ─────────────────────────────────────────────────────────────
// Garante que modais ficam no document.body, evitando bug de position:fixed
// dentro de containers com overflow/transform

/**
 * Retorna (ou cria) o container raiz de modais no body.
 */
function getRoot() {
  let root = document.getElementById("app-modal-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "app-modal-root";
    document.body.appendChild(root);
  }
  return root;
}

/**
 * Abre um modal.
 * @param {string} html       — Conteúdo interno do <div class="modal">
 * @param {string} maxWidth   — Ex: "480px" (padrão "480px")
 * @returns {HTMLElement}     — Elemento .modal para vincular eventos
 */
export function openModal(html, maxWidth = "480px") {
  closeModal(); // fecha eventual modal aberto

  const root = getRoot();
  root.innerHTML = `
    <div class="modal-bg" id="modal-bg-active">
      <div class="modal" style="max-width:${maxWidth}">${html}</div>
    </div>`;

  // Fechar ao clicar no fundo
  root.querySelector("#modal-bg-active").addEventListener("click", e => {
    if (e.target.id === "modal-bg-active") closeModal();
  });

  // Fechar com ESC
  const onEsc = e => { if (e.key === "Escape") { closeModal(); document.removeEventListener("keydown", onEsc); } };
  document.addEventListener("keydown", onEsc);

  return root.querySelector(".modal");
}

/**
 * Fecha o modal aberto.
 */
export function closeModal() {
  const root = document.getElementById("app-modal-root");
  if (root) root.innerHTML = "";
}
