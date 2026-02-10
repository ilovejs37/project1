
import React, { useState, useEffect, useRef } from 'react';
import { UserCheck, Users, ChevronRight, AlertCircle, RotateCcw, FileUp, Info } from 'lucide-react';
import { Candidate, SelectionState } from './types';

// Declare XLSX globally since we're loading it from CDN in index.html
declare const XLSX: any;

const STORAGE_KEY = 'sequential_assignee_selector_state_v2';
const DEFAULT_FILE_PATH = '/candidates.xlsx';

// 시스템이 즉시 작동할 수 있도록 하는 기본 명단 (파일이 없을 경우 대비)
const INITIAL_FALLBACK_NAMES = [
  "김철수", "이영희", "박지민", "최동현", "정수진", 
  "강호준", "조은비", "윤서준", "한지혜", "임도윤"
];

const App: React.FC = () => {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [selectionCount, setSelectionCount] = useState<number>(1);
  const [selectedResults, setSelectedResults] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isAutoLoaded, setIsAutoLoaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 1. 초기 상태 로드 (LocalStorage)
  useEffect(() => {
    const savedState = localStorage.getItem(STORAGE_KEY);
    if (savedState) {
      try {
        const parsed: SelectionState = JSON.parse(savedState);
        if (parsed.candidates && parsed.candidates.length > 0) {
          setCandidates(parsed.candidates);
          setCurrentIndex(parsed.currentIndex || 0);
          setIsAutoLoaded(true);
          return; // 저장된 상태가 있으면 파일 로드 시도 안 함
        }
      } catch (e) {
        console.error("Failed to load state from localStorage", e);
      }
    }
    
    // 저장된 상태가 없으면 파일 자동 로드 시도
    fetchDefaultFile();
  }, []);

  // 2. 엑셀 파일 자동 로드 함수
  const fetchDefaultFile = async () => {
    try {
      const response = await fetch(DEFAULT_FILE_PATH);
      if (!response.ok) {
        throw new Error('Default file not found');
      }
      const arrayBuffer = await response.arrayBuffer();
      processExcelData(new Uint8Array(arrayBuffer), false);
      setIsAutoLoaded(true);
    } catch (err) {
      console.log("서버에서 'candidates.xlsx'를 찾을 수 없습니다. 기본 내장 명단을 사용합니다.");
      // 파일이 없을 경우 내장된 기본 명단으로 초기화하여 즉시 사용 가능하게 함
      const fallbackCandidates = INITIAL_FALLBACK_NAMES.map((name, index) => ({
        id: index,
        name: name
      }));
      setCandidates(fallbackCandidates);
      setIsAutoLoaded(true);
    }
  };

  // 3. 상태 변경 시 LocalStorage 동기화
  useEffect(() => {
    if (candidates.length > 0) {
      const stateToSave: SelectionState = { candidates, currentIndex };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    }
  }, [candidates, currentIndex]);

  const processExcelData = (data: Uint8Array, resetIndex: boolean = true) => {
    try {
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
      
      const names: Candidate[] = jsonData
        .flat()
        .filter(name => typeof name === 'string' && name.trim() !== '')
        .map((name, index) => ({ id: index, name: name.trim() }));

      if (names.length === 0) {
        throw new Error("파일에서 이름을 찾을 수 없습니다.");
      }

      setCandidates(names);
      if (resetIndex) {
        setCurrentIndex(0);
        setHistoryIndex(null);
        setSelectedResults([]);
      } else {
        setCurrentIndex(prev => (prev >= names.length ? 0 : prev));
      }
      setError(null);
    } catch (err: any) {
      console.error("Excel Parsing Error", err);
      setError("명단 파일을 불러오지 못했습니다. 올바른 엑셀 파일인지 확인해주세요.");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        processExcelData(data, true);
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const handleSelect = () => {
    if (candidates.length === 0) {
      setError("배정할 명단이 없습니다.");
      return;
    }

    if (selectionCount <= 0) {
      setError("처리건수는 1건 이상이어야 합니다.");
      return;
    }

    setHistoryIndex(currentIndex);

    const results: string[] = [];
    let nextIdx = currentIndex;

    for (let i = 0; i < selectionCount; i++) {
      results.push(candidates[nextIdx].name);
      nextIdx = (nextIdx + 1) % candidates.length;
    }

    setSelectedResults(results);
    setCurrentIndex(nextIdx);
    setError(null);
  };

  const handleUndo = () => {
    if (historyIndex !== null) {
      setCurrentIndex(historyIndex);
      setSelectedResults([]);
      setHistoryIndex(null);
      setError(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-16 px-4 sm:px-6 font-sans">
      <div className="max-w-6xl mx-auto space-y-12">
        
        {/* Header Section */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-full mb-2">
            <Info className="w-3.5 h-3.5" />
            시스템 가동 중
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight sm:text-4xl lg:text-5xl leading-tight">
            기계부 퇴사자/부재자 특허결정서 처리 담당자 배정
          </h1>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto">
            애플리케이션 시작 시 등록된 명단을 자동으로 불러옵니다. 순서에 따라 공정하게 담당자를 선정하세요.
          </p>
        </div>

        {/* Main Interface Area */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
          
          {/* Input Window (Left) */}
          <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-200 overflow-hidden transition-all flex flex-col relative">
            <div className="bg-slate-50/80 border-b border-slate-200 px-8 py-5 flex items-center justify-between">
              <h2 className="font-bold text-slate-800 flex items-center gap-2.5">
                <Users className="w-5 h-5 text-indigo-600" />
                배정 요청
              </h2>
              
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm"
                  title="명단 엑셀 파일 업데이트"
                >
                  <FileUp className="w-3.5 h-3.5" />
                  명단 갱신
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept=".xlsx, .xls" 
                  className="hidden" 
                />
                <div className="flex items-center gap-1.5 ml-1">
                  <div className={`w-2 h-2 rounded-full ${candidates.length > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {candidates.length > 0 ? 'Ready' : 'Wait'}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="p-10 flex flex-col items-center justify-center flex-grow gap-8">
              {!isAutoLoaded && candidates.length === 0 ? (
                <div className="flex flex-col items-center gap-4 py-8">
                  <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                  <p className="text-slate-500 font-medium animate-pulse">명단을 불러오는 중입니다...</p>
                </div>
              ) : (
                <>
                  <div className="w-full max-w-xs text-center">
                    <label htmlFor="count-input" className="block text-sm font-semibold text-slate-600 mb-3">
                      배정할 건수 (결정서 수)
                    </label>
                    <div className="relative group">
                      <input
                        id="count-input"
                        type="number"
                        min="1"
                        value={selectionCount}
                        onChange={(e) => setSelectionCount(Math.max(1, parseInt(e.target.value) || 1))}
                        className="block w-full px-6 py-4 text-4xl font-black text-center text-slate-800 border-2 border-slate-200 rounded-2xl focus:ring-8 focus:ring-indigo-50 focus:border-indigo-500 transition-all outline-none bg-slate-50/30 group-hover:bg-white"
                      />
                    </div>
                  </div>
                  
                  <button
                    onClick={handleSelect}
                    disabled={candidates.length === 0}
                    className={`group relative w-full flex items-center justify-center gap-4 px-10 py-5 rounded-2xl text-white font-bold text-xl shadow-2xl transition-all ${
                      candidates.length === 0 
                      ? 'bg-slate-300 cursor-not-allowed shadow-none' 
                      : 'bg-indigo-600 hover:bg-indigo-700 hover:-translate-y-1 active:scale-[0.98] active:translate-y-0'
                    }`}
                  >
                    <UserCheck className="w-6 h-6" />
                    담당자 배정 실행
                    <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </button>
                </>
              )}
              
              {error && (
                <div className="flex items-center gap-3 text-red-600 text-sm font-semibold bg-red-50 px-6 py-4 rounded-xl border border-red-100 animate-in fade-in zoom-in duration-300">
                  <AlertCircle className="w-5 h-5" />
                  {error}
                </div>
              )}
            </div>

            {/* Undo Button and Status at Bottom */}
            <div className="px-8 py-6 border-t border-slate-50 bg-slate-50/30 flex justify-between items-center">
              <button
                onClick={handleUndo}
                disabled={historyIndex === null}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                  historyIndex === null
                  ? 'text-slate-300 cursor-not-allowed'
                  : 'text-slate-500 hover:text-indigo-600 hover:bg-white border border-transparent hover:border-slate-200 shadow-sm active:scale-95'
                }`}
              >
                <RotateCcw className={`w-4 h-4 ${historyIndex !== null ? 'animate-in spin-in-180 duration-500' : ''}`} />
                이번 배정 취소
              </button>

              {candidates.length > 0 && (
                <div className="text-[11px] font-bold text-slate-400">
                  현재 배정 순번: <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{candidates[currentIndex]?.name}</span>
                </div>
              )}
            </div>
          </div>

          {/* Output Window (Right) */}
          <div className={`bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-200 overflow-hidden transition-all duration-700 flex flex-col ${selectedResults.length > 0 ? 'translate-y-0 opacity-100' : 'translate-y-0 opacity-60'}`}>
            <div className="bg-slate-50/80 border-b border-slate-200 px-8 py-5 flex items-center justify-between">
              <h2 className="font-bold text-slate-800 flex items-center gap-2.5">
                <UserCheck className="w-5 h-5 text-emerald-600" />
                배정 결과
              </h2>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Selected List</span>
            </div>
            
            <div className="p-10 min-h-[400px] flex flex-col flex-grow">
              {selectedResults.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 overflow-y-auto max-h-[500px] pr-2 custom-scrollbar">
                  {selectedResults.map((name, idx) => (
                    <div 
                      key={`${name}-${idx}-${Date.now()}`} 
                      className="animate-in fade-in slide-in-from-right-6 duration-700 fill-mode-both"
                      style={{ animationDelay: `${idx * 100}ms` }}
                    >
                      <div className="bg-emerald-50/50 border-2 border-emerald-100 rounded-2xl p-6 flex items-center justify-between group hover:bg-emerald-50 transition-colors">
                        <div className="flex items-center gap-5">
                          <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center text-xl font-black shadow-lg shadow-emerald-200">
                            {idx + 1}
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-emerald-600/70 uppercase tracking-tighter mb-0.5">Assigned Expert</p>
                            <span className="text-2xl font-black text-emerald-950 tracking-tight">{name}</span>
                          </div>
                        </div>
                        <div className="hidden sm:block">
                          <span className="text-[11px] font-black text-emerald-600 bg-white px-3 py-1.5 rounded-lg border border-emerald-100 shadow-sm">배정완료</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex-grow flex flex-col items-center justify-center text-slate-400 space-y-5 py-12">
                  <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto border-2 border-dashed border-slate-200 opacity-40">
                    <UserCheck className="w-12 h-12" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="font-bold text-slate-500 text-lg">배정 대기 중</p>
                    <p className="text-sm opacity-70 italic max-w-[200px]">배정 요청 버튼을 누르면 담당자가 순차적으로 표시됩니다.</p>
                  </div>
                </div>
              )}
            </div>
            
            <div className="bg-slate-50/50 border-t border-slate-100 px-8 py-4 text-[11px] text-slate-400 font-medium flex justify-between items-center mt-auto">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                <span>등록 명단: 총 {candidates.length}명</span>
              </div>
              {selectedResults.length > 0 && (
                <span className="animate-in fade-in duration-500 text-slate-500">{new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</span>
              )}
            </div>
          </div>

        </div>
      </div>
      
      {/* Footer */}
      <footer className="mt-24 text-center">
        <p className="text-slate-400 text-[10px] font-bold tracking-[0.2em] uppercase">
          &copy; 기계부 특허결정서 담당자 순차 배정 시스템
        </p>
      </footer>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
      `}</style>
    </div>
  );
};

export default App;

