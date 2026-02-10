
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './supabaseClient';
import { Candidate, AssignmentConfig, AssignmentResult } from './types';
import { Users, ClipboardList, CheckCircle2, RefreshCw, XCircle, AlertCircle, Info, ChevronRight, Database } from 'lucide-react';

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
      // 1. 'candidates' 테이블에서 명단 읽기
      const { data: candData, error: candError } = await supabase
        .from('candidates')
        .select('*')
        .order('order_num', { ascending: true });

      if (candError) throw new Error(`Candidates Table Error: ${candError.message}`);
      
      if (!candData || candData.length === 0) {
        throw new Error("명단(candidates) 테이블이 비어있습니다. DB에 데이터를 추가해주세요.");
      }
      setCandidates(candData);

      // 2. 'assignment_state' 테이블에서 상태 읽기
      const { data: configData, error: configError } = await supabase
        .from('assignment_state')
        .select('*')
        .single();

      if (configError) throw new Error(`Assignment State Error: ${configError.message}`);
      setConfig(configData);

    } catch (err: any) {
      console.error("Fetch Error:", err);
      setError(err.message || "서버와의 통신 중 알 수 없는 오류가 발생했습니다.");
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
    setError(null);

    try {
      const startIndex = config.current_index;
      const assignedNames: string[] = [];
      const total = candidates.length;

      for (let i = 0; i < count; i++) {
        const idx = (startIndex + i) % total;
        assignedNames.push(candidates[idx].name);
      }

      const nextIndex = (startIndex + count) % total;

      const { error: updateError } = await supabase
        .from('assignment_state')
        .update({ current_index: nextIndex })
        .eq('id', config.id);

      if (updateError) throw updateError;

      setResult({
        assignedNames,
        startIndex,
        endIndex: nextIndex
      });
    } catch (err: any) {
      console.error("Assignment Error:", err);
      setError("배정 처리 중 오류가 발생했습니다. DB 권한 설정을 확인하세요.");
    } finally {
      setAssigning(false);
    }
  };

  const handleCancelInput = () => {
    setCount(1);
    setError(null);
    setResult(null);
  };

  const resetResultView = () => {
    setResult(null);
    setCount(1);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-10 h-10 text-blue-600 animate-spin" />
          <p className="text-slate-600 font-bold">Supabase에서 명단을 불러오는 중...</p>
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
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-800">
                기계부 퇴사자/부재자 특허결정서 담당자 배정
              </h1>
              <div className="flex items-center gap-2 mt-1.5">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                <p className="text-slate-400 font-semibold text-xs uppercase tracking-wider">Database Connected & Real-time Sync Active</p>
              </div>
            </div>
          </div>
          <button 
            onClick={fetchData}
            className="flex items-center gap-2 px-6 py-3 text-sm font-bold text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-all rounded-xl border border-slate-200"
          >
            <RefreshCw className="w-4 h-4" /> 명단 갱신
          </button>
        </header>

        {error && (
          <div className="bg-red-50 border-2 border-red-100 p-6 rounded-2xl flex items-start gap-4 text-red-800 shadow-sm animate-in fade-in slide-in-from-top-4">
            <div className="p-2 bg-red-100 rounded-lg">
              <Database className="w-6 h-6 shrink-0 text-red-600" />
            </div>
            <div>
              <p className="font-bold text-lg">데이터 연결 오류</p>
              <p className="opacity-90 font-medium">{error}</p>
              <p className="text-xs mt-2 text-red-500 font-bold uppercase tracking-tight">Check: Table Name 'candidates', URL & Key, RLS Policies</p>
            </div>
          </div>
        )}

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
                      <input 
                        type="number" 
                        min="1" 
                        max={candidates.length || 100}
                        value={count}
                        onChange={(e) => setCount(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full px-20 py-8 bg-slate-50 border-2 border-slate-100 rounded-3xl focus:border-blue-500 focus:ring-8 focus:ring-blue-50 outline-none transition-all text-5xl font-black text-slate-800 text-center"
                        autoFocus
                      />
                      <span className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-300 font-black text-2xl uppercase select-none pointer-events-none">명</span>
                    </div>
                    <div className="flex items-start gap-3 p-4 bg-blue-50/50 rounded-2xl text-blue-700/70">
                      <Info className="w-5 h-5 shrink-0" />
                      <p className="text-sm font-semibold leading-relaxed">
                        전체 명단 {candidates.length}명 중 현재 배정 대기 순서인 분부터 순환하여 배정됩니다.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4">
                    <button 
                      onClick={handleCancelInput}
                      className="flex-1 px-8 py-6 flex items-center justify-center gap-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black rounded-2xl transition-all"
                    >
                      <XCircle className="w-6 h-6" /> 취소
                    </button>
                    <button 
                      onClick={handleAssign}
                      disabled={assigning || count <= 0 || !!error}
                      className="flex-[2] px-8 py-6 flex items-center justify-center gap-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black text-xl rounded-2xl shadow-2xl shadow-blue-200 transition-all active:scale-95"
                    >
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
                  <div>
                    <h3 className="text-4xl font-black text-slate-800 tracking-tight">배정 완료</h3>
                    <p className="text-slate-500 font-bold mt-3 text-lg">성공적으로 담당자가 배정되었습니다.</p>
                  </div>
                  
                  <div className="w-full max-w-md bg-slate-50 rounded-[1.5rem] p-8 border border-slate-100 space-y-4">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest text-left mb-2">선발된 담당자 명단</p>
                    <div className="grid grid-cols-2 gap-3">
                      {result.assignedNames.map((name, i) => (
                        <div key={i} className="bg-white p-4 rounded-xl border border-slate-200 font-black text-slate-800 shadow-sm flex items-center gap-3">
                          <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded text-[10px] flex items-center justify-center font-black">{i+1}</span>
                          {name}
                        </div>
                      ))}
                    </div>
                  </div>

                  <button 
                    onClick={resetResultView}
                    className="px-12 py-5 bg-slate-900 text-white font-black rounded-2xl hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
                  >
                    새로운 배정 요청하기
                  </button>
                </div>
              )}
            </section>
          </main>

          <aside className="lg:col-span-5">
            <section className="bg-white rounded-[2rem] shadow-sm border border-slate-200 p-8 flex flex-col h-[650px]">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-8 bg-blue-600 rounded-full"></div>
                  <h2 className="text-xl font-black text-slate-800">배정 결과</h2>
                </div>
                <div className="px-4 py-1.5 bg-slate-100 text-slate-500 text-[10px] font-black rounded-full uppercase tracking-tighter">
                  Rotation Pool: {candidates.length}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-3 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                {candidates.map((cand, i) => {
                  const isNext = config?.current_index === i;
                  return (
                    <div 
                      key={cand.id} 
                      className={`group flex items-center justify-between p-5 rounded-2xl border-2 transition-all duration-300 ${
                        isNext 
                          ? 'bg-blue-50 border-blue-500 shadow-lg shadow-blue-50' 
                          : 'bg-white border-slate-50 hover:border-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-5">
                        <span className={`w-10 h-10 flex items-center justify-center rounded-xl text-sm font-black transition-colors ${
                          isNext ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'
                        }`}>
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <div>
                          <p className={`text-lg transition-colors ${isNext ? 'font-black text-slate-900' : 'font-bold text-slate-500'}`}>
                            {cand.name}
                          </p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">Machine Engineering</p>
                        </div>
                      </div>
                      {isNext && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg shadow-md animate-pulse">
                          <span className="text-[10px] font-black">NEXT TURN</span>
                        </div>
                      )}
                    </div>
                  );
                })}
                {candidates.length === 0 && !loading && !error && (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2 opacity-50">
                    <Database className="w-12 h-12" />
                    <p className="font-bold uppercase tracking-widest text-xs">No Data Found</p>
                  </div>
                )}
              </div>
              
              <div className="mt-8 p-5 bg-slate-900 rounded-2xl flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Current Pending</span>
                  <span className="text-xl font-black text-white">{candidates[config?.current_index ?? 0]?.name || '---'}</span>
                </div>
                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                  <ChevronRight className="w-6 h-6 text-white" />
                </div>
              </div>
            </section>
          </aside>

        </div>

        <footer className="text-center text-slate-400 text-[10px] font-black py-10 uppercase tracking-[0.3em] opacity-50">
          Mechanical Dept. Patent Assignment Engine v3.0 &bull; Developed with Precision
        </footer>
      </div>
    </div>
  );
};

export default App;
