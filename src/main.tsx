import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';

// Silencia um aviso específico e conhecido do Recharts (largura/altura -1
// de gráfico) que só acontece em desenvolvimento por causa do StrictMode
// do React 18 — ele monta cada componente duas vezes de propósito pra
// ajudar a achar bugs, e isso bagunça a primeira leitura de tamanho de um
// gráfico que acabou de montar. É cosmético (o gráfico sempre renderiza
// certinho logo em seguida) e nunca aparece no build de produção, onde o
// StrictMode nem existe. Qualquer outro warn/error passa normal.
if (import.meta.env.DEV) {
  const origWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    const primeiro = args[0];
    if (typeof primeiro === 'string' && primeiro.includes('width(-1) and height(-1) of chart should be greater than 0')) {
      return;
    }
    origWarn(...args);
  };
}

// Criamos o cliente de cache (Motor de Performance)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1, 
      refetchOnWindowFocus: false, 
      staleTime: 1000 * 60 * 5, 
    },
  },
});

// O "!" após getElementById diz ao TypeScript que o elemento 'root' existe
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error("Não foi possível encontrar o elemento 'root' no seu index.html. Verifique se a tag <div id='root'></div> existe.");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
); // <--- Aqui faltava fechar os parênteses