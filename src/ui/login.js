/**
 * LOGIN VIEW — Tela de autenticação do ERP.
 * Exibida quando não há sessão ativa.
 */

import { auth } from "../core/auth.js";

export function renderLogin() {
  document.body.innerHTML = `
    <style>${loginCSS()}</style>
    <div class="login-bg">
      <div class="login-card" role="main">

        <!-- Logo / cabeçalho -->
        <div class="login-header">
          <div class="login-logo">
            <i class="fi fi-rr-print"></i>
          </div>
          <h1 class="login-title">Master Print</h1>
          <p class="login-sub">ERP Gráfica — Acesso restrito</p>
        </div>

        <!-- Formulário -->
        <div id="login-form-wrap">
          ${_formLogin()}
        </div>

      </div>
    </div>`;

  _bindLogin();
}

// ─── Formulários ──────────────────────────────────────────────────────────────
function _formLogin() {
  return `
    <form id="login-form" novalidate>
      <div class="login-field">
        <label for="l-email">E-mail</label>
        <div class="login-input-wrap">
          <i class="fi fi-rr-envelope login-input-icon"></i>
          <input
            id="l-email" type="email" name="email"
            placeholder="seu@email.com"
            autocomplete="email" autofocus required
          />
        </div>
      </div>
      <div class="login-field">
        <label for="l-senha">Senha</label>
        <div class="login-input-wrap">
          <i class="fi fi-rr-lock login-input-icon"></i>
          <input
            id="l-senha" type="password" name="password"
            placeholder="••••••••"
            autocomplete="current-password" required
          />
          <button type="button" class="btn-toggle-pass" id="btn-toggle-pass" tabindex="-1" aria-label="Mostrar senha">
            <i class="fi fi-rr-eye" id="pass-eye"></i>
          </button>
        </div>
      </div>

      <div id="login-error" class="login-error" style="display:none" role="alert"></div>

      <button type="submit" class="btn-login" id="btn-login">
        <span id="btn-login-label">Entrar</span>
        <div class="btn-spinner" id="btn-spinner" style="display:none"></div>
      </button>

      <button type="button" class="btn-reset-pass" id="btn-esqueci">
        Esqueci minha senha
      </button>
    </form>`;
}

function _formReset() {
  return `
    <form id="reset-form" novalidate>
      <p class="reset-desc">
        Informe seu e-mail e enviaremos um link para redefinir a senha.
      </p>
      <div class="login-field">
        <label for="r-email">E-mail</label>
        <div class="login-input-wrap">
          <i class="fi fi-rr-envelope login-input-icon"></i>
          <input
            id="r-email" type="email" name="email"
            placeholder="seu@email.com"
            autocomplete="email" autofocus required
          />
        </div>
      </div>

      <div id="reset-msg"   class="login-success" style="display:none" role="status"></div>
      <div id="reset-error" class="login-error"   style="display:none" role="alert"></div>

      <button type="submit" class="btn-login" id="btn-reset">
        <span id="btn-reset-label">Enviar link</span>
        <div class="btn-spinner" id="btn-reset-spinner" style="display:none"></div>
      </button>

      <button type="button" class="btn-reset-pass" id="btn-voltar">
        ← Voltar para o login
      </button>
    </form>`;
}

