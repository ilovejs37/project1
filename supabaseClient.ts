
import { createClient } from '@supabase/supabase-js';

/**
 * 환경 변수 안전하게 가져오기
 * 사용자 요청에 따라 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY를 우선적으로 확인합니다.
 */
const getEnv = (key: string): string => {
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key] as string;
  }
  if (typeof window !== 'undefined' && (window as any).importMetaEnv && (window as any).importMetaEnv[key]) {
    return (window as any).importMetaEnv[key];
  }
  if (import.meta && (import.meta as any).env && (import.meta as any).env[key]) {
    return (import.meta as any).env[key];
  }
  return '';
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY');

// 환경 변수 누락 시 콘솔에 경고창을 띄워 개발자가 인지하기 쉽게 합니다.
if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "Supabase configuration missing!\n" +
    "Please check your environment variables:\n" +
    "- VITE_SUPABASE_URL\n" +
    "- VITE_SUPABASE_ANON_KEY"
  );
}

// 실제 URL이 없을 경우 라이브러리 에러 방지를 위한 placeholder 주소 사용
export const supabase = createClient(
  supabaseUrl || 'https://your-project-id.supabase.co', 
  supabaseAnonKey || 'your-anon-key'
);
