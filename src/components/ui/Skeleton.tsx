interface SkeletonProps {
  className?: string;
}

/** Bloco base com efeito shimmer. Use className pra dimensionar. */
export function Skeleton({ className = '' }: SkeletonProps) {
  return <div className={`skeleton rounded-md ${className}`} />;
}

/** Esqueleto de tabela: cabeçalho + N linhas com M colunas. */
export function TableSkeleton({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden">
      <div className="p-4 border-b border-gray-700">
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="px-5 py-3 border-b border-gray-700 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      <div className="divide-y divide-gray-800">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="px-5 py-3.5 flex gap-4 items-center">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton
                key={c}
                className={`h-4 ${c === 0 ? 'flex-[1.5]' : 'flex-1'}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Esqueleto de card genérico. */
export function CardSkeleton({ className = '' }: SkeletonProps) {
  return (
    <div className={`bg-[#1a2332] border border-gray-700/60 rounded-xl p-4 space-y-3 ${className}`}>
      <Skeleton className="h-3 w-1/3" />
      <Skeleton className="h-7 w-2/3" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

/** Grid de KPIs em carregamento. */
export function KpiGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}