// ─── Bind login ───────────────────────────────────────────────────────────────
function _bindLogin() {
  const wrap = document.getElementById("login-form-wrap");

  // Toggle senha visível
  document.getElementById("btn-toggle-pass")?.addEventListener("click", () => {
    const inp  = document.getElementById("l-senha");
    const icon = document.getElementById("pass-eye");
    if (!inp) return;
    const show = inp.type === "password";
    inp.type   = show ? "text" : "password";
    if (icon) icon.className = `fi ${show ? "fi-rr-eye-crossed" : "fi-rr-eye"}`;
  });

  // Submit login
  document.getElementById("login-form")?.addEventListener("submit", async e => {
    e.preventDefault();
    const email = document.getElementById("l-email")?.value.trim();
    const senha = document.getElementById("l-senha")?.value;
    const errEl = document.getElementById("login-error");
    const btn   = document.getElementById("btn-login");
    const lbl   = document.getElementById("btn-login-label");
    const spn   = document.getElementById("btn-spinner");

    errEl.style.display = "none";
    btn.disabled = true;
    lbl.style.display = "none";
    spn.style.display = "block";

    try {
      await auth.signIn(email, senha);
      // onAuthStateChange vai disparar SIGNED_IN → app.js reinicializa o layout
    } catch (err) {
      errEl.textContent    = err.message;
      errEl.style.display  = "flex";
      btn.disabled         = false;
      lbl.style.display    = "block";
      spn.style.display    = "none";

      // Shake no card
      document.querySelector(".login-card")?.classList.add("shake");
      setTimeout(() => document.querySelector(".login-card")?.classList.remove("shake"), 600);
    }
  });

  // Ir para reset
  document.getElementById("btn-esqueci")?.addEventListener("click", () => {
    wrap.innerHTML = _formReset();
    _bindReset();
  });
}

