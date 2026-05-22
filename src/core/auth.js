/**
 * AUTH.JS — Serviço de autenticação via Supabase Auth.
 *
 * Exporta:
 *   auth.getSession()          → sessão atual (ou null)
 *   auth.getUser()             → usuário atual (ou null)
 *   auth.signIn(email, pass)   → faz login
 *   auth.signOut()             → faz logout
 *   auth.resetPassword(email)  → envia e-mail de reset
 *   auth.onAuthChange(cb)      → escuta mudanças de sessão
 *   auth.isAuthenticated()     → boolean
 */

import { supabase }          from "../supabase/client.js";
import { EventBus }          from "./eventBus.js";

export const EVENTS_AUTH = {
  SIGNED_IN:  "auth:signed_in",
  SIGNED_OUT: "auth:signed_out",
};

class AuthService {
  #session = null;
  #user    = null;
  #ready   = false;
  #readyCbs = [];

  constructor() {
    // Escuta mudanças de sessão em tempo real (token refresh, logout em outra aba, etc.)
    supabase.auth.onAuthStateChange((event, session) => {
      this.#session = session;
      this.#user    = session?.user ?? null;

      if (!this.#ready) {
        this.#ready = true;
        this.#readyCbs.forEach(cb => cb(this.#user));
        this.#readyCbs = [];
      }

      if (event === "SIGNED_IN")  EventBus.emit(EVENTS_AUTH.SIGNED_IN,  { user: this.#user });
      if (event === "SIGNED_OUT") EventBus.emit(EVENTS_AUTH.SIGNED_OUT, {});
      if (event === "TOKEN_REFRESHED") this.#session = session;
    });
  }

  /**
   * Aguarda a inicialização do listener de auth (necessário no boot).
   * @returns {Promise<object|null>} usuário ou null
   */
  waitReady() {
    if (this.#ready) return Promise.resolve(this.#user);
    return new Promise(resolve => this.#readyCbs.push(resolve));
  }

  getSession()       { return this.#session; }
  getUser()          { return this.#user; }
  isAuthenticated()  { return !!this.#session; }

  /**
   * Login com e-mail e senha.
   * @param {string} email
   * @param {string} password
   * @returns {Promise<{user, session}>}
   */
  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(_friendlyError(error.message));
    return data;
  }

  /**
   * Logout.
   */
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
  }

  /**
   * Envia e-mail de redefinição de senha.
   * @param {string} email
   */
  async resetPassword(email) {
    const redirectTo = window.location.origin + window.location.pathname;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw new Error(_friendlyError(error.message));
  }

  /**
   * Escuta mudanças de sessão (wrapper do Supabase).
   * @param {Function} callback
   * @returns {{ data: { subscription } }}
   */
  onAuthChange(callback) {
    return supabase.auth.onAuthStateChange(callback);
  }
}

export const auth = new AuthService();

// ─── Tradução de erros comuns ─────────────────────────────────────────────────
function _friendlyError(msg) {
  if (!msg) return "Erro desconhecido.";
  if (msg.includes("Invalid login credentials"))   return "E-mail ou senha incorretos.";
  if (msg.includes("Email not confirmed"))          return "Confirme seu e-mail antes de entrar.";
  if (msg.includes("Too many requests"))            return "Muitas tentativas. Aguarde alguns minutos.";
  if (msg.includes("User not found"))               return "Usuário não encontrado.";
  if (msg.includes("Password should be at least"))  return "A senha deve ter pelo menos 6 caracteres.";
  return msg;
}
