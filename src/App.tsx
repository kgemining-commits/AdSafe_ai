import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Copy, 
  Share2, 
  ChevronRight, 
  Info,
  Sparkles,
  History,
  Settings,
  Bell,
  User,
  FileText,
  Search,
  Check
} from 'lucide-react';
import { cn } from './lib/utils';
import { DISCLAIMER, AD_TYPES, MEDIA_TYPES } from './constants';
import { reviewAdvertisement, ReviewResult, ComplianceIssue, QualityIssue } from './services/gemini';
import { domToJpeg } from 'modern-screenshot';

// --- Components ---

const StickyBanner = () => (
  <div id="sticky-banner" className="sticky top-0 z-50 bg-amber-400 text-amber-950 py-2 px-4 text-center text-xs font-medium shadow-sm">
    <div className="max-w-7xl mx-auto flex items-center justify-center gap-2">
      <AlertTriangle size={14} />
      <span>[v0.01 Beta] 본 앱은 기초 단계의 광고물 점검을 지원하며, AI의 해석 및 추천 문구가 실제 규정과 다를 수 있으므로 적용 시 신중을 기하시기 바랍니다.</span>
    </div>
  </div>
);

const BentoCard = ({ title, children, className, icon: Icon, subtitle }: { title: string, children: React.ReactNode, className?: string, icon?: any, subtitle?: string }) => (
  <div className={cn("bg-white rounded-[2.5rem] border border-gray-100 p-8 shadow-sm hover:shadow-md transition-all duration-300", className)}>
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-gray-50 flex items-center justify-center text-indigo-600">
          {Icon && <Icon size={20} />}
        </div>
        <div>
          <h3 className="font-bold text-gray-900 tracking-tight">{title}</h3>
          {subtitle && <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider mt-0.5">{subtitle}</p>}
        </div>
      </div>
    </div>
    {children}
  </div>
);

const RecommendationTooltip = ({ 
  phrases, 
  onApply, 
  onClose,
  position 
}: { 
  phrases: string[], 
  onApply: (phrase: string) => void, 
  onClose: () => void,
  position: { top: number, left: number }
}) => (
  <motion.div 
    initial={{ opacity: 0, scale: 0.9, y: 10 }}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    exit={{ opacity: 0, scale: 0.9, y: 10 }}
    style={{ top: position.top, left: position.left }}
    className="fixed z-[100] w-72 bg-white/90 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-4 overflow-hidden"
  >
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm">
        <Sparkles size={14} />
        <span>AI 대체 문구 추천</span>
      </div>
      <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XCircle size={16} /></button>
    </div>
    <div className="space-y-2">
      {phrases.map((phrase, i) => (
        <button 
          key={i}
          onClick={() => onApply(phrase)}
          className="w-full text-left p-3 rounded-xl bg-white border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50 transition-all text-sm group flex items-center justify-between"
        >
          <span className="text-gray-700">{phrase}</span>
          <div className="opacity-0 group-hover:opacity-100 bg-indigo-600 text-white text-[10px] px-2 py-1 rounded-md">적용</div>
        </button>
      ))}
    </div>
  </motion.div>
);

// --- Main App ---

// Error Boundary Component
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
          <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl border border-gray-100 text-center space-y-6">
            <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 mx-auto">
              <AlertTriangle size={40} />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-gray-900">오류가 발생했습니다</h2>
              <p className="text-gray-500 text-sm">애플리케이션 실행 중 예상치 못한 오류가 발생했습니다.</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-2xl text-left overflow-auto max-h-40">
              <code className="text-xs text-rose-600 font-mono">{this.state.error?.message}</code>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
            >
              페이지 새로고침
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  const [view, setView] = useState<'new' | 'history' | 'settings'>('new');
  const [adType, setAdType] = useState(AD_TYPES[0]);
  const [mediaType, setMediaType] = useState("지면 광고");
  const [inputText, setInputText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tooltipData, setTooltipData] = useState<{ phrases: string[], position: { top: number, left: number }, originalText: string } | null>(null);
  const [modifiedText, setModifiedText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [history, setHistory] = useState<{ id: string, name: string, date: string, status: string, adType: string, mediaType: string }[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    const savedHistory = localStorage.getItem('adsafe_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to load history", e);
      }
    }
  }, []);

  const saveToHistory = (newResult: ReviewResult) => {
    try {
      const newItem = {
        id: Math.random().toString(36).substr(2, 9),
        name: inputText.slice(0, 15) + (inputText.length > 15 ? '...' : ''),
        date: new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '.').replace(/\.$/, ''),
        status: newResult.overall_status,
        adType,
        mediaType
      };
      const updatedHistory = [newItem, ...history].slice(0, 10);
      setHistory(updatedHistory);
      localStorage.setItem('adsafe_history', JSON.stringify(updatedHistory));
    } catch (e) {
      console.error("Failed to save to history", e);
    }
  };

  const getStats = () => {
    if (history.length === 0) return { passRate: 0, passCount: 0, failCount: 0 };
    const passCount = history.filter(h => h.status === 'PASS').length;
    const warningCount = history.filter(h => h.status === 'WARNING').length;
    const failCount = history.filter(h => h.status === 'FAIL').length;
    return {
      passRate: Math.round((passCount / history.length) * 100),
      passCount,
      warningCount,
      failCount
    };
  };

  const analysisSteps = [
    "업로드된 에셋 분석 중...",
    "금소법 및 협회 규정 DB 검색 중...",
    "맞춤법 및 문맥 교정 중...",
    "대체 추천 문구 생성 중..."
  ];

  useEffect(() => {
    if (isAnalyzing) {
      const interval = setInterval(() => {
        setAnalysisStep((prev) => (prev + 1) % analysisSteps.length);
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [isAnalyzing]);

  const handleStartReview = async () => {
    if (!inputText.trim()) return;
    
    setIsAnalyzing(true);
    setResult(null);
    setError(null);
    setModifiedText(inputText);
    
    try {
      const res = await reviewAdvertisement(adType, mediaType, inputText);
      if (!res) throw new Error("심의 결과를 받아오지 못했습니다.");
      setResult(res);
      saveToHistory(res);
    } catch (err) {
      console.error("Review Error:", err);
      const errorMessage = err instanceof Error ? err.message : "심의 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
      setError(errorMessage);
      setToast("심의에 실패했습니다.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    if (file.type === 'text/plain') {
      const reader = new FileReader();
      reader.onload = (e) => {
        setInputText(e.target?.result as string);
      };
      reader.readAsText(file);
    } else {
      setInputText(`[파일 업로드됨: ${file.name}]\n\n이 베타 버전에서는 텍스트 기반 심의가 우선 지원됩니다. 이미지/PDF의 경우 텍스트를 직접 입력하거나 추출된 내용을 여기에 붙여넣어 주세요.`);
    }
  };

  const handleTextClick = (e: React.MouseEvent, text: string, phrases: string[]) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setTooltipData({
      phrases,
      position: { top: rect.bottom + window.scrollY + 10, left: rect.left + window.scrollX },
      originalText: text
    });
  };

  const handleCopyReport = () => {
    if (!result) return;
    const report = `
[AdSafe AI 심의 결과 리포트]
--------------------------------------------------
발행일시: ${new Date().toLocaleString('ko-KR')}
심의상태: ${result.overall_status}
광고종류: ${adType}
게재매체: ${mediaType}

[원본 텍스트]
${inputText}

[법규 위반 사항]
${result.compliance_issues.length > 0 
  ? result.compliance_issues.map(i => `- [${i.violation_type}] ${i.original_text}\n  사유: ${i.reason}\n  추천: ${i.recommended_phrases.join(', ')}`).join('\n')
  : '발견된 위반 사항이 없습니다.'}

[품질 점검 사항]
${result.grammar_and_context_issues.length > 0
  ? result.grammar_and_context_issues.map(i => `- [${i.issue_type}] ${i.original_text}\n  사유: ${i.reason}\n  추천: ${i.recommended_phrases.join(', ')}`).join('\n')
  : '발견된 품질 이슈가 없습니다.'}
--------------------------------------------------
본 리포트는 AI에 의해 생성되었으며, 최종 결정은 준법감시인의 확인이 필요합니다.
    `;
    navigator.clipboard.writeText(report.trim());
    setToast("리포트가 클립보드에 복사되었습니다.");
  };

  const handleShare = async () => {
    if (!result) return;
    
    const reportText = `
[AdSafe AI 심의 결과 리포트]
--------------------------------------------------
발행일시: ${new Date().toLocaleString('ko-KR')}
심의상태: ${result.overall_status}
광고종류: ${adType}
게재매체: ${mediaType}

[원본 텍스트]
${inputText}

[법규 위반 사항]
${result.compliance_issues.length > 0 
  ? result.compliance_issues.map(i => `- [${i.violation_type}] ${i.original_text}\n  사유: ${i.reason}\n  추천: ${i.recommended_phrases.join(', ')}`).join('\n')
  : '발견된 위반 사항이 없습니다.'}

[품질 점검 사항]
${result.grammar_and_context_issues.length > 0
  ? result.grammar_and_context_issues.map(i => `- [${i.issue_type}] ${i.original_text}\n  사유: ${i.reason}\n  추천: ${i.recommended_phrases.join(', ')}`).join('\n')
  : '발견된 품질 이슈가 없습니다.'}
--------------------------------------------------
본 리포트는 AI에 의해 생성되었으며, 최종 결정은 준법감시인의 확인이 필요합니다.
    `;

    const shareData = {
      title: 'AdSafe AI 심의 리포트',
      text: reportText.trim(),
      url: window.location.href
    };
    
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.error("Share failed", err);
        handleCopyReport();
      }
    } else {
      handleCopyReport();
    }
  };

  const handleSaveAsJPG = async () => {
    if (!reportRef.current || !result) return;
    
    setToast("이미지 생성 중...");
    
    try {
      const imgData = await domToJpeg(reportRef.current, {
        scale: 2,
        quality: 0.9,
        backgroundColor: '#F8F9FB',
      });
      
      const link = document.createElement('a');
      const now = new Date();
      const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
      const filename = `광고물_${timestamp}.jpg`;
      
      link.href = imgData;
      link.download = filename;
      link.click();
      
      setToast("이미지가 저장되었습니다.");
    } catch (err) {
      console.error("Image generation failed", err);
      setToast("이미지 생성에 실패했습니다.");
    }
  };

  const applyRecommendation = (newPhrase: string) => {
    if (!tooltipData) return;
    // Escape special characters for regex
    const escapedText = tooltipData.originalText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedText, 'g');
    setModifiedText(prev => prev.replace(regex, newPhrase));
    setTooltipData(null);
  };

  const renderHighlightedText = () => {
    if (!result) return <div className="whitespace-pre-wrap leading-relaxed text-gray-800">{modifiedText}</div>;

    const complianceIssues = result.compliance_issues || [];
    const qualityIssues = result.grammar_and_context_issues || [];

    const allIssues = [
      ...complianceIssues.map(i => ({ ...i, type: 'compliance' })),
      ...qualityIssues.map(i => ({ ...i, type: 'quality' }))
    ];

    if (allIssues.length === 0) return <div className="whitespace-pre-wrap leading-relaxed text-gray-800">{modifiedText}</div>;

    // Sort by length descending to avoid partial matches interfering
    allIssues.sort((a, b) => b.original_text.length - a.original_text.length);

    // Create a regex that matches any of the original texts
    const pattern = allIssues.map(i => i.original_text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const regex = new RegExp(`(${pattern})`, 'g');

    const parts = modifiedText.split(regex);

    return (
      <div className="whitespace-pre-wrap leading-relaxed text-gray-800">
        {parts.map((part, i) => {
          const issue = allIssues.find(iss => iss.original_text === part);
          if (issue) {
            return (
              <span 
                key={i}
                onClick={(e) => handleTextClick(e, issue.original_text, issue.recommended_phrases)}
                className={cn(
                  "cursor-pointer border-b-2 transition-all px-1 py-0.5 rounded-md font-bold",
                  issue.type === 'compliance' 
                    ? "border-rose-400 bg-rose-50 text-rose-700 hover:bg-rose-100" 
                    : "border-indigo-400 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                )}
              >
                {part}
              </span>
            );
          }
          return <span key={i}>{part}</span>;
        })}
      </div>
    );
  };

  const Navbar = () => (
    <nav id="navbar" className="bg-white/80 backdrop-blur-md border-b border-gray-200 px-6 py-3 flex items-center justify-between sticky top-8 z-40 print:hidden">
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('new')}>
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
            <ShieldCheck size={20} />
          </div>
          <span className="font-bold text-xl tracking-tight text-gray-900">AdSafe AI</span>
        </div>
        <div className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-500">
          <button 
            onClick={() => { setView('new'); setResult(null); }} 
            className={cn(view === 'new' ? "text-indigo-600" : "hover:text-gray-900 transition-colors")}
          >
            새 심의
          </button>
          <button 
            onClick={() => setView('history')} 
            className={cn(view === 'history' ? "text-indigo-600" : "hover:text-gray-900 transition-colors")}
          >
            히스토리
          </button>
          <button 
            onClick={() => setView('settings')} 
            className={cn(view === 'settings' ? "text-indigo-600" : "hover:text-gray-900 transition-colors")}
          >
            설정
          </button>
        </div>
      </div>
      <div className="flex items-center gap-4 text-gray-500">
        <button className="p-2 hover:bg-gray-100 rounded-full transition-colors"><Bell size={20} /></button>
        <button className="p-2 hover:bg-gray-100 rounded-full transition-colors"><User size={20} /></button>
      </div>
    </nav>
  );

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#F8F9FB] font-sans text-gray-900 selection:bg-indigo-100 selection:text-indigo-900">
      <StickyBanner />
      <Navbar />

      <main className="max-w-7xl mx-auto p-6 md:p-10">
        <AnimatePresence mode="wait">
          {view === 'history' ? (
            <motion.div 
              key="history-view"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-4xl font-bold tracking-tight text-gray-900 mb-2">심의 히스토리</h1>
                  <p className="text-gray-500">과거에 진행했던 심의 내역을 확인하고 관리하세요.</p>
                </div>
                <button 
                  onClick={() => { setView('new'); setResult(null); }}
                  className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-semibold text-sm shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center gap-2"
                >
                  <Sparkles size={16} />
                  새 심의 시작하기
                </button>
              </div>

              <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">날짜</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">광고물 명칭</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">종류 / 매체</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">최종 상태</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-400"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {history.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-20 text-center text-gray-400 text-sm">심의 내역이 없습니다.</td>
                        </tr>
                      ) : (
                        history.map((item) => (
                          <tr key={item.id} className="hover:bg-gray-50 transition-colors group">
                            <td className="px-6 py-4 text-sm text-gray-500">{item.date}</td>
                            <td className="px-6 py-4 text-sm font-semibold text-gray-900">{item.name}</td>
                            <td className="px-6 py-4 text-xs text-gray-500">{item.adType} / {item.mediaType}</td>
                            <td className="px-6 py-4">
                              <div className={cn(
                                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold",
                                item.status === 'PASS' ? "bg-emerald-100 text-emerald-700" : 
                                item.status === 'WARNING' ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                              )}>
                                {item.status === 'PASS' ? <CheckCircle2 size={10} /> : <AlertTriangle size={10} />}
                                {item.status}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button className="p-2 text-gray-400 hover:text-indigo-600 transition-colors opacity-0 group-hover:opacity-100">
                                <ChevronRight size={18} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          ) : view === 'settings' ? (
            <motion.div 
              key="settings-view"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-3xl mx-auto space-y-8"
            >
              <div>
                <h1 className="text-4xl font-bold tracking-tight text-gray-900 mb-2">설정</h1>
                <p className="text-gray-500">AdSafe AI의 심의 환경 및 계정 설정을 관리합니다.</p>
              </div>

              <div className="space-y-6">
                <BentoCard title="심의 엔진 설정" icon={Settings}>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 border border-gray-100">
                      <div>
                        <div className="text-sm font-semibold">AI 모델 선택</div>
                        <div className="text-xs text-gray-400">심의에 사용할 Gemini 모델을 선택합니다.</div>
                      </div>
                      <select className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs outline-none">
                        <option>Gemini 3 Flash (권장)</option>
                        <option>Gemini 3.1 Pro</option>
                      </select>
                    </div>
                    <div className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 border border-gray-100">
                      <div>
                        <div className="text-sm font-semibold">RAG 데이터베이스 연동</div>
                        <div className="text-xs text-gray-400">최신 규정 데이터를 실시간으로 참조합니다.</div>
                      </div>
                      <div className="flex items-center gap-2 text-emerald-600 font-bold text-[10px]">
                        <CheckCircle2 size={14} />
                        연결됨
                      </div>
                    </div>
                  </div>
                </BentoCard>

                <BentoCard title="데이터 관리" icon={History}>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 border border-gray-100">
                      <div>
                        <div className="text-sm font-semibold">로컬 히스토리 삭제</div>
                        <div className="text-xs text-gray-400">브라우저에 저장된 모든 심의 내역을 삭제합니다.</div>
                      </div>
                      {!showDeleteConfirm ? (
                        <button 
                          onClick={() => setShowDeleteConfirm(true)}
                          className="text-red-500 text-xs font-bold hover:underline"
                        >
                          전체 삭제
                        </button>
                      ) : (
                        <div className="flex gap-2">
                          <button 
                            onClick={() => {
                              localStorage.removeItem('adsafe_history');
                              setHistory([]);
                              setShowDeleteConfirm(false);
                              setToast("모든 히스토리가 삭제되었습니다.");
                            }}
                            className="bg-red-500 text-white px-3 py-1 rounded-lg text-[10px] font-bold"
                          >
                            확인
                          </button>
                          <button 
                            onClick={() => setShowDeleteConfirm(false)}
                            className="bg-gray-200 text-gray-600 px-3 py-1 rounded-lg text-[10px] font-bold"
                          >
                            취소
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </BentoCard>
              </div>
            </motion.div>
          ) : !result && !isAnalyzing ? (
            <motion.div 
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {/* Header */}
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                  <h1 className="text-4xl font-bold tracking-tight text-gray-900 mb-2">스마트 광고 심의</h1>
                  <p className="text-gray-500">광고물을 업로드하여 실시간 법규 위반 및 품질 점검을 시작하세요.</p>
                </div>
                <div className="flex gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 ml-1">광고물 종류</label>
                    <select 
                      value={adType} 
                      onChange={(e) => setAdType(e.target.value)}
                      className="block w-48 bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
                    >
                      {AD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 ml-1">게재 매체</label>
                    <select 
                      value={mediaType} 
                      onChange={(e) => setMediaType(e.target.value)}
                      className="block w-48 bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
                    >
                      {MEDIA_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Upload Area */}
              <div 
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  "group relative bg-white border-2 border-dashed rounded-[2rem] p-12 flex flex-col items-center justify-center gap-6 transition-all overflow-hidden",
                  isDragging ? "border-indigo-600 bg-indigo-50/50" : "border-gray-200 hover:border-indigo-400 hover:bg-indigo-50/30"
                )}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  className="hidden" 
                  accept=".txt,.pdf,.jpg,.jpeg,.png"
                />
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center gap-4 cursor-pointer"
                >
                  <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                    <Upload size={32} />
                  </div>
                  <div className="text-center">
                    <h2 className="text-xl font-semibold mb-1">광고물 파일 업로드</h2>
                    <p className="text-gray-400 text-sm">이미지(JPG, PNG) 또는 PDF 파일을 끌어다 놓거나 <span className="text-indigo-600 font-semibold underline">클릭하여 불러오기</span></p>
                  </div>
                </div>
                
                <div className="w-full max-w-2xl mt-4">
                  <div className="relative">
                    <textarea 
                      placeholder="또는 여기에 광고 문구를 직접 입력하세요..."
                      value={inputText}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setInputText(e.target.value)}
                      className="w-full h-40 bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
                    />
                    {error && (
                      <div className="mt-2 text-xs text-red-500 flex items-center gap-1">
                        <AlertTriangle size={12} />
                        {error}
                      </div>
                    )}
                    <div className="absolute bottom-4 right-4 flex gap-2">
                      <button 
                        onClick={handleStartReview}
                        disabled={!inputText.trim()}
                        className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-semibold text-sm shadow-lg shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50 disabled:shadow-none transition-all flex items-center gap-2"
                      >
                        <Sparkles size={16} />
                        AI 심의 시작하기
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bento Widgets */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <BentoCard title="최근 심의 히스토리" icon={History} className="md:col-span-2">
                  <div className="space-y-3">
                    {history.length === 0 ? (
                      <div className="text-center py-10 text-gray-400 text-sm">심의 내역이 없습니다.</div>
                    ) : (
                      history.map((item, i) => (
                        <div key={item.id} className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 border border-gray-100 hover:bg-gray-100 transition-colors cursor-pointer">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-gray-400">
                              <FileText size={18} />
                            </div>
                            <div>
                              <div className="text-sm font-semibold truncate max-w-[200px]">{item.name}</div>
                              <div className="text-[10px] text-gray-400">{item.date} • {item.mediaType}</div>
                            </div>
                          </div>
                          <div className={cn(
                            "text-[10px] font-bold px-2 py-1 rounded-md",
                            item.status === 'PASS' ? "bg-emerald-100 text-emerald-700" : 
                            item.status === 'WARNING' ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                          )}>
                            {item.status}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </BentoCard>
                <BentoCard title="주간 심의 통계" icon={Search}>
                  <div className="h-48 flex flex-col items-center justify-center gap-4">
                    <div className="relative w-32 h-32">
                      <svg className="w-full h-full" viewBox="0 0 36 36">
                        <path className="text-gray-100" strokeDasharray="100, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                        <path className="text-indigo-600" strokeDasharray={`${getStats().passRate}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl font-bold">{getStats().passRate}%</span>
                        <span className="text-[10px] text-gray-400 font-medium">통과율</span>
                      </div>
                    </div>
                    <div className="flex gap-4 text-[10px] font-medium">
                      <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-indigo-600" /> 통과 ({getStats().passCount})</div>
                      <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-400" /> 경고 ({getStats().warningCount || 0})</div>
                      <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-400" /> 반려 ({getStats().failCount})</div>
                    </div>
                  </div>
                </BentoCard>
              </div>
            </motion.div>
          ) : isAnalyzing ? (
            <motion.div 
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] flex items-center justify-center bg-white/60 backdrop-blur-xl"
            >
              <div className="text-center space-y-6">
                <div className="relative w-24 h-24 mx-auto">
                  <div className="absolute inset-0 border-4 border-indigo-100 rounded-full" />
                  <motion.div 
                    className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center text-indigo-600">
                    <ShieldCheck size={32} />
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-gray-900">{analysisSteps[analysisStep]}</h3>
                  <p className="text-xs text-gray-400 font-mono">AdSafe AI Engine v2.0 • Gemini 3 Flash</p>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8 pb-20"
              ref={reportRef}
            >
              {/* Professional Report Header */}
              <div className="bg-white p-8 rounded-[3rem] border border-gray-100 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/30 blur-[80px] rounded-full -mr-20 -mt-20" />
                
                <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex items-center gap-6">
                    <button 
                      onClick={() => setResult(null)}
                      className="w-12 h-12 flex items-center justify-center hover:bg-gray-100 rounded-2xl transition-all text-gray-400 group"
                    >
                      <XCircle size={24} className="group-hover:rotate-90 transition-transform duration-300" />
                    </button>
                    <div>
                      <div className="flex items-center gap-4 mb-2">
                        <h2 className="text-3xl font-black tracking-tight text-gray-900">심의 결과 리포트</h2>
                        <div className={cn(
                          "px-4 py-1.5 rounded-full text-[11px] font-black flex items-center gap-2 uppercase tracking-widest shadow-sm",
                          result?.overall_status === 'PASS' ? "bg-emerald-500 text-white" :
                          result?.overall_status === 'WARNING' ? "bg-amber-500 text-white" : "bg-rose-500 text-white"
                        )}>
                          {result?.overall_status === 'PASS' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                          {result?.overall_status}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-400 font-medium">
                        <span className="flex items-center gap-1.5"><FileText size={14} /> {adType}</span>
                        <span className="w-1 h-1 rounded-full bg-gray-200" />
                        <span className="flex items-center gap-1.5"><Search size={14} /> {mediaType}</span>
                        <span className="w-1 h-1 rounded-full bg-gray-200" />
                        <span className="flex items-center gap-1.5"><History size={14} /> {new Date().toLocaleDateString('ko-KR')}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={handleSaveAsJPG}
                      className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-white border border-gray-200 text-sm font-bold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm active:scale-95"
                    >
                      <FileText size={18} className="text-indigo-600" />
                      JPG 저장
                    </button>
                    <button 
                      onClick={handleShare}
                      className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 active:scale-95"
                    >
                      <Share2 size={18} />
                      공유하기
                    </button>
                  </div>
                </div>
              </div>

              {/* Summary Stats Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { 
                    label: '종합 결과', 
                    value: result?.overall_status === 'PASS' ? '적합' : result?.overall_status === 'WARNING' ? '주의' : '부적합', 
                    color: result?.overall_status === 'PASS' ? 'text-emerald-600' : result?.overall_status === 'WARNING' ? 'text-amber-600' : 'text-rose-600',
                    bg: result?.overall_status === 'PASS' ? 'bg-emerald-50' : result?.overall_status === 'WARNING' ? 'bg-amber-50' : 'bg-rose-50'
                  },
                  { 
                    label: '법규 위반', 
                    value: `${result?.compliance_issues.length}건`, 
                    color: result?.compliance_issues.length > 0 ? 'text-rose-600' : 'text-emerald-600',
                    bg: result?.compliance_issues.length > 0 ? 'bg-rose-50' : 'bg-emerald-50'
                  },
                  { 
                    label: '품질 이슈', 
                    value: `${result?.grammar_and_context_issues.length}건`, 
                    color: result?.grammar_and_context_issues.length > 0 ? 'text-indigo-600' : 'text-emerald-600',
                    bg: result?.grammar_and_context_issues.length > 0 ? 'bg-indigo-50' : 'bg-emerald-50'
                  },
                  { 
                    label: '리스크 레벨', 
                    value: result?.compliance_issues.length >= 3 ? 'CRITICAL' : result?.compliance_issues.length >= 1 ? 'MODERATE' : 'LOW', 
                    color: result?.compliance_issues.length >= 3 ? 'text-rose-600' : result?.compliance_issues.length >= 1 ? 'text-amber-600' : 'text-emerald-600',
                    bg: result?.compliance_issues.length >= 3 ? 'bg-rose-50' : result?.compliance_issues.length >= 1 ? 'bg-amber-50' : 'bg-emerald-50'
                  }
                ].map((stat, i) => (
                  <div key={i} className={cn("p-6 rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center transition-transform hover:scale-105 duration-300", stat.bg)}>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">{stat.label}</span>
                    <span className={cn("text-2xl font-black tracking-tighter", stat.color)}>{stat.value}</span>
                  </div>
                ))}
              </div>

              {/* Main Content Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left: Original Content Viewer */}
                <div className="lg:col-span-5 flex flex-col gap-6">
                  <div className="bg-white rounded-[3rem] border border-gray-100 shadow-sm overflow-hidden flex flex-col h-full">
                    <div className="px-8 py-6 border-b border-gray-50 flex items-center justify-between bg-gray-50/30">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-indigo-500" />
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">심의 대상 광고물</span>
                      </div>
                      <div className="flex gap-3">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-rose-500 uppercase"><div className="w-1.5 h-1.5 rounded-full bg-rose-500" /> 위반</div>
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-500 uppercase"><div className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> 교정</div>
                      </div>
                    </div>
                    <div className="flex-1 p-10 font-medium text-gray-800 leading-relaxed text-lg">
                      {renderHighlightedText()}
                    </div>
                  </div>
                </div>

                {/* Right: Detailed Issues List */}
                <div className="lg:col-span-7 space-y-8">
                  <BentoCard 
                    title="법규 위반 사항" 
                    subtitle="Compliance Issues" 
                    icon={AlertTriangle} 
                    className="border-rose-100"
                  >
                    <div className="space-y-6">
                      {result?.compliance_issues.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-300 gap-4">
                          <CheckCircle2 size={48} className="opacity-20" />
                          <p className="text-sm font-bold">발견된 법규 위반 사항이 없습니다.</p>
                        </div>
                      ) : (
                        result?.compliance_issues.map((issue, i) => (
                          <div key={i} className="relative pl-6 border-l-2 border-rose-100 group">
                            <div className="absolute top-0 left-[-5px] w-2 h-2 rounded-full bg-rose-500 group-hover:scale-150 transition-transform" />
                            <div className="flex items-center gap-3 mb-2">
                              <span className="text-[10px] font-black bg-rose-50 text-rose-600 px-2 py-0.5 rounded-lg uppercase tracking-wider">{issue.violation_type}</span>
                              <h4 className="font-bold text-gray-900">{issue.original_text}</h4>
                            </div>
                            <p className="text-sm text-gray-500 leading-relaxed mb-4">{issue.reason}</p>
                            <div className="bg-rose-50/50 rounded-2xl p-4 border border-rose-100/50">
                              <div className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <Sparkles size={12} /> AI 추천 대체 문구
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {issue.recommended_phrases.map((p, idx) => (
                                  <div key={idx} className="text-xs bg-white border border-rose-100 px-3 py-1.5 rounded-xl text-rose-700 font-bold shadow-sm">
                                    {p}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </BentoCard>

                  <BentoCard 
                    title="문맥 및 품질 점검" 
                    subtitle="Quality Issues" 
                    icon={CheckCircle2} 
                    className="border-indigo-100"
                  >
                    <div className="space-y-6">
                      {result?.grammar_and_context_issues.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-300 gap-4">
                          <CheckCircle2 size={48} className="opacity-20" />
                          <p className="text-sm font-bold">발견된 품질 이슈가 없습니다.</p>
                        </div>
                      ) : (
                        result?.grammar_and_context_issues.map((issue, i) => (
                          <div key={i} className="relative pl-6 border-l-2 border-indigo-100 group">
                            <div className="absolute top-0 left-[-5px] w-2 h-2 rounded-full bg-indigo-500 group-hover:scale-150 transition-transform" />
                            <div className="flex items-center gap-3 mb-2">
                              <span className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-lg uppercase tracking-wider">{issue.issue_type}</span>
                              <h4 className="font-bold text-gray-900">{issue.original_text}</h4>
                            </div>
                            <p className="text-sm text-gray-500 leading-relaxed mb-4">{issue.reason}</p>
                            <div className="bg-indigo-50/50 rounded-2xl p-4 border border-indigo-100/50">
                              <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <Sparkles size={12} /> AI 추천 대체 문구
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {issue.recommended_phrases.map((p, idx) => (
                                  <div key={idx} className="text-xs bg-white border border-indigo-100 px-3 py-1.5 rounded-xl text-indigo-700 font-bold shadow-sm">
                                    {p}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </BentoCard>

                  {/* Report Footer / Disclaimer */}
                  <div className="bg-gray-900 text-white p-10 rounded-[3rem] shadow-2xl relative overflow-hidden">
                    <div className="absolute bottom-0 right-0 w-48 h-48 bg-indigo-500/20 blur-[60px] rounded-full -mb-20 -mr-20" />
                    <div className="relative flex flex-col md:flex-row items-center justify-between gap-8">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-4">
                          <ShieldCheck size={24} className="text-indigo-400" />
                          <h4 className="text-lg font-bold">AdSafe AI Verification</h4>
                        </div>
                        <p className="text-sm text-gray-400 leading-relaxed max-w-md">
                          본 리포트는 AdSafe AI 엔진에 의해 생성되었습니다. 최종 광고물 게재 여부는 반드시 내부 준법감시 부서의 최종 승인을 거쳐야 합니다.
                        </p>
                      </div>
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-20 h-20 rounded-full border-4 border-indigo-500/30 flex items-center justify-center">
                          <div className="w-14 h-14 rounded-full bg-indigo-500 flex items-center justify-center font-black text-xs">CERT</div>
                        </div>
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">AI Verified</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Tooltip */}
      <AnimatePresence>
        {tooltipData && (
          <RecommendationTooltip 
            phrases={tooltipData.phrases}
            position={tooltipData.position}
            onApply={applyRecommendation}
            onClose={() => setTooltipData(null)}
          />
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] bg-gray-900 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-sm font-medium"
          >
            <CheckCircle2 size={18} className="text-emerald-400" />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background Decoration */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-100/50 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-100/50 blur-[120px] rounded-full" />
      </div>
      </div>
    </ErrorBoundary>
  );
}