// ─── Bind reset ───────────────────────────────────────────────────────────────
function _bindReset() {
  const wrap = document.getElementById("login-form-wrap");

  document.getElementById("btn-voltar")?.addEventListener("click", () => {
    wrap.innerHTML = _formLogin();
    _bindLogin();
  });

  document.getElementById("reset-form")?.addEventListener("submit", async e => {
    e.preventDefault();
    const email  = document.getElementById("r-email")?.value.trim();
    const msgEl  = document.getElementById("reset-msg");
    const errEl  = document.getElementById("reset-error");
    const btn    = document.getElementById("btn-reset");
    const lbl    = document.getElementById("btn-reset-label");
    const spn    = document.getElementById("btn-reset-spinner");

    msgEl.style.display = "none";
    errEl.style.display = "none";
    btn.disabled = true;
    lbl.style.display = "none";
    spn.style.display = "block";

    try {
      await auth.resetPassword(email);
      msgEl.textContent   = `✅ Link enviado para ${email}. Verifique sua caixa de entrada.`;
      msgEl.style.display = "block";
    } catch (err) {
      errEl.textContent   = err.message;
      errEl.style.display = "flex";
    } finally {
      btn.disabled       = false;
      lbl.style.display  = "block";
      spn.style.display  = "none";
    }
  });
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
function loginCSS() { return `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
  background: var(--bg, #0f0f1a);
  color: var(--text, #e8e8f0);
  min-height: 100dvh;
}

.login-bg {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background:
    radial-gradient(ellipse at 20% 50%, rgba(90,60,200,.18) 0%, transparent 60%),
    radial-gradient(ellipse at 80% 20%, rgba(0,196,154,.12) 0%, transparent 55%),
    var(--bg, #0f0f1a);
}

.login-card {
  width: 100%;
  max-width: 400px;
  background: var(--panel2, rgba(255,255,255,.04));
  border: 1px solid var(--border, rgba(255,255,255,.09));
  border-radius: 20px;
  padding: 40px 36px;
  box-shadow: 0 24px 64px rgba(0,0,0,.5);
  animation: fadeUp .4s ease;
}

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}

.login-card.shake {
  animation: shake .4s ease;
}
@keyframes shake {
  0%,100%{ transform:translateX(0) }
  20%{ transform:translateX(-8px) }
  40%{ transform:translateX(8px) }
  60%{ transform:translateX(-5px) }
  80%{ transform:translateX(5px) }
}

/* Header */
.login-header { text-align: center; margin-bottom: 32px; }
.login-logo {
  width: 60px; height: 60px;
  border-radius: 16px;
  background: linear-gradient(135deg, #5a3cc8, #00c49a);
  display: flex; align-items: center; justify-content: center;
  font-size: 26px; color: #fff;
  margin: 0 auto 14px;
  box-shadow: 0 8px 24px rgba(90,60,200,.4);
}
.login-title { font-size: 22px; font-weight: 800; margin-bottom: 4px; }
.login-sub   { font-size: 13px; color: var(--muted, #7a7a9a); }

/* Fields */
.login-field { margin-bottom: 16px; }
.login-field label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--muted, #7a7a9a);
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: .05em;
}
.login-input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}
.login-input-icon {
  position: absolute; left: 13px;
  font-size: 14px; color: var(--muted, #7a7a9a);
  pointer-events: none;
}
.login-input-wrap input {
  width: 100%;
  background: var(--panel, rgba(255,255,255,.06));
  border: 1px solid var(--border-md, rgba(255,255,255,.12));
  border-radius: 10px;
  padding: 11px 40px 11px 38px;
  font-size: 14px;
  font-family: inherit;
  color: var(--text, #e8e8f0);
  transition: border-color .2s, box-shadow .2s;
  outline: none;
}
.login-input-wrap input:focus {
  border-color: var(--primary, #5a3cc8);
  box-shadow: 0 0 0 3px rgba(90,60,200,.2);
}
.btn-toggle-pass {
  position: absolute; right: 10px;
  background: transparent; border: none; cursor: pointer;
  color: var(--muted, #7a7a9a); font-size: 15px;
  padding: 4px; border-radius: 6px;
  transition: color .2s;
}
.btn-toggle-pass:hover { color: var(--text, #e8e8f0); }

/* Error / success */
.login-error {
  display: flex; align-items: flex-start; gap: 8px;
  background: rgba(220,38,38,.1);
  border: 1px solid rgba(220,38,38,.3);
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 13px;
  color: #f87171;
  margin-bottom: 14px;
  line-height: 1.4;
}
.login-success {
  background: rgba(0,196,154,.08);
  border: 1px solid rgba(0,196,154,.25);
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 13px;
  color: #34d399;
  margin-bottom: 14px;
  line-height: 1.4;
}

/* Buttons */
.btn-login {
  width: 100%;
  background: linear-gradient(135deg, #5a3cc8, #7c5ce8);
  color: #fff;
  border: none;
  border-radius: 10px;
  padding: 12px;
  font-size: 15px;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: opacity .2s, transform .1s;
  margin-bottom: 12px;
  min-height: 46px;
}
.btn-login:hover:not(:disabled) { opacity: .9; transform: translateY(-1px); }
.btn-login:active:not(:disabled){ transform: translateY(0); }
.btn-login:disabled              { opacity: .6; cursor: not-allowed; }

.btn-spinner {
  width: 18px; height: 18px;
  border: 2px solid rgba(255,255,255,.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin .7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.btn-reset-pass {
  width: 100%;
  background: transparent;
  border: none;
  color: var(--muted, #7a7a9a);
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  padding: 6px;
  text-align: center;
  transition: color .2s;
  text-decoration: underline;
  text-underline-offset: 3px;
}
.btn-reset-pass:hover { color: var(--text, #e8e8f0); }

/* Reset desc */
.reset-desc {
  font-size: 13px;
  color: var(--muted, #7a7a9a);
  line-height: 1.5;
  margin-bottom: 18px;
  text-align: center;
}

/* Tema claro */
[data-theme="light"] .login-bg {
  background:
    radial-gradient(ellipse at 20% 50%, rgba(90,60,200,.08) 0%, transparent 60%),
    radial-gradient(ellipse at 80% 20%, rgba(0,196,154,.06) 0%, transparent 55%),
    #f4f4f8;
}
[data-theme="light"] .login-card {
  background: #fff;
  border-color: rgba(0,0,0,.1);
  box-shadow: 0 24px 64px rgba(0,0,0,.12);
}
[data-theme="light"] .login-input-wrap input {
  background: #f9f9fc;
  border-color: rgba(0,0,0,.15);
  color: #1a1a2e;
}
[data-theme="light"] .login-title { color: #1a1a2e; }
[data-theme="light"] .login-sub   { color: #666; }

@media (max-width: 440px) {
  .login-card { padding: 28px 20px; }
}
`; }
