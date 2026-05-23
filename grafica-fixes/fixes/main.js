/**
 * MAIN.JS — Ponto de entrada.
 * Importa estilos e inicializa o app.
 */
import "./styles.css";
import { initApp } from "./app.js";
import { injectLayoutCSS } from "./ui/views/layout.js";

// Aplica tema antes de tudo para evitar flash de tema errado
const savedTheme = localStorage.getItem("theme") || "dark";
document.documentElement.dataset.theme = savedTheme;

// Injeta CSS auxiliar
injectLayoutCSS();

// Inicializa o ERP
initApp().catch(err => {
  console.error("[ERP] Falha crítica na inicialização:", err);
  document.getElementById("app").innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                height:100vh;gap:16px;font-family:system-ui;background:#13131f;color:#e8e8f4">
      <div style="font-size:48px">⚠️</div>
      <div style="font-size:18px;font-weight:700;color:#e53935">Erro ao inicializar o ERP</div>
      <div style="font-size:13px;color:#8080a8;max-width:400px;text-align:center">${err.message}</div>
      <button onclick="location.reload()"
        style="padding:10px 24px;background:#00c49a;color:#fff;border:none;border-radius:8px;
               cursor:pointer;font-size:14px;font-family:inherit">
        ↺ Tentar novamente
      </button>
    </div>`;
});
