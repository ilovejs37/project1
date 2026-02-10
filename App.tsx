
import React, { useState, useEffect, useRef } from 'react';
import { 
  UserCheck, Users, ChevronRight, AlertCircle, RotateCcw, 
  FileUp, Database, Cloud, RefreshCw, List, 
  CheckCircle2, ArrowRightLeft, LayoutDashboard
} from 'lucide-react';
import { createClient, RealtimeChannel } from '@supabase/supabase-js';
import { Candidate } from './types';

// Global XLSX for Excel parsing
declare const XLSX: any;

/**
 * 환경 변수 안전하게 가져오기 (Vite 및 Vercel 대응)
 */
const getEnv = (key: string): string => {
  // @ts-ignore
  const envs = {
    // @ts-ignore
    VITE_SUPABASE_URL: import.meta.env?.VITE_SUPABASE_URL || process.env?.VITE_SUPABASE_URL,
    // @ts-ignore
    VITE_SUPABASE_ANON_KEY: import.meta.env?.VITE_SUPABASE_ANON_KEY || process.env?.VITE_SUPABASE_ANON_KEY,
  };
  return envs[key as keyof typeof envs] || '';
};

const SUPABASE_URL = getEnv('VITE_SUPABASE_URL');
const SUPABASE_ANON_KEY = getEnv('VITE_SUPABASE_ANON_KEY');

const createSafeSupabaseClient = () => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  try {
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch (e) {
    console.error("Supabase 초기화 실패:", e);
    return null;
  }
};

const supabase = createSafeSupabaseClient();
const LOCAL_BACKUP_KEY = 'assignee_selector_cloud_cache';

