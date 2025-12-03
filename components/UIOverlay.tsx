import React, { useState, useEffect } from 'react';
import { generateCypherQuery } from '../services/geminiService';

interface UIOverlayProps {
  onColorChange: (color: string) => void;
  currentColor: string;
  gestureStatus: { expansion: number; tension: number; active: boolean };
  onExecuteQuery: (url: string, query: string, params?: Record<string, any>) => Promise<void>;
  quineUrl: string;
  setQuineUrl: (url: string) => void;
  error: string | null;
}

const DEFAULT_QUERY = `MATCH (n) 
OPTIONAL MATCH (n)-[r]->(m) 
RETURN n AS node, r AS relationship, m AS connected_node, type(r) AS relationship_type 
ORDER BY labels(n), relationship_type 
LIMIT 200`;

export const UIOverlay: React.FC<UIOverlayProps> = ({ 
  onColorChange, 
  currentColor, 
  gestureStatus,
  onExecuteQuery,
  quineUrl,
  setQuineUrl,
  error
}) => {
  const [cypherQuery, setCypherQuery] = useState<string>(DEFAULT_QUERY);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [apiKeyMissing] = useState(!process.env.API_KEY);

  const handleRuleClick = async (type: 'blocking' | 'address') => {
    if (apiKeyMissing) {
      setCypherQuery("// API Key missing. Cannot generate query.");
      return;
    }
    setLoading(true);
    let prompt = "";
    if (type === 'blocking') {
      prompt = "Find all nodes that share a common IP address and have attempted more than 5 failed logins in the last hour. Return the full paths (nodes and relationships) to visualize the connections.";
    } else {
      prompt = "Find all transactions originating from the same crypto wallet address '0x123abc' within 2 hops, filtering for high value transfers. Return the paths.";
    }

    const query = await generateCypherQuery(prompt);
    setCypherQuery(query);
    setLoading(false);
  };

  const handleExecute = async () => {
    if (!cypherQuery || cypherQuery.startsWith('//')) return;
    setExecuting(true);
    
    // Determine parameters based on query content or defaults
    const params: Record<string, any> = {};
    if (cypherQuery.includes('$lim')) {
      params.lim = 100;
    }

    await onExecuteQuery(quineUrl, cypherQuery, params);
    setExecuting(false);
  };

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6">
      
      {/* Header */}
      <header className="flex justify-between items-start pointer-events-auto">
        <div className="bg-quine-panel/90 backdrop-blur border border-white/10 p-4 rounded-lg shadow-2xl max-w-sm">
          <h1 className="text-xl font-bold text-quine-accent mb-2 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            Quine 3D Visualizer
          </h1>
          <p className="text-xs text-slate-400 mb-4">
            Real-time graph analysis powered by Gemini Live.
            Use hand gestures to control scale (distance) and tension (fist).
          </p>
          
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-mono uppercase text-slate-500">
              <span>Expansion</span>
              <span>{(gestureStatus.expansion * 100).toFixed(0)}%</span>
            </div>
            <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-quine-accent transition-all duration-300 ease-out"
                style={{ width: `${gestureStatus.expansion * 100}%` }}
              />
            </div>

            <div className="flex justify-between text-xs font-mono uppercase text-slate-500 mt-2">
              <span>Tension</span>
              <span>{(gestureStatus.tension * 100).toFixed(0)}%</span>
            </div>
            <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-300 ease-out ${gestureStatus.tension > 0.6 ? 'bg-quine-danger' : 'bg-green-500'}`}
                style={{ width: `${gestureStatus.tension * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Color Picker & Connection Config */}
        <div className="flex flex-col gap-2 pointer-events-auto items-end">
          <div className="bg-quine-panel/90 backdrop-blur border border-white/10 p-4 rounded-lg shadow-xl">
            <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Particle Color</label>
            <div className="flex gap-2">
              {['#38bdf8', '#f43f5e', '#22c55e', '#facc15', '#a855f7'].map(c => (
                <button
                  key={c}
                  onClick={() => onColorChange(c)}
                  className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${currentColor === c ? 'border-white' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="bg-quine-panel/90 backdrop-blur border border-white/10 p-4 rounded-lg shadow-xl w-64">
             <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Quine API URL</label>
             <input 
               type="text" 
               value={quineUrl}
               onChange={(e) => setQuineUrl(e.target.value)}
               className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:border-quine-accent outline-none font-mono"
               placeholder="http://localhost:8082"
             />
          </div>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="pointer-events-auto absolute top-20 left-1/2 -translate-x-1/2 w-full max-w-xl z-50">
           <div className="bg-red-500/90 backdrop-blur border border-red-400 text-white p-4 rounded-lg shadow-xl flex items-center gap-3 animate-bounce-in">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
             </svg>
             <div className="text-sm font-medium">
               {error}
             </div>
           </div>
        </div>
      )}

      {/* Bottom Panel - Quine Integration */}
      <div className="flex justify-center w-full pointer-events-auto">
        <div className="bg-quine-panel/95 backdrop-blur border border-white/10 p-6 rounded-t-2xl shadow-2xl w-full max-w-4xl transform transition-transform duration-500 hover:translate-y-0 translate-y-2">
           <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Quine Query Generator</h2>
              <div className="flex gap-3">
                <button 
                  onClick={() => handleRuleClick('blocking')}
                  className="px-4 py-2 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-quine-danger border border-quine-danger/30 rounded transition-colors"
                >
                  Blocking Rules
                </button>
                <button 
                  onClick={() => handleRuleClick('address')}
                  className="px-4 py-2 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-quine-accent border border-quine-accent/30 rounded transition-colors"
                >
                  Same Address
                </button>
              </div>
           </div>
           
           <div className="flex gap-4 items-stretch">
             <div className="relative group flex-1">
               <div className="absolute -inset-0.5 bg-gradient-to-r from-pink-600 to-purple-600 rounded opacity-20 blur group-hover:opacity-40 transition duration-500"></div>
               <div className="relative bg-slate-950 p-4 rounded font-mono text-xs text-slate-300 overflow-x-auto h-[80px] flex items-center">
                 {loading ? (
                   <span className="animate-pulse text-quine-accent">Generating Cypher query via Gemini...</span>
                 ) : (
                   <pre className="whitespace-pre-wrap">{cypherQuery}</pre>
                 )}
               </div>
             </div>
             
             <button
               disabled={loading || executing || cypherQuery.startsWith('//')}
               onClick={handleExecute}
               className={`w-32 flex items-center justify-center font-bold text-sm rounded border transition-all
                  ${loading || executing || cypherQuery.startsWith('//') 
                    ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed' 
                    : 'bg-quine-accent/20 text-quine-accent border-quine-accent hover:bg-quine-accent hover:text-white shadow-[0_0_15px_rgba(56,189,248,0.3)]'}
               `}
             >
               {executing ? 'Executing...' : 'RUN QUERY'}
             </button>
           </div>
        </div>
      </div>
    </div>
  );
};