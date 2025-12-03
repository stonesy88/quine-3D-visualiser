import React, { useState, useEffect, useRef } from 'react';
import { GraphScene } from './components/GraphScene';
import { UIOverlay } from './components/UIOverlay';
import { LiveClient } from './services/liveClient';
import { executeQuineQuery, parseQuineResult } from './services/quineService';
import { ControlState, GraphData } from './types';

// Helper to generate initial random graph data for demo purposes
const generateDemoGraph = (count: number): GraphData => {
  const nodes = [];
  const links = [];
  for (let i = 0; i < count; i++) {
    nodes.push({
      id: `node-${i}`,
      x: (Math.random() - 0.5) * 20,
      y: (Math.random() - 0.5) * 20,
      z: (Math.random() - 0.5) * 20,
      val: Math.random() * 2 + 0.5,
      group: Math.floor(Math.random() * 3),
    });
  }
  for (let i = 0; i < count; i++) {
    const target = Math.floor(Math.random() * count);
    if (target !== i) {
      links.push({
        source: `node-${i}`,
        target: `node-${target}`,
      });
    }
  }
  return { nodes, links };
};

const INITIAL_QUERY = `MATCH (n) 
OPTIONAL MATCH (n)-[r]->(m) 
RETURN n AS node, r AS relationship, m AS connected_node, type(r) AS relationship_type 
ORDER BY labels(n), relationship_type 
LIMIT 200`;

const App: React.FC = () => {
  const [controlState, setControlState] = useState<ControlState>({ expansion: 0.1, tension: 0.0 });
  const [particleColor, setParticleColor] = useState('#38bdf8');
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  
  // Graph Data State
  const [graphData, setGraphData] = useState<GraphData>(() => generateDemoGraph(100));
  const [quineUrl, setQuineUrl] = useState('http://localhost:8082');
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const liveClientRef = useRef<LiveClient | null>(null);

  // Auto-clear error after 8 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (!hasStarted) return;

    // Initialize Live Client only after user interaction
    const client = new LiveClient((newState) => {
      setControlState(prev => ({
        expansion: prev.expansion + (newState.expansion - prev.expansion) * 0.5,
        tension: prev.tension + (newState.tension - prev.tension) * 0.5
      }));
    });

    liveClientRef.current = client;

    if (videoRef.current) {
      client.connect(videoRef.current)
        .then(() => setIsLiveConnected(true))
        .catch(e => {
          console.error("Connection failed", e);
          setError("Failed to connect to Gemini Live. Check your Network or API Key.");
        });
    }

    // Auto-load graph data from Quine
    handleExecuteQuery(quineUrl, INITIAL_QUERY, {});

    return () => {
      client.disconnect();
      setIsLiveConnected(false);
    };
  }, [hasStarted]);

  const handleStart = () => {
    setHasStarted(true);
  };

  const handleExecuteQuery = async (url: string, query: string, params?: Record<string, any>) => {
    setError(null); // Clear previous errors
    try {
      const result = await executeQuineQuery(url, query, params);
      const newData = parseQuineResult(result);
      
      if (newData.nodes.length === 0) {
        console.warn("Query executed but returned no nodes.");
        setError("Query returned 0 nodes. Check if your graph is empty or the query logic.");
      } else {
        setGraphData(newData);
      }
    } catch (error) {
      console.error("Failed to execute query:", error);
      setError(error instanceof Error ? error.message : 'Unknown query error');
    }
  };

  return (
    <div className="relative w-full h-screen bg-slate-900 overflow-hidden">
      {/* Hidden Video Element for Gemini Vision */}
      <video 
        ref={videoRef} 
        className="absolute bottom-0 right-0 w-64 opacity-0 pointer-events-none z-0" 
        playsInline 
        muted 
      />

      {/* 3D Scene */}
      <div className="absolute inset-0 z-0">
        <GraphScene 
          controlState={controlState} 
          particleColor={particleColor} 
          graphData={graphData}
        />
      </div>

      {/* Start Screen Overlay */}
      {!hasStarted && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-sm">
          <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl border border-quine-accent/20 text-center max-w-md">
            <h1 className="text-3xl font-bold text-white mb-2">Quine 3D Graph</h1>
            <p className="text-slate-400 mb-6">
              Interactive visualization controlled by Gemini Live.
            </p>
            <div className="bg-slate-950 p-4 rounded-lg mb-6 text-left text-sm text-slate-500">
               <p className="mb-2"><strong>Instructions:</strong></p>
               <ul className="list-disc list-inside space-y-1">
                 <li>Enable Camera & Microphone when prompted.</li>
                 <li><strong>Move hands apart</strong> to expand the graph.</li>
                 <li><strong>Clench fists</strong> to increase tension/pulse.</li>
                 <li>Configure <strong>Quine URL</strong> to visualize real data.</li>
               </ul>
            </div>
            <button 
              onClick={handleStart}
              className="px-8 py-3 bg-quine-accent text-slate-900 font-bold rounded-full hover:bg-white transition-colors shadow-[0_0_20px_rgba(56,189,248,0.3)]"
            >
              Start Experience
            </button>
            {!process.env.API_KEY && (
              <p className="text-red-500 text-xs mt-4">
                API Key missing. Controls will not work.
              </p>
            )}
          </div>
        </div>
      )}

      {/* UI Overlay */}
      {hasStarted && (
        <div className="absolute inset-0 z-10 pointer-events-none">
          <UIOverlay 
            onColorChange={setParticleColor} 
            currentColor={particleColor}
            gestureStatus={{ ...controlState, active: isLiveConnected }}
            onExecuteQuery={handleExecuteQuery}
            quineUrl={quineUrl}
            setQuineUrl={setQuineUrl}
            error={error}
          />
        </div>
      )}
    </div>
  );
};

export default App;