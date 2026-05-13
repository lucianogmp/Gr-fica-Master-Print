/**
 * MAIN.JS — Ponto de entrada.
 * Importa os estilos e inicializa o app com a nova arquitetura.
 */
import "./styles.css";
import { initApp } from "./app.js";
import { injectLayoutCSS } from "./ui/views/layout.js";

// Injeta CSS extras do layout antes de montar
injectLayoutCSS();

// Inicializa o ERP
initApp().catch(err => {
  console.error("[ERP] Falha crítica na inicialização:", err);
  document.getElementById("app").innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:16px;font-family:system-ui">
      <div style="font-size:48px">⚠️</div>
      <div style="font-size:18px;font-weight:700;color:#e53935">Erro ao inicializar o ERP</div>
      <div style="font-size:14px;color:#888">${err.message}</div>
      <button onclick="location.reload()" style="padding:10px 24px;background:#00c49a;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px">
        ↺ Tentar novamente
      </button>
    </div>`;
});
