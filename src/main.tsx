import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';

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