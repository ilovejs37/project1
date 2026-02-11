
import { createClient } from '@supabase/supabase-js';

// 사용자 제공 정보 직접 적용
const SUPABASE_URL = 'https://axtqnlzwienmmhbizfxz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Y7QgDQbbiedMFOQk8214AQ_oILTBC2R';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
