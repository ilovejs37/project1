
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';
import { Candidate, AssignmentConfig, AssignmentResult } from './types';
import { 
  ClipboardList, 
  RefreshCw, 
  AlertCircle, 
  UserPlus, 
  Undo2,
  LayoutDashboard,
  ChevronRight
} from 'lucide-react';

const App: React.FC = () => {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [config, setConfig] = useState<AssignmentConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [countInput, setCountInput] = useState<string>("");
  const [result, setResult] = useState<AssignmentResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: candData, error: candError } = await supabase
        .from('candidates')
        .select('*')
        .order('order_num', { ascending: true });

      if (candError) throw candError;
      setCandidates(candData || []);

      const { data: configData, error: configError } = await supabase
        .from('assignment_state')
        .select('*')
        .single();

      if (configError) throw configError;
      setConfig(configData);

    } catch (err: any) {
      console.error("Database Connection Error:", err);
      setError("데이터베이스 연결 실패. assignment_state 테이블 설정을 확인하세요.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'assignment_state',
        },
        (payload) => {
          setConfig(payload.new as AssignmentConfig);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  const handleAssign = async () => {
    const count = parseInt(countInput);
    if (!config || candidates.length === 0 || isNaN(count) || count <= 0) return;
    
    setAssigning(true);
    setError(null);

    try {
      const total = candidates.length;
      const previousIndex = config.current_index;
      const startIndex = previousIndex % total;
      const assignedNames: string[] = [];

      for (let i = 0; i < count; i++) {
        const idx = (startIndex + i) % total;
        assignedNames.push(candidates[idx].names);
      }

      const nextIndex = (startIndex + count) % total;

      const { error: updateError } = await supabase
        .from('assignment_state')
        .update({ current_index: nextIndex })
        .eq('id', config.id);

      if (updateError) throw updateError;

      setConfig(prev => prev ? { ...prev, current_index: nextIndex } : null);

      setResult({
        assignedNames,
        startIndex,
        endIndex: nextIndex,
        previousIndex
      });
    } catch (err: any) {
      console.error("Assignment Execution Error:", err);
      setError("배정 처리 중 오류가 발생했습니다.");
    } finally {
      setAssigning(false);
    }
  };

  const handleUndo = async () => {
    if (!result || !config) return;

    setAssigning(true);
    try {
      const { error: undoError } = await supabase
        .from('assignment_state')
        .update({ current_index: result.previousIndex })
        .eq('id', config.id);

      if (undoError) throw undoError;

      setConfig(prev => prev ? { ...prev, current_index: result.previousIndex } : null);
      setResult(null);
      setCountInput("");
    } catch (err: any) {
      console.error("Undo Error:", err);
      setError("배정 취소 중 오류가 발생했습니다.");
    } finally {
      setAssigning(false);
    }
  };

  const resetRequest = () => {
    setResult(null);
    setCountInput("");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
            <LayoutDashboard className="absolute inset-0 m-auto w-6 h-6 text-blue-600" />
          </div>
          <p className="text-slate-500 font-black tracking-tight animate-pulse">데이터 로드 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] py-12 px-6 font-sans antialiased text-slate-900 relative">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <header className="bg-white rounded-[2rem] shadow-sm border border-slate-200 p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="p-4 bg-blue-600 rounded-2xl shadow-lg shadow-blue-100">
              <ClipboardList className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-800">
                특허결정서 담당자 배정 시스템
              </h1>
              <p className="text-blue-600 font-bold text-sm">기계부 부재자 업무 대행 관리</p>
            </div>
          </div>
          <button 
            onClick={fetchData}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-all rounded-xl border border-slate-200"
          >
            <RefreshCw className="w-4 h-4" /> 명단 갱신
          </button>
        </header>

        {error && (
          <div className="bg-red-50 border border-red-100 p-6 rounded-3xl flex items-center gap-4 text-red-800 animate-in fade-in slide-in-from-top-4">
            <AlertCircle className="w-6 h-6 shrink-0 text-red-600" />
            <p className="font-bold text-sm">{error}</p>
          </div>
        )}

        <main className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Left Side: Input Assignment */}
          <section className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 p-10 flex flex-col items-center justify-center space-y-12 min-h-[550px] relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-[0.02]">
              <UserPlus className="w-48 h-48" />
            </div>
            
            <div className="text-center space-y-2 relative z-10">
              <h2 className="text-4xl font-black text-slate-800 tracking-tight">배정 건수</h2>
            </div>

            <div className="relative w-full max-w-[340px] z-10">
              <input 
                type="number" 
                min="1" 
                max={candidates.length || 10}
                value={countInput}
                placeholder="배정건수를 입력해주세요"
                onChange={(e) => setCountInput(e.target.value)}
                className="no-spinner w-full px-4 py-8 bg-slate-100 border-4 border-slate-200 rounded-[2.5rem] focus:border-blue-500 focus:bg-white outline-none transition-all text-slate-800 text-center shadow-inner text-3xl sm:text-4xl font-black placeholder:text-base sm:placeholder:text-lg placeholder:font-bold placeholder:text-slate-500/50"
                autoFocus
                disabled={!!result}
              />
              {countInput && (
                <span className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-400 font-black text-xl">건</span>
              )}
            </div>

            <div className="w-full max-sm:max-w-full z-10 max-w-sm">
              <button 
                onClick={handleAssign}
                disabled={assigning || !countInput || parseInt(countInput) <= 0 || !!error || !!result}
                className="w-full py-6 flex items-center justify-center gap-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-100 disabled:text-slate-300 text-white font-black text-xl rounded-[2.5rem] transition-all shadow-xl active:scale-[0.98]"
              >
                {assigning ? <RefreshCw className="w-6 h-6 animate-spin" /> : "배정 실행"}
              </button>
            </div>
          </section>

          {/* Right Side: Results */}
          <section className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 p-10 min-h-[550px] flex flex-col items-center justify-center relative overflow-hidden transition-all">
            {!result ? (
              <div className="text-center space-y-6 opacity-40">
                <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center mx-auto">
                  <ChevronRight className="w-10 h-10 text-slate-300" />
                </div>
                <p className="font-bold text-slate-400">배정을 실행하면<br/>결과가 이곳에 표시됩니다.</p>
              </div>
            ) : (
              <div className="w-full flex flex-col items-center space-y-8 animate-in slide-in-from-right-8 duration-500">
                <div className="text-center">
                  <h3 className="text-lg font-black text-slate-600 tracking-tight italic">배정이 완료되었습니다</h3>
                  <p className="text-slate-400 text-[10px] font-bold mt-1 uppercase tracking-tighter">아래 담당자에게 업무를 전달하세요</p>
                </div>
                
                <div className="w-full bg-slate-50 rounded-[2.5rem] p-8 border border-slate-200/50 shadow-inner grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[280px] overflow-y-auto custom-scrollbar">
                  {result.assignedNames.map((name, i) => (
                    <div key={i} className="bg-white p-5 rounded-2xl border border-slate-100 font-black text-slate-800 shadow-sm flex items-center gap-4">
                      <span className="w-8 h-8 bg-blue-600 text-white rounded-lg text-xs flex items-center justify-center font-black">{i+1}</span>
                      <span className="text-xl tracking-tight">{name}</span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md pt-4">
                  <button 
                    onClick={handleUndo}
                    disabled={assigning}
                    className="flex-1 px-6 py-4 bg-orange-500 text-white font-black text-sm rounded-[1.5rem] hover:bg-orange-600 transition-all flex items-center justify-center gap-2 group shadow-lg shadow-orange-200"
                  >
                    <Undo2 className="w-4 h-4 group-hover:-rotate-45 transition-transform" />
                    배정 취소
                  </button>
                  <button 
                    onClick={resetRequest}
                    className="flex-1 px-6 py-4 bg-blue-600 text-white font-black text-sm rounded-[1.5rem] hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
                  >
                    확인
                  </button>
                </div>
              </div>
            )}
          </section>
        </main>

        <footer className="text-center py-8">
          <p className="text-slate-400 text-[10px] font-bold tracking-[0.2em] uppercase">
            &copy; 2026 designed by sjc
          </p>
        </footer>

      </div>

      {/* 우측 하단 로고 이미지 배치 */}
      <div className="fixed bottom-8 right-8 z-50 pointer-events-none sm:pointer-events-auto">
        <div className="bg-white/40 backdrop-blur-sm p-3 rounded-2xl border border-white/50 shadow-sm hover:bg-white/80 transition-all duration-300">
          <img 
            src="https://raw.githubusercontent.com/sjc-patent/resources/main/koreana_logo.png" 
            alt="Koreana Patent Firm" 
            className="h-10 w-auto object-contain opacity-90"
            onError={(e) => {
              (e.target as HTMLImageElement).parentElement!.style.display = 'none';
            }}
          />
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        
        /* 숫자 입력창 화살표 제거 */
        .no-spinner::-webkit-outer-spin-button,
        .no-spinner::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .no-spinner {
          -moz-appearance: textfield;
        }
      `}</style>
    </div>
  );
};

export default App;
