
import { createClient } from '@supabase/supabase-js';

/**
 * 프로젝트 가이드라인에 따라 환경 변수는 process.env에서 직접 가져옵니다.
 * VITE_SUPABASE_URL 및 VITE_SUPABASE_ANON_KEY는 환경 설정에서 주입된 것으로 간주합니다.
 */
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

// 환경 변수 부재 시 콘솔 경고 (애플리케이션 구동 중 에러 추적용)
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Supabase configuration keys are missing in process.env!\n" +
    "Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are provided in the environment secrets."
  );
}

// createClient 호출 시 URL이 비어있으면 라이브러리 내부에서 에러가 발생하므로 
// 실제 값이 있을 때만 정상 작동하며, 없을 경우 App.tsx의 에러 핸들링에서 잡힙니다.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder-key'
);
