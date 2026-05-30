import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppRoutes } from './routes';
import { Toaster } from 'react-hot-toast'; // Para os Toasts que estavam no seu app.js
import "./index.css";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* Sistema de rotas */}
      <AppRoutes />
      
      {/* Toasts (notificações) globais */}
      <Toaster position="top-right" />
    </QueryClientProvider>
  );
}