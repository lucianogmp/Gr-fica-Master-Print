import React from 'react';

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: React.ComponentType<any> | string;
  color?: string;
  compact?: boolean;
}

export function KpiCard({ label, value, icon: Icon, color = 'text-blue-400', compact = false }: KpiCardProps) {
  if (compact) {
    return (
      <div className="bg-[#1f2937] border border-gray-700 rounded-lg px-3.5 py-2 flex items-center gap-3">
        <div className="flex items-center justify-center flex-shrink-0">
          {typeof Icon === 'string' ? Icon : <Icon className={`w-4 h-4 ${color}`} />}
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider truncate">{label}</p>
          <p className={`text-base font-black leading-tight ${color}`}>{value}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-4 flex items-center gap-4">
      <div className="text-2xl flex items-center justify-center">
        {typeof Icon === 'string' ? Icon : <Icon className={`w-6 h-6 ${color}`} />}
      </div>
      <div>
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{label}</p>
        <p className={`text-xl font-black ${color}`}>{value}</p>
      </div>
    </div>
  );
}
