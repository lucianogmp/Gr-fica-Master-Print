// As variáveis VITE_* são injetadas pelo Vite durante o build.
// Localmente: crie um arquivo .env na raiz com esses valores.
// No GitHub: configure em Settings > Secrets and variables > Actions.

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
