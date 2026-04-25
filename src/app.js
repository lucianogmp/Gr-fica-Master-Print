import { supabase } from "./supabase/client.js";
import { appState } from "./ui/state.js";
import { renderLayout } from "./ui/layout.js";
import { pages } from "./pages/index.js";

export function initApp() {
  renderLayout(pages);

  // Auth listener (modo logado)
  supabase.auth.getSession().then(({ data }) => {
    appState.session = data.session;
    appState.user = data.session?.user ?? null;
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    appState.session = session;
    appState.user = session?.user ?? null;
    // Aqui a gente pode redirecionar pro login mais tarde se quiser
  });
}