const App: React.FC = () => {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [selectionCount, setSelectionCount] = useState<number>(1);
  const [selectedResults, setSelectedResults] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showRoster, setShowRoster] = useState(false);
  const [isRealtime, setIsRealtime] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isConfigured = !!supabase;

  // 데이터 초기 로드 및 실시간 구독 설정
  useEffect(() => {
    if (!isConfigured || !supabase) {
      setLoading(false);
      setError("Supabase 환경 변수(URL/KEY)가 설정되지 않았습니다. Vercel 설정을 확인하세요.");
      return;
    }

    // 1. 초기 데이터 로드
    fetchData();

    // 2. 실시간 구독 설정 (순번 변경 감지)
    const channel: RealtimeChannel = supabase
      .channel('public:app_state')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'app_state', filter: 'id=eq.default' },
        (payload) => {
          console.log('Realtime Update Received:', payload);
          setCurrentIndex(payload.new.current_index);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'candidates' },
        () => {
          // 명단 자체가 바뀌면 전체 다시 불러오기
          fetchData(true);
        }
      )
      .subscribe((status) => {
        setIsRealtime(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isConfigured]);

  const fetchData = async (isManual = false) => {
    if (!supabase) return;
    if (isManual) setSyncing(true);
    else setLoading(true);

    try {
      const [candidatesRes, stateRes] = await Promise.all([
        supabase.from('candidates').select('*').order('id', { ascending: true }),
        supabase.from('app_state').select('current_index').eq('id', 'default').single()
      ]);

      if (candidatesRes.error) throw candidatesRes.error;

      let remoteIndex = 0;
      if (stateRes.error) {
        if (stateRes.error.code === 'PGRST116') {
          await supabase.from('app_state').insert([{ id: 'default', current_index: 0 }]);
        } else throw stateRes.error;
      } else {
        remoteIndex = stateRes.data.current_index;
      }

      setCandidates(candidatesRes.data || []);
      setCurrentIndex(remoteIndex);

      localStorage.setItem(LOCAL_BACKUP_KEY, JSON.stringify({ 
        candidates: candidatesRes.data, 
        currentIndex: remoteIndex 
      }));
      setError(null);
    } catch (err: any) {
      setError(`데이터 동기화 실패: ${err.message}`);
      loadCache();
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  const loadCache = () => {
    const cached = localStorage.getItem(LOCAL_BACKUP_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      setCandidates(parsed.candidates || []);
      setCurrentIndex(parsed.currentIndex || 0);
    }
  };

  const syncIndexToServer = async (newIndex: number) => {
    if (!supabase) return;
    setSyncing(true);
    try {
      const { error: updateError } = await supabase
        .from('app_state')
        .update({ current_index: newIndex })
        .eq('id', 'default');
      if (updateError) throw updateError;
    } catch (err: any) {
      setError(`DB 업데이트 실패: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleSelect = async () => {
    if (candidates.length === 0) return;

    const results: string[] = [];
    let nextIdx = currentIndex;

    for (let i = 0; i < selectionCount; i++) {
      results.push(candidates[nextIdx].name);
      nextIdx = (nextIdx + 1) % candidates.length;
    }

    setHistoryIndex(currentIndex);
    setSelectedResults(results);
    setCurrentIndex(nextIdx); // 로컬 UI 우선 업데이트
    
    await syncIndexToServer(nextIdx);
  };

  const handleUndo = async () => {
    if (historyIndex !== null) {
      const prev = historyIndex;
      setCurrentIndex(prev);
      setSelectedResults([]);
      setHistoryIndex(null);
      await syncIndexToServer(prev);
    }
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !supabase) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const names = (XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][])
          .flat()
          .filter(v => typeof v === 'string' && v.trim())
          .map((v, i) => ({ id: i, name: v.trim() }));

        if (names.length === 0) throw new Error("유효한 데이터가 없습니다.");

        await supabase.from('candidates').delete().neq('id', -1);
        const { error: insErr } = await supabase.from('candidates').insert(names);
        if (insErr) throw insErr;
        
        await syncIndexToServer(0);
        await fetchData(true);
        alert(`${names.length}명이 새로 등록되었습니다.`);
      } catch (err: any) {
        setError(`DB 업로드 실패: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="w-14 h-14 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 font-bold">서버 연결 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 antialiased">
      <div className="max-w-7xl mx-auto px-4 py-12 lg:py-20 space-y-10">
        
        <header className="flex flex-col md:flex-row items-center justify-between gap-6 bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-2xl shadow-lg text-white transition-colors duration-500 ${isRealtime ? 'bg-indigo-600 shadow-indigo-200' : 'bg-slate-400'}`}>
              <Cloud className={`w-6 h-6 ${isRealtime && syncing ? 'animate-bounce' : ''}`} />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-800 tracking-tight">기계부 담당자 배정 시스템</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <div className={`w-2 h-2 rounded-full ${isRealtime ? 'bg-emerald-500 animate-ping' : 'bg-red-500'}`}></div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  {isRealtime ? 'Realtime Connected' : 'Connection Lost'}
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button onClick={() => fetchData(true)} className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-xl transition-all">
              <RefreshCw className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`} />
            </button>
            <button 
              onClick={() => setShowRoster(!showRoster)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all border ${showRoster ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600'}`}
            >
              <List className="w-4 h-4" /> 명단 확인
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-all shadow-md">
              <FileUp className="w-4 h-4" /> DB 갱신
            </button>
            <input type="file" ref={fileInputRef} onChange={handleExcelUpload} accept=".xlsx, .xls" className="hidden" />
          </div>
        </header>

        {error && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <p className="text-sm font-bold text-red-700">{error}</p>
            <button onClick={() => fetchData(true)} className="ml-auto text-red-400 hover:text-red-600 font-bold text-xs underline">새로고침</button>
          </div>
        )}

        {showRoster && (
          <section className="bg-white border border-slate-200 rounded-3xl p-8 shadow-xl animate-in zoom-in-95">
            <h3 className="font-black text-slate-800 flex items-center gap-2 mb-6">
              <Users className="w-5 h-5 text-indigo-600" /> 서버 명단 ({candidates.length}명)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {candidates.map((c, i) => (
                <div key={c.id} className={`p-3 rounded-xl border text-sm font-bold flex items-center justify-between transition-all ${i === currentIndex ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg scale-105' : 'bg-slate-50 border-slate-100 text-slate-600'}`}>
                  <span className="truncate">{c.name}</span>
                  {i === currentIndex && <ArrowRightLeft className="w-3 h-3 animate-pulse" />}
                </div>
              ))}
            </div>
          </section>
        )}

        <main className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden">
              <div className="p-10 space-y-10">
                <div className="text-center space-y-2">
                  <span className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">Assignment Queue</span>
                  <h2 className="text-3xl font-black text-slate-800">배정 실행</h2>
                </div>
                <div className="flex flex-col items-center gap-6">
                  <div className="w-full text-center">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 block">배정 건수</label>
                    <input 
                      type="number" min="1" max="50" value={selectionCount}
                      onChange={(e) => setSelectionCount(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-40 px-4 py-6 text-6xl font-black text-center text-slate-800 bg-slate-50 rounded-3xl border-2 border-transparent focus:border-indigo-500 outline-none transition-all"
                    />
                  </div>
                  <button
                    onClick={handleSelect}
                    disabled={candidates.length === 0 || syncing}
                    className="w-full py-6 bg-indigo-600 text-white rounded-3xl font-black text-xl flex items-center justify-center gap-3 hover:bg-indigo-700 hover:-translate-y-1 active:scale-[0.98] transition-all shadow-xl shadow-indigo-100 disabled:bg-slate-200"
                  >
                    <UserCheck className="w-6 h-6" /> {syncing ? '처리 중...' : '담당자 배정'} <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="bg-slate-50/80 border-t border-slate-100 p-8 flex items-center justify-between">
                <button onClick={handleUndo} disabled={historyIndex === null || syncing} className="flex items-center gap-2 px-4 py-2.5 text-slate-500 hover:text-indigo-600 font-bold text-sm transition-all disabled:opacity-30">
                  <RotateCcw className="w-4 h-4" /> 배정 취소
                </button>
                <div className="text-right">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Next Assignee</p>
                  <p className="text-lg font-black text-indigo-600">{candidates[currentIndex]?.name || 'N/A'}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-slate-900 rounded-[2rem] p-8 text-white flex items-center justify-between shadow-xl">
              <div>
                <p className="text-xs font-bold opacity-60 uppercase tracking-widest">Database Info</p>
                <p className="text-3xl font-black">Online <span className="text-lg opacity-40">| {candidates.length} Experts</span></p>
              </div>
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isRealtime ? 'bg-emerald-500' : 'bg-amber-500'}`}>
                <Database className="w-7 h-7" />
              </div>
            </div>
          </div>

          <div className="lg:col-span-3 h-full">
            <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-200 h-full flex flex-col min-h-[520px]">
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
                <h2 className="font-black text-slate-800 flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" /> 배정 결과 내역
                </h2>
              </div>
              <div className="p-10 flex-grow">
                {selectedResults.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {selectedResults.map((name, idx) => (
                      <div key={`${name}-${idx}`} className="animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${idx * 80}ms` }}>
                        <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex items-center gap-5 hover:bg-white hover:shadow-lg transition-all group">
                          <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center font-black text-slate-400 group-hover:text-indigo-600 shadow-sm border border-slate-100 transition-colors">
                            {idx + 1}
                          </div>
                          <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-0.5">Assigned Expert</p>
                            <span className="text-xl font-black text-slate-800">{name}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex-grow flex flex-col items-center justify-center text-center space-y-6 py-12">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center border-2 border-dashed border-slate-200">
                      <Users className="w-10 h-10 text-slate-300" />
                    </div>
                    <p className="text-sm text-slate-400 font-medium max-w-[260px]">왼쪽에서 배정 건수를 입력하고 버튼을 누르면 담당자가 실시간으로 선정됩니다.</p>
                  </div>
                )}
              </div>
              <div className="p-8 border-t border-slate-50 flex items-center justify-between text-[11px] font-black text-slate-400 uppercase tracking-widest">
                <span>Vercel Deploy Stable</span>
                <span>Last Sync: {new Date().toLocaleTimeString()}</span>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
