
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './supabaseClient';
import { Candidate, AssignmentConfig, AssignmentResult } from './types';
import { Users, ClipboardList, CheckCircle2, RefreshCw, XCircle, AlertCircle, Info, ChevronRight, Database, Settings, ArrowUpCircle, ExternalLink } from 'lucide-react';

const App: React.FC = () => {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [config, setConfig] = useState<AssignmentConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [count, setCount] = useState<number>(1);
  const [result, setResult] = useState<AssignmentResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const subscriptionRef = useRef<any>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // 데이터 로드 시도
      const { data: candData, error: candError } = await supabase
        .from('candidates')
        .select('*')
        .order('created_index', { ascending: true });

      if (candError) {
        // Failed to fetch 에러는 대개 URL이 placeholder이거나 네트워크 차단 시 발생
        if (candError.message.includes('fetch') || candError.message.includes('failed')) {
          throw new Error("환경 변수가 아직 애플리케이션에 적용되지 않았습니다.");
        }
        throw candError;
      }
      
      setCandidates(candData || []);

      const { data: configData, error: configError } = await supabase
        .from('assignment_state')
        .select('*')
        .single();

      if (configError) throw new Error(`상태 테이블 로드 실패: ${configError.message}`);
      setConfig(configData);

    } catch (err: any) {
      console.error("Fetch Error:", err);
      setError(err.message || "알 수 없는 에러가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    subscriptionRef.current = supabase
      .channel('public:assignment_state')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'assignment_state' }, payload => {
        setConfig(payload.new as AssignmentConfig);
      })
      .subscribe();

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
      }
    };
  }, [fetchData]);

  const handleAssign = async () => {
    if (!config || candidates.length === 0 || count <= 0) return;
    setAssigning(true);
    try {
      const startIndex = config.current_index;
      const assignedNames: string[] = [];
      const total = candidates.length;
      for (let i = 0; i < count; i++) {
        assignedNames.push(candidates[(startIndex + i) % total].names);
      }
      const nextIndex = (startIndex + count) % total;
      const { error: updateError } = await supabase.from('assignment_state').update({ current_index: nextIndex }).eq('id', config.id);
      if (updateError) throw updateError;
      setResult({ assignedNames, startIndex, endIndex: nextIndex });
    } catch (err: any) {
      setError("배정 처리 중 오류: " + err.message);
    } finally {
      setAssigning(false);
    }
  };

  // Added resetResultView function to fix "Cannot find name 'resetResultView'" error
  const resetResultView = () => {
    setResult(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4 text-center">
          <RefreshCw className="w-12 h-12 text-blue-600 animate-spin" />
          <p className="text-slate-600 font-bold">Supabase 연결 및 데이터 로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] py-10 px-4 sm:px-6 lg:px-8 font-sans antialiased text-slate-900">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <header className="bg-white rounded-[2rem] shadow-sm border border-slate-200 p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className="p-4 bg-blue-600 rounded-2xl shadow-lg shadow-blue-100">
              <ClipboardList className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-800">기계부 담당자 배정 시스템</h1>
              <div className="flex items-center gap-2 mt-1.5">
                <div className={`h-2 w-2 rounded-full ${error ? 'bg-red-500' : 'bg-green-500 animate-pulse'}`}></div>
                <p className="text-slate-400 font-semibold text-xs uppercase tracking-wider">{error ? 'Sync Error' : 'Database Live'}</p>
              </div>
            </div>
          </div>
          <button onClick={fetchData} className="px-6 py-3 text-sm font-bold text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-all rounded-xl border border-slate-200 flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> 재연결 시도
          </button>
        </header>

        {error && (
          <div className="bg-white border-2 border-red-100 rounded-[2.5rem] overflow-hidden shadow-2xl shadow-red-50 animate-in fade-in slide-in-from-top-4">
            <div className="bg-red-600 p-6 flex items-center gap-4 text-white">
              <AlertCircle className="w-8 h-8 shrink-0" />
              <div>
                <h2 className="text-xl font-black">연결 설정이 완료되지 않았습니다</h2>
                <p className="text-red-100 text-sm font-bold opacity-90">Vercel 환경 변수 추가 후 추가 작업이 필요합니다.</p>
              </div>
            </div>
            
            <div className="p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-red-600 font-black text-sm uppercase tracking-widest">
                    <ArrowUpCircle className="w-5 h-5" /> STEP 1: 재배포 실행
                  </div>
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                    <p className="text-slate-600 text-sm leading-relaxed mb-4 font-medium">
                      환경 변수를 설정한 후에는 <strong>반드시 새로운 배포(Redeploy)</strong>를 생성해야 코드가 해당 값을 인식할 수 있습니다.
                    </p>
                    <a href="https://vercel.com" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-blue-600 font-bold text-sm hover:underline">
                      Vercel 대시보드로 이동 <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-slate-700 font-black text-sm uppercase tracking-widest">
                    <Settings className="w-5 h-5" /> STEP 2: 변수 이름 확인
                  </div>
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 font-mono text-xs space-y-2">
                    <div className="flex justify-between border-b border-slate-200 pb-2">
                      <span className="text-slate-400">Variable Name</span>
                      <span className="text-slate-800 font-bold">Value Status</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-600">VITE_SUPABASE_URL</span>
                      <span className="text-slate-500 italic">Check Dashboard</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-600">VITE_SUPABASE_ANON_KEY</span>
                      <span className="text-slate-500 italic">Check Dashboard</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-red-50 rounded-xl text-center">
                <p className="text-red-700 text-xs font-black">Error Log: {error}</p>
              </div>
            </div>
          </div>
        )}

        {!error && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <main className="lg:col-span-7">
              <section className="bg-white rounded-[2rem] shadow-xl border border-slate-100 p-10 h-full flex flex-col">
                <div className="flex items-center gap-4 mb-10">
                  <div className="p-2.5 bg-indigo-50 rounded-xl">
                    <Users className="w-6 h-6 text-indigo-600" />
                  </div>
                  <h2 className="text-2xl font-extrabold text-slate-800">배정 요청</h2>
                </div>

                {!result ? (
                  <div className="flex-1 flex flex-col justify-center space-y-10">
                    <div className="space-y-6">
                      <label className="block text-sm font-black text-slate-400 uppercase tracking-[0.15em] text-center">배정할 인원수를 입력하세요</label>
                      <div className="relative">
                        <input type="number" min="1" value={count} onChange={(e) => setCount(Math.max(0, parseInt(e.target.value) || 0))} className="w-full px-20 py-8 bg-slate-50 border-2 border-slate-100 rounded-3xl focus:border-blue-500 focus:ring-8 focus:ring-blue-50 outline-none transition-all text-5xl font-black text-slate-800 text-center" autoFocus />
                        <span className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-300 font-black text-2xl uppercase">명</span>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4">
                      <button onClick={() => setCount(1)} className="flex-1 px-8 py-6 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black rounded-2xl transition-all">초기화</button>
                      <button onClick={handleAssign} disabled={assigning || count <= 0} className="flex-[2] px-8 py-6 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white font-black text-xl rounded-2xl shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-4">
                        {assigning ? <RefreshCw className="w-7 h-7 animate-spin" /> : <CheckCircle2 className="w-7 h-7" />}
                        배정 실행
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8 animate-in zoom-in-95 duration-500">
                    <div className="w-24 h-24 bg-green-500 text-white rounded-[2rem] flex items-center justify-center shadow-2xl shadow-green-200">
                      <CheckCircle2 className="w-14 h-14" />
                    </div>
                    <h3 className="text-4xl font-black text-slate-800">배정 완료</h3>
                    <div className="w-full max-w-md bg-slate-50 rounded-[1.5rem] p-8 border border-slate-100 space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        {result.assignedNames.map((name, i) => (
                          <div key={i} className="bg-white p-4 rounded-xl border border-slate-200 font-black text-slate-800 shadow-sm flex items-center gap-3">
                            <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded text-[10px] flex items-center justify-center font-black">{i+1}</span>
                            {name}
                          </div>
                        ))}
                      </div>
                    </div>
                    <button onClick={resetResultView} className="px-12 py-5 bg-slate-900 text-white font-black rounded-2xl hover:bg-slate-800 transition-all">확인</button>
                  </div>
                )}
              </section>
            </main>

            <aside className="lg:col-span-5">
              <section className="bg-white rounded-[2rem] shadow-sm border border-slate-200 p-8 flex flex-col h-[650px]">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-8 bg-blue-600 rounded-full"></div>
                    <h2 className="text-xl font-black text-slate-800">현재 명단</h2>
                  </div>
                  <div className="px-4 py-1.5 bg-slate-100 text-slate-500 text-[10px] font-black rounded-full uppercase tracking-tighter">Pool: {candidates.length}</div>
                </div>
                <div className="flex-1 overflow-y-auto space-y-3 pr-3 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                  {candidates.map((cand, i) => {
                    const isNext = config?.current_index === i;
                    return (
                      <div key={cand.id} className={`flex items-center justify-between p-5 rounded-2xl border-2 transition-all duration-300 ${isNext ? 'bg-blue-50 border-blue-500 shadow-lg shadow-blue-50' : 'bg-white border-slate-50'}`}>
                        <div className="flex items-center gap-5">
                          <span className={`w-10 h-10 flex items-center justify-center rounded-xl text-sm font-black ${isNext ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                            {String(i + 1).padStart(2, '0')}
                          </span>
                          <p className={`text-lg ${isNext ? 'font-black text-slate-900' : 'font-bold text-slate-500'}`}>{cand.names}</p>
                        </div>
                        {isNext && <div className="px-3 py-1 bg-blue-600 text-white rounded-lg text-[10px] font-black animate-pulse">NEXT</div>}
                      </div>
                    );
                  })}
                </div>
              </section>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
