
import { createClient } from '@supabase/supabase-js';

/**
 * 전역 환경에서 변수를 찾는 함수
 */
const getEnvVar = (key: string): string => {
  try {
    // 1. process.env (Vercel/Node 표준)
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key] as string;
    }
    // 2. import.meta.env (Vite/ESM 표준)
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      // @ts-ignore
      return import.meta.env[key];
    }
    // 3. window 전역 객체 (일부 환경 주입)
    if (typeof window !== 'undefined' && (window as any)[key]) {
      return (window as any)[key];
    }
  } catch (e) {
    // 에러 무시
  }
  return '';
};

const SUPABASE_URL = getEnvVar('VITE_SUPABASE_URL');
const SUPABASE_ANON_KEY = getEnvVar('VITE_SUPABASE_ANON_KEY');

// 초기화 시 URL 검증
const isValidUrl = SUPABASE_URL && SUPABASE_URL.startsWith('https://');

if (!isValidUrl) {
  console.error(
    "Critical: Supabase URL missing or invalid.\n" +
    "Found VITE_SUPABASE_URL: " + (SUPABASE_URL ? "Exists but invalid format" : "Empty")
  );
}

// 에러 발생 시 placeholder가 아닌 실제 환경 변수 상태를 반영하도록 함
export const supabase = createClient(
  isValidUrl ? SUPABASE_URL : 'https://missing-config.supabase.co',
  SUPABASE_ANON_KEY || 'missing-key'
);
