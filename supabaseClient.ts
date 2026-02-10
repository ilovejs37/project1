
import { createClient } from '@supabase/supabase-js';

/**
 * 환경 변수 안전하게 가져오기
 * process.env (Node/샌드박스 환경)와 import.meta.env (Vite/모던 프론트엔드 환경)를 모두 체크합니다.
 */
const getEnv = (key: string): string => {
  const envValue = (typeof process !== 'undefined' && process.env ? process.env[key] : undefined) || 
                   (import.meta && (import.meta as any).env ? (import.meta as any).env[key] : undefined);
  return envValue || '';
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY');

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase configuration missing. Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.");
}

export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder');
