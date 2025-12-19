
import React, { useState, useEffect, useRef } from 'react';
import { gemini } from './services/geminiService';
import { DoodleEntry, DoodleStyle } from './types';
import { Mic, Square, Trash2, Download, BookOpen, Clock, Loader2, Sparkles, Type, Sliders, Palette, FileArchive } from 'lucide-react';
import JSZip from 'jszip';

const App: React.FC = () => {
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [currentDoodle, setCurrentDoodle] = useState<DoodleEntry | null>(null);
  const [history, setHistory] = useState<DoodleEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Customization state
  const [style, setStyle] = useState<DoodleStyle>({
    thickness: 'Medium',
    color: 'Black',
    artStyle: 'Minimalist'
  });

  const voiceSessionRef = useRef<{ stop: () => Promise<string> } | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('doodle_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load history", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('doodle_history', JSON.stringify(history));
  }, [history]);

  const handleStartRecording = async () => {
    try {
      setError(null);
      setIsRecording(true);
      const session = await gemini.connectVoice({
        onTranscription: (text) => setTranscript(text),
        onError: (err) => {
          console.error(err);
          setError("Voice connection error. Please check your microphone.");
          setIsRecording(false);
        },
        onClose: () => setIsRecording(false)
      });
      voiceSessionRef.current = session;
    } catch (err) {
      setError("Failed to start voice session. Please ensure microphone permissions are granted.");
      setIsRecording(false);
    }
  };

  const handleStopRecording = async () => {
    if (voiceSessionRef.current) {
      const finalTranscript = await voiceSessionRef.current.stop();
      setTranscript(finalTranscript);
      setIsRecording(false);
      voiceSessionRef.current = null;
    }
  };

  const handleGenerateDoodle = async () => {
    if (!transcript.trim()) return;

    setIsGenerating(true);
    setError(null);
    try {
      const visualPrompt = await gemini.generateVisualPrompt(transcript, style);
      const imageUrl = await gemini.generateDoodle(visualPrompt);
      
      const newEntry: DoodleEntry = {
        id: Date.now().toString(),
        date: new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
        transcript,
        imageUrl,
        prompt: visualPrompt,
        style: { ...style }
      };

      setCurrentDoodle(newEntry);
      setHistory(prev => [newEntry, ...prev]);
      setTranscript('');
    } catch (err) {
      console.error(err);
      setError("Failed to generate doodle. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportArchive = async () => {
    if (history.length === 0) return;
    
    setIsExporting(true);
    setError(null);
    try {
      const zip = new JSZip();
      const imagesFolder = zip.folder("doodles");
      const transcriptsFolder = zip.folder("transcripts");
      
      const metadata: any[] = [];

      for (const entry of history) {
        // Prepare file names
        const fileNameBase = `doodle-${entry.id}`;
        
        // Add transcript
        transcriptsFolder?.file(`${fileNameBase}.txt`, entry.transcript);
        
        // Convert base64 to blob and add image
        const base64Data = entry.imageUrl.split(',')[1];
        if (base64Data) {
          imagesFolder?.file(`${fileNameBase}.png`, base64Data, { base64: true });
        }

        metadata.push({
          id: entry.id,
          date: entry.date,
          style: entry.style,
          prompt: entry.prompt
        });
      }

      zip.file("index.json", JSON.stringify({ entries: metadata, exportedAt: new Date().toISOString() }, null, 2));

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `DoodleDiary-Archive-${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (err) {
      console.error("Export failed:", err);
      setError("Failed to create archive. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const deleteEntry = (id: string) => {
    setHistory(prev => prev.filter(e => e.id !== id));
    if (currentDoodle?.id === id) setCurrentDoodle(null);
  };

  const getColorHex = (colorName: string) => {
    const map: Record<string, string> = {
      'Black': '#000000',
      'Ink Blue': '#003366',
      'Deep Red': '#8b0000',
      'Forest Green': '#228b22',
      'Golden': '#d4af37',
      'Ocean Blue': '#0077be',
      'Sunset Orange': '#fd5e53',
      'Emerald Green': '#50c878',
      'Royal Purple': '#7851a9'
    };
    return map[colorName] || '#000000';
  };

  return (
    <div className="min-h-screen max-w-6xl mx-auto px-4 py-8 md:py-12">
      <header className="text-center mb-12 space-y-2">
        <h1 className="text-5xl md:text-6xl font-bold text-gray-800 tracking-tight flex items-center justify-center gap-3">
          <BookOpen className="w-10 h-10 text-amber-500" />
          <span className="handdrawn">DoodleDiary</span>
        </h1>
        <p className="text-gray-500 text-lg">Talk or type—watch your day become art.</p>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Input & Settings */}
        <section className="lg:col-span-7 space-y-6">
          <div className="bg-white rounded-3xl shadow-xl p-6 border border-amber-100 relative overflow-hidden">
            <div className="flex items-center justify-between mb-4 border-b border-gray-50 pb-4">
              <div className="flex items-center gap-2">
                <Type className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-semibold text-gray-400 uppercase tracking-widest">Journal Entry</span>
              </div>
              {isRecording && (
                <div className="flex items-center gap-2 text-red-500 animate-pulse">
                  <div className="w-2 h-2 bg-red-500 rounded-full" />
                  <span className="text-xs font-bold uppercase">Recording...</span>
                </div>
              )}
            </div>
            
            <textarea
              className="w-full h-48 md:h-64 resize-none border-none focus:ring-0 text-xl leading-relaxed text-gray-700 placeholder-gray-300 bg-transparent handdrawn"
              placeholder="Start typing your story here, or use the mic to speak..."
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
            />

            <div className="flex flex-wrap items-center justify-between mt-4 gap-4">
              <div className="flex gap-2">
                {!isRecording ? (
                  <button
                    onClick={handleStartRecording}
                    className="flex items-center gap-2 px-5 py-3 bg-amber-50 text-amber-700 rounded-full font-semibold hover:bg-amber-100 transition-colors"
                  >
                    <Mic className="w-5 h-5" />
                    <span>Voice Input</span>
                  </button>
                ) : (
                  <button
                    onClick={handleStopRecording}
                    className="flex items-center gap-2 px-5 py-3 bg-red-50 text-red-600 rounded-full font-semibold hover:bg-red-100 transition-colors"
                  >
                    <Square className="w-5 h-5" />
                    <span>Stop Voice</span>
                  </button>
                )}
              </div>

              <button
                disabled={!transcript.trim() || isGenerating}
                onClick={handleGenerateDoodle}
                className="flex items-center gap-2 px-8 py-3 bg-gray-900 text-white rounded-full font-bold hover:bg-black transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl active:scale-95"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 text-amber-300" />
                    <span>Sketch My Day</span>
                  </>
                )}
              </button>
            </div>
            
            {error && (
              <p className="mt-4 text-red-500 text-sm font-medium bg-red-50 p-3 rounded-xl border border-red-100 animate-in slide-in-from-top-2">
                {error}
              </p>
            )}
          </div>

          {/* Customization Controls */}
          <div className="bg-white rounded-3xl shadow-lg p-6 border border-gray-100 space-y-6">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <Sliders className="w-4 h-4" />
              Doodle Customization
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Thickness */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-gray-500">LINE WEIGHT</label>
                <div className="flex gap-2">
                  {(['Fine', 'Medium', 'Bold'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setStyle({ ...style, thickness: t })}
                      className={`flex-1 py-2 text-xs rounded-lg border transition-all ${
                        style.thickness === t ? 'bg-amber-500 text-white border-amber-600 font-bold' : 'bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-100'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Art Style */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-gray-500">ARTISTIC VIBE</label>
                <select
                  value={style.artStyle}
                  onChange={(e) => setStyle({ ...style, artStyle: e.target.value as any })}
                  className="w-full p-2 text-xs rounded-lg border bg-gray-50 border-gray-100 text-gray-600 focus:ring-amber-500"
                >
                  <option value="Minimalist">Minimalist Line</option>
                  <option value="Crayon">Crayon Sketch</option>
                  <option value="Felt Tip">Felt Tip Pen</option>
                  <option value="Charcoal">Charcoal</option>
                  <option value="Abstract">Abstract Shapes</option>
                </select>
              </div>

              {/* Color */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-gray-500 flex items-center gap-1">
                  <Palette className="w-3 h-3" /> ACCENT COLOR
                </label>
                <div className="flex flex-wrap gap-2">
                  {['Black', 'Ink Blue', 'Deep Red', 'Forest Green', 'Golden', 'Ocean Blue', 'Sunset Orange', 'Emerald Green', 'Royal Purple'].map(c => (
                    <button
                      key={c}
                      onClick={() => setStyle({ ...style, color: c })}
                      title={c}
                      className={`w-6 h-6 rounded-full border-2 transition-all ${
                        style.color === c ? 'ring-2 ring-amber-400 scale-125' : 'border-gray-100'
                      }`}
                      style={{ backgroundColor: getColorHex(c) }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Output & Library */}
        <section className="lg:col-span-5 space-y-8">
          <div className="sticky top-8">
            {currentDoodle ? (
              <div className="bg-white rounded-3xl shadow-2xl p-6 border border-gray-100 animate-in fade-in zoom-in duration-500">
                <div className="aspect-square bg-white rounded-2xl border-4 border-gray-50 flex items-center justify-center overflow-hidden mb-6 group relative">
                  <img
                    src={currentDoodle.imageUrl}
                    alt="Daily Doodle"
                    className="w-full h-full object-contain"
                  />
                  <a
                    href={currentDoodle.imageUrl}
                    download={`doodle-${currentDoodle.id}.png`}
                    className="absolute bottom-4 right-4 p-3 bg-white/90 backdrop-blur rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
                  >
                    <Download className="w-5 h-5 text-gray-700" />
                  </a>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold text-amber-500 uppercase tracking-tighter">{currentDoodle.date}</span>
                    <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded text-gray-500">{currentDoodle.style.artStyle}</span>
                  </div>
                  <p className="text-gray-600 text-sm italic line-clamp-3">"{currentDoodle.transcript}"</p>
                </div>
              </div>
            ) : (
              <div className="h-[400px] border-4 border-dashed border-gray-100 rounded-3xl flex flex-col items-center justify-center text-gray-300 p-8 text-center space-y-4">
                <Sparkles className="w-16 h-16 opacity-20" />
                <p className="handdrawn text-2xl">Your canvas is waiting...</p>
                <p className="text-sm max-w-[200px]">Type or talk about your day to see the magic happen.</p>
              </div>
            )}

            <div className="mt-8">
              <div className="flex items-center justify-between mb-4 px-2">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-gray-400" />
                  History
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-normal text-gray-400 mr-2">{history.length} entries</span>
                  {history.length > 0 && (
                    <button
                      onClick={handleExportArchive}
                      disabled={isExporting}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-200 transition-colors disabled:opacity-50"
                      title="Export all as ZIP"
                    >
                      {isExporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileArchive className="w-3 h-3" />}
                      Archive
                    </button>
                  )}
                </div>
              </div>
              <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                {history.length === 0 ? (
                  <div className="text-center py-10 opacity-40">
                    <BookOpen className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-sm italic">Journal is empty.</p>
                  </div>
                ) : (
                  history.map(entry => (
                    <HistoryRow 
                      key={entry.id} 
                      entry={entry} 
                      isActive={currentDoodle?.id === entry.id}
                      onClick={() => setCurrentDoodle(entry)} 
                      onDelete={() => deleteEntry(entry.id)} 
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="mt-20 text-center pb-8 border-t border-gray-100 pt-8">
        <p className="text-gray-400 text-sm flex items-center justify-center gap-1">
          Handcrafted with <Sparkles className="w-4 h-4 text-amber-400" /> by DoodleDiary
        </p>
      </footer>
    </div>
  );
};

interface HistoryRowProps {
  entry: DoodleEntry;
  isActive: boolean;
  onClick: () => void;
  onDelete: () => void;
}

const HistoryRow: React.FC<HistoryRowProps> = ({ entry, isActive, onClick, onDelete }) => (
  <div 
    onClick={onClick}
    className={`group flex items-center gap-4 p-3 rounded-2xl cursor-pointer transition-all ${
      isActive ? 'bg-amber-50 border-amber-200' : 'hover:bg-gray-50 border-transparent'
    } border`}
  >
    <div className="w-14 h-14 bg-white rounded-xl border border-gray-100 flex-shrink-0 overflow-hidden shadow-sm">
      <img src={entry.imageUrl} alt="" className="w-full h-full object-contain" />
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold text-gray-400 uppercase truncate">{entry.date}</p>
        <span className="text-[9px] text-gray-400">{entry.style.artStyle}</span>
      </div>
      <p className="text-gray-600 text-xs truncate handdrawn">{entry.transcript}</p>
    </div>
    <button 
      onClick={(e) => { e.stopPropagation(); onDelete(); }}
      className="p-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  </div>
);

export default App;
