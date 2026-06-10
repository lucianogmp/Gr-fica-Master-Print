// src/components/EstoqueAlertBanner.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, X, ChevronDown, ChevronUp, Wifi, WifiOff } from 'lucide-react';
import { useEstoqueRealtime } from '../hooks/useEstoqueRealtime';

export function EstoqueAlertBanner() {
  const { alertas, conectado, totalAlertas } = useEstoqueRealtime();
  const [expandido, setExpandido] = useState(false);
  const [fechado, setFechado]     = useState(false);
  const navigate                  = useNavigate();

  // Sem alertas ou fechado pelo usuário — não renderiza nada
  if (totalAlertas === 0 || fechado) return null;

  const zerados = alertas.filter(a => a.saldo <= 0);
  const baixos  = alertas.filter(a => a.saldo > 0);

  return (
    <div className="bg-yellow-500/10 border-b border-yellow-500/30 px-4 py-2">
      <div className="max-w-7xl mx-auto">

        {/* Linha principal */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
            <span className="text-yellow-300 text-xs font-bold">
              {zerados.length > 0
                ? `${zerados.length} item(s) zerado(s) · `
                : ''}
              {baixos.length} item(s) abaixo do mínimo
            </span>

            {/* Indicador de conexão realtime */}
            <span
              title={conectado ? 'Monitoramento ativo' : 'Reconectando...'}
              className="flex-shrink-0"
            >
              {conectado
                ? <Wifi className="w-3 h-3 text-green-400" />
                : <WifiOff className="w-3 h-3 text-gray-500 animate-pulse" />
              }
            </span>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => navigate('/estoque')}
              className="text-xs font-bold text-yellow-400 hover:text-yellow-300 underline transition-colors"
            >
              Ver estoque
            </button>

            <button
              onClick={() => setExpandido(e => !e)}
              className="text-yellow-500 hover:text-yellow-300 transition-colors"
              aria-label={expandido ? 'Recolher' : 'Expandir'}
            >
              {expandido
                ? <ChevronUp className="w-4 h-4" />
                : <ChevronDown className="w-4 h-4" />
              }
            </button>

            <button
              onClick={() => setFechado(true)}
              className="text-yellow-600 hover:text-yellow-400 transition-colors"
              aria-label="Fechar aviso"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Lista expandida */}
        {expandido && (
          <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-1.5 pb-1">
            {alertas.map(a => (
              <div
                key={a.id}
                className={`flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg border ${
                  a.saldo <= 0
                    ? 'bg-red-500/15 border-red-500/30 text-red-300'
                    : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-300'
                }`}
              >
                <span className="truncate font-medium">{a.nome}</span>
                <span className="font-black ml-2 flex-shrink-0">
                  {a.saldo <= 0 ? 'ZERO' : `${a.saldo} ${a.unidade}`}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
