// src/pages/Configuracoes/UploadLogo.tsx
import { useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Upload, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Lbl } from './utils';

interface UploadLogoProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
}

export function UploadLogo({ value, onChange, label = 'Logo da Empresa' }: UploadLogoProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      toast.error('Selecione um arquivo de imagem (PNG, JPG, SVG...).');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast.error('Imagem muito grande. Máximo 3MB.');
      return;
    }

    setEnviando(true);
    try {
      const ext = file.name.split('.').pop();
      const slug = label
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
        .replace(/[^a-z0-9]+/g, '-')                        // qualquer coisa que não seja letra/número vira "-"
        .replace(/^-+|-+$/g, '');                           // remove "-" sobrando nas pontas
      const nomeArquivo = `${slug}-${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from('logos')
        .upload(nomeArquivo, file, { upsert: true });
      if (upErr) throw upErr;

      const { data } = supabase.storage.from('logos').getPublicUrl(nomeArquivo);
      onChange(data.publicUrl);
      toast.success('Logo enviado!');
    } catch (e: any) {
      toast.error('Erro ao enviar logo: ' + e.message);
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div>
      <Lbl>{label}</Lbl>
      <div className="flex items-center gap-4">
        <div className="w-20 h-20 rounded-xl bg-[#111827] border border-gray-700 flex items-center justify-center overflow-hidden flex-shrink-0">
          {value ? (
            <img src={value} alt="Logo" className="w-full h-full object-contain" />
          ) : (
            <Upload className="w-6 h-6 text-gray-600" />
          )}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={enviando}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
            >
              {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {enviando ? 'Enviando...' : value ? 'Trocar logo' : 'Enviar logo'}
            </button>
            {value && (
              <button
                type="button"
                onClick={() => onChange('')}
                className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-1 transition-colors"
              >
                <X className="w-4 h-4" /> Remover
              </button>
            )}
          </div>
          <p className="text-[11px] text-gray-500">PNG, JPG ou SVG · máx. 3MB · fundo transparente recomendado</p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
      </div>
    </div>
  );
}
