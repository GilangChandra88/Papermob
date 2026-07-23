import React, { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getProjectById, updateProjectData } from '../utils/firebaseUtils'
import { ArrowLeft, Play, Square, Pencil, Check } from 'lucide-react'
import { getColName } from '../store/projectStore'

const PatternThumbnail = ({ pattern, width, height }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    const cellSize = 4; // Mini size for thumbnail
    canvas.width = width * cellSize;
    canvas.height = height * cellSize;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    for (let c = 1; c <= width; c++) {
      for (let r = 1; r <= height; r++) {
        const coord = `${getColName(c)}${r}`;
        const cellData = pattern.grid?.[coord];
        
        if (cellData) {
          ctx.fillStyle = cellData.color;
          ctx.fillRect((c - 1) * cellSize, (r - 1) * cellSize, cellSize, cellSize);
        }
      }
    }
  }, [pattern, width, height]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#e2e8f0', padding: '4px', borderRadius: '4px', width: '100%', overflow: 'hidden' }}>
      <canvas ref={canvasRef} style={{ display: 'block', backgroundColor: 'white', border: '1px solid #cbd5e1', maxWidth: '100%', height: 'auto', objectFit: 'contain' }} />
    </div>
  );
}

export default function Simulation() {
  const { id } = useParams()
  const navigate = useNavigate()
  
  const [loading, setLoading] = useState(true)
  const [projectData, setProjectData] = useState(null)
  const [patterns, setPatterns] = useState([])
  
  const [activePatternIndex, setActivePatternIndex] = useState(0)
  
  // Renaming State
  const [editingPatternId, setEditingPatternId] = useState(null)
  const [editingPatternName, setEditingPatternName] = useState('')
  
  // Settings
  const [stepDelay, setStepDelay] = useState(2000)
  const [patternDelay, setPatternDelay] = useState(3000)

  // Drone Camera Settings
  const [cameraMode, setCameraMode] = useState(false)
  const [paperShape, setPaperShape] = useState('kotak')
  const [simulateHeight, setSimulateHeight] = useState(false)
  const [camRotX, setCamRotX] = useState(0)
  const [camRotZ, setCamRotZ] = useState(0)
  const [camPanX, setCamPanX] = useState(0)
  const [camPanY, setCamPanY] = useState(0)
  const [zoomLevel, setZoomLevel] = useState(1)

  // Simulation State
  const [isSimulating, setIsSimulating] = useState(false)
  const [simPhase, setSimPhase] = useState('idle') // 'idle' | 'flipping' | 'waiting'
  const [simStep, setSimStep] = useState(0)
  
  const canvasRef = useRef(null)
  const animationsRef = useRef(new Map())
  const animFrameRef = useRef(null)

  useEffect(() => {
    loadProject()
  }, [id])

  const loadProject = async () => {
    try {
      const data = await getProjectById(id)
      setProjectData(data)
      let loadedPatterns = [];
      if (data.patternsMap && data.patternOrder) {
        loadedPatterns = data.patternOrder.map(pid => data.patternsMap[pid]).filter(Boolean);
      } else if (data.patterns && data.patterns.length > 0) {
        loadedPatterns = data.patterns;
      }
      setPatterns(loadedPatterns)
      if (data.stepDelay) setStepDelay(data.stepDelay);
      if (data.patternDelay) setPatternDelay(data.patternDelay);
      if (data.cameraMode !== undefined) setCameraMode(data.cameraMode);
      if (data.paperShape !== undefined) setPaperShape(data.paperShape);
      if (data.simulateHeight !== undefined) setSimulateHeight(data.simulateHeight);
      if (data.camRotX !== undefined) setCamRotX(data.camRotX);
      if (data.camRotZ !== undefined) setCamRotZ(data.camRotZ);
      if (data.camPanX !== undefined) setCamPanX(data.camPanX);
      if (data.camPanY !== undefined) setCamPanY(data.camPanY);
      if (data.zoomLevel !== undefined) setZoomLevel(data.zoomLevel);
    } catch (e) {
      console.error(e)
      alert("Gagal memuat projek")
      navigate('/dashboard')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveSettings = async (overrides = {}) => {
    if (projectData?.id) {
      try {
        await updateProjectData(projectData.id, {
          stepDelay,
          patternDelay,
          cameraMode,
          paperShape,
          simulateHeight,
          camRotX,
          camRotZ,
          camPanX,
          camPanY,
          zoomLevel,
          ...overrides
        });
      } catch (e) {
        console.error("Failed to save settings", e);
      }
    }
  };

  useEffect(() => {
    if (!cameraMode) return;
    
    const handleKeyDown = (e) => {
      // WASD for panning
      if (e.key === 'w' || e.key === 'W') setCamPanY(y => y + 20);
      if (e.key === 's' || e.key === 'S') setCamPanY(y => y - 20);
      if (e.key === 'a' || e.key === 'A') setCamPanX(x => x + 20);
      if (e.key === 'd' || e.key === 'D') setCamPanX(x => x - 20);
      
      // QE for yaw (camRotZ)
      if (e.key === 'q' || e.key === 'Q') setCamRotZ(z => z - 5);
      if (e.key === 'e' || e.key === 'E') setCamRotZ(z => z + 5);
      
      // Space/Ctrl for Zoom (Space = Naik/Zoom out, Ctrl = Turun/Zoom in)
      if (e.key === ' ') {
        e.preventDefault();
        setZoomLevel(z => Math.max(z - 0.1, 0.2));
      }
      if (e.key === 'Control') setZoomLevel(z => Math.min(z + 0.1, 5));
      
      // Up/Down for tilt (camRotX)
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setCamRotX(x => Math.min(x + 5, 80));
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setCamRotX(x => Math.max(x - 5, 0));
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cameraMode]);

  const handleSavePatternName = async (patternId) => {
    if (!editingPatternName.trim()) return;
    
    const newPatterns = patterns.map(p => {
      if (p.id === patternId) {
        return { ...p, name: editingPatternName }
      }
      return p;
    });
    
    setPatterns(newPatterns);
    setEditingPatternId(null);
    
    try {
      if (projectData.patternsMap) {
        await updateProjectData(id, { [`patternsMap.${patternId}.name`]: editingPatternName });
      } else {
        await updateProjectData(id, { patterns: newPatterns });
      }
    } catch (e) {
      console.error("Gagal menyimpan nama pola:", e);
      alert("Gagal menyimpan nama pola ke database.");
    }
  }

  const CELL_SIZE = 30;
  const GAP = 2;
  const HEADER_COL_W = 40;
  const HEADER_ROW_H = 30;

  const canvasWidth = projectData ? HEADER_COL_W + GAP + (projectData.width * (CELL_SIZE + GAP)) : 0;
  const canvasHeight = projectData ? HEADER_ROW_H + GAP + (projectData.height * (CELL_SIZE + GAP)) : 0;

  const getCellRect = (c, r) => {
    const x = HEADER_COL_W + GAP + (c - 1) * (CELL_SIZE + GAP);
    const y = HEADER_ROW_H + GAP + (r - 1) * (CELL_SIZE + GAP);
    return { x, y, w: CELL_SIZE, h: CELL_SIZE };
  }

  // --- State Machine Logic ---
  useEffect(() => {
    let timer;
    if (!isSimulating || !projectData) return;

    if (simPhase === 'flipping') {
      if (simStep <= projectData.transitionSteps) {
        timer = setTimeout(() => {
          setSimStep(s => s + 1);
        }, stepDelay);
      } else {
        // Finished flipping the current pattern
        setSimPhase('waiting');
      }
    } else if (simPhase === 'waiting') {
      timer = setTimeout(() => {
        if (activePatternIndex < patterns.length - 1) {
          // Move to next pattern
          setActivePatternIndex(i => i + 1);
          setSimStep(0);
          setSimPhase('flipping');
        } else {
          // Finished all patterns
          setIsSimulating(false);
          setSimPhase('idle');
          setSimStep(0);
        }
      }, patternDelay);
    }
    
    return () => clearTimeout(timer);
  }, [isSimulating, simPhase, simStep, activePatternIndex, patterns.length, projectData, stepDelay, patternDelay]);

  // Populate animations when simStep or activePatternIndex changes
  useEffect(() => {
    if (!projectData) return;
    
    const pattern = patterns[activePatternIndex];
    if (!pattern) return;

    const previousPattern = activePatternIndex === 0 ? null : patterns[activePatternIndex - 1];

    if (!isSimulating || simStep === 0) {
      animationsRef.current.clear();
    } else if (isSimulating && simPhase === 'flipping' && simStep > 0 && simStep <= projectData.transitionSteps) {
      const now = Date.now();
      for (let c = 1; c <= projectData.width; c++) {
        for (let r = 1; r <= projectData.height; r++) {
          const coord = `${getColName(c)}${r}`;
          const step = pattern.transitions?.[coord]?.step || 1;
          
          if (step === simStep) {
            const fromData = previousPattern ? previousPattern.grid?.[coord] : null;
            const toData = pattern.grid?.[coord];
            
            let isIdentical = false;
            if (fromData && toData) {
              isIdentical = fromData.color === toData.color && fromData.pos === toData.pos;
            } else if (!fromData && !toData) {
              isIdentical = true;
            }

            if (!isIdentical) {
              animationsRef.current.set(coord, {
                startT: now,
                delay: Math.random() * 400,
                fromData,
                toData
              });
            }
          }
        }
      }
    }
  }, [simStep, isSimulating, activePatternIndex, patterns, projectData, simPhase]);

  // Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !projectData) return;
    const ctx = canvas.getContext('2d');

    const render = () => {
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);

      // Draw Top-Left empty header
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, HEADER_COL_W, HEADER_ROW_H);

      // Draw Column Headers
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let c = 1; c <= projectData.width; c++) {
        const colName = getColName(c);
        const rect = getCellRect(c, 1);
        ctx.fillStyle = '#f1f5f9';
        ctx.fillRect(rect.x, 0, rect.w, HEADER_ROW_H);
        ctx.fillStyle = '#1e293b';
        ctx.fillText(colName, rect.x + rect.w/2, HEADER_ROW_H/2);
      }

      // Draw Row Headers
      for (let r = 1; r <= projectData.height; r++) {
        const rect = getCellRect(1, r);
        ctx.fillStyle = '#f1f5f9';
        ctx.fillRect(0, rect.y, HEADER_COL_W, rect.h);
        ctx.fillStyle = '#1e293b';
        ctx.fillText(r.toString(), HEADER_COL_W/2, rect.y + rect.h/2);
      }

      const now = Date.now();
      const pattern = patterns[activePatternIndex];
      const previousPattern = activePatternIndex === 0 ? null : patterns[activePatternIndex - 1];

      for (let c = 1; c <= projectData.width; c++) {
        for (let r = 1; r <= projectData.height; r++) {
          const coord = `${getColName(c)}${r}`;
          const rect = getCellRect(c, r);

          ctx.fillStyle = '#ffffff';
          ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

          const anim = animationsRef.current.get(coord);
          let cellData = null;
          let drawW = rect.w;
          let drawX = rect.x;

          if (anim) {
            const elapsed = now - anim.startT - anim.delay;
            if (elapsed < 0) {
              cellData = anim.fromData;
            } else if (elapsed < 300) {
              const progress = elapsed / 300;
              if (progress < 0.5) {
                cellData = anim.fromData;
                drawW = rect.w * (1 - progress * 2);
              } else {
                cellData = anim.toData;
                drawW = rect.w * ((progress - 0.5) * 2);
              }
              drawX = rect.x + (rect.w - drawW) / 2;
            } else {
              cellData = anim.toData;
            }
          } else {
            if (isSimulating) {
              // During simulation, figure out state based on step
              const step = pattern.transitions?.[coord]?.step || 1;
              if (simPhase === 'waiting' || step <= simStep) {
                cellData = pattern.grid?.[coord];
              } else if (previousPattern) {
                cellData = previousPattern.grid?.[coord];
              }
            } else {
              // Idle view: just show current pattern
              cellData = pattern?.grid?.[coord];
            }
          }

          if (cellData) {
            let cx = drawX + drawW / 2;
            let cy = rect.y + rect.h / 2;
            let size = drawW;
            let isBerdiri = false;
            
            if (simulateHeight && cameraMode) {
              if (cellData.pos === 'J') {
                size = drawW * 0.7;
              } else if (cellData.pos === 'B') {
                size = drawW * 1.15;
                isBerdiri = true;
              }
            }

            const drawShape = (x, y, s, color) => {
              ctx.fillStyle = color;
              ctx.beginPath();
              if (paperShape === 'bulat') {
                ctx.arc(x, y, s/2, 0, Math.PI*2);
              } else if (paperShape === 'segi6') {
                for (let i = 0; i < 6; i++) {
                  ctx.lineTo(x + s/2 * Math.cos(i * Math.PI / 3 + Math.PI/6), y + s/2 * Math.sin(i * Math.PI / 3 + Math.PI/6));
                }
              } else {
                ctx.rect(x - s/2, y - s/2, s, s);
              }
              ctx.fill();
            };

            if (isBerdiri) {
              drawShape(cx + (camRotX > 20 ? 0 : 5), cy + 5, drawW, 'rgba(0,0,0,0.3)');
            }
            
            drawShape(cx, cy, size, cellData.color);

            if (!simulateHeight || !cameraMode) {
               if (cellData.pos === 'J') drawShape(cx, cy, size, 'rgba(0,0,0,0.4)');
            } else if (cellData.pos === 'J') {
               drawShape(cx, cy, size, 'rgba(0,0,0,0.2)');
            }
          }

          ctx.strokeStyle = '#cbd5e1';
          ctx.lineWidth = 1;
          ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
        }
      }

      if (isSimulating) {
        animFrameRef.current = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    }
  }, [projectData, patterns, activePatternIndex, isSimulating, simStep, simPhase, canvasWidth, canvasHeight, cameraMode, paperShape, simulateHeight, camRotX]);

  const toggleSimulation = () => {
    if (isSimulating) {
      setIsSimulating(false);
      setSimPhase('idle');
      setSimStep(0);
    } else {
      setIsSimulating(true);
      setSimPhase('flipping');
      setSimStep(0);
    }
  }

  if (loading || !projectData) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: 'var(--bg-color)' }}>
        <p>Loading Simulation...</p>
      </div>
    )
  }

  // Calculate zoom to fit window
  const availableWidth = window.innerWidth - 300 - 40; // 300px sidebar, 40px padding
  const availableHeight = window.innerHeight - 150 - 40; // 150px header, 40px padding
  const fitZoom = Math.min(availableWidth / canvasWidth, availableHeight / canvasHeight, 1);
  const finalZoom = Math.max(fitZoom, 0.1);

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', backgroundColor: 'var(--bg-color)', overflow: 'hidden' }}>
      
      {/* Left Sidebar - Pattern List */}
      <div style={{ width: '300px', backgroundColor: 'var(--surface)', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button onClick={() => navigate(`/project/${id}`)} className="btn btn-outline" style={{ padding: '0.5rem' }}>
            <ArrowLeft size={18} />
          </button>
          <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Daftar Pola</h2>
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {patterns.map((p, idx) => (
            <div 
              key={p.id}
              onClick={() => {
                if (!isSimulating) {
                  setActivePatternIndex(idx)
                  setSimStep(0)
                  setSimPhase('idle')
                }
              }}
              style={{
                padding: '0.75rem',
                backgroundColor: activePatternIndex === idx ? 'var(--primary)' : 'var(--bg-color)',
                color: activePatternIndex === idx ? 'white' : 'var(--text-main)',
                borderRadius: 'var(--radius-md)',
                cursor: isSimulating ? 'not-allowed' : 'pointer',
                border: `1px solid ${activePatternIndex === idx ? 'var(--primary)' : 'var(--border-color)'}`,
                transition: 'all 0.2s',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                {editingPatternId === p.id ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', width: '100%' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{idx + 1}.</span>
                    <input
                      type="text"
                      value={editingPatternName}
                      onChange={(e) => setEditingPatternName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSavePatternName(p.id)
                        if (e.key === 'Escape') setEditingPatternId(null)
                      }}
                      autoFocus
                      style={{ flex: 1, padding: '2px 4px', fontSize: '0.875rem', borderRadius: '4px', border: '1px solid var(--border-color)', color: 'black' }}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleSavePatternName(p.id); }}
                      style={{ padding: '4px', backgroundColor: 'var(--success)', color: 'white', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Check size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div style={{ fontWeight: activePatternIndex === idx ? 600 : 500, fontSize: '0.875rem' }}>
                      {idx + 1}. {p.name.replace(/^Pola \d+(\s*-\s*)?/i, '')}
                    </div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isSimulating) {
                          setEditingPatternId(p.id);
                          setEditingPatternName(p.name.replace(/^Pola \d+(\s*-\s*)?/i, ''));
                        }
                      }}
                      style={{ 
                        padding: '4px', 
                        opacity: isSimulating ? 0 : 0.7,
                        cursor: isSimulating ? 'not-allowed' : 'pointer',
                        color: 'inherit'
                      }}
                      title="Ganti Nama"
                    >
                      <Pencil size={14} />
                    </button>
                  </>
                )}
              </div>
              <PatternThumbnail pattern={p} width={projectData.width} height={projectData.height} />
            </div>
          ))}
        </div>
      </div>

      {/* Main Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        
        {/* Header - Controls */}
        <div style={{ padding: '1rem 2rem', backgroundColor: 'var(--surface)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <div>
              <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Jeda Per Step (ms)</p>
              <input 
                type="number" 
                value={stepDelay} 
                onChange={e => setStepDelay(Number(e.target.value))}
                onBlur={() => handleSaveSettings()}
                disabled={isSimulating}
                style={{ width: '100px', padding: '0.4rem' }}
              />
            </div>
            <div>
              <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Jeda Antar Pola (ms)</p>
              <input 
                type="number" 
                value={patternDelay} 
                onChange={e => setPatternDelay(Number(e.target.value))}
                onBlur={() => handleSaveSettings()}
                disabled={isSimulating}
                style={{ width: '100px', padding: '0.4rem' }}
              />
            </div>

            <div style={{ height: '30px', width: '1px', backgroundColor: 'var(--border-color)' }}></div>
            
            <div>
              <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Bentuk</p>
              <select 
                value={paperShape}
                onChange={e => { setPaperShape(e.target.value); handleSaveSettings({ paperShape: e.target.value }); }}
                style={{ padding: '0.4rem' }}
              >
                <option value="kotak">Kotak</option>
                <option value="bulat">Bulat</option>
                <option value="segi6">Segi Enam</option>
              </select>
            </div>
            
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500 }}>
              <input 
                type="checkbox" 
                checked={simulateHeight} 
                onChange={e => { setSimulateHeight(e.target.checked); handleSaveSettings({ simulateHeight: e.target.checked }); }} 
              />
              Efek Ketinggian
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500, padding: '0.4rem 0.75rem', backgroundColor: cameraMode ? 'var(--primary)' : 'var(--bg-color)', color: cameraMode ? 'white' : 'var(--text-main)', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
              <input 
                type="checkbox" 
                checked={cameraMode} 
                onChange={e => { setCameraMode(e.target.checked); handleSaveSettings({ cameraMode: e.target.checked }); }}
                style={{ display: 'none' }}
              />
              🚁 Kamera Drone
            </label>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {isSimulating && (
              <div style={{
                background: 'var(--primary)',
                color: 'white',
                padding: '0.5rem 1rem',
                borderRadius: '9999px',
                fontSize: '1rem',
                fontWeight: 600,
                boxShadow: 'var(--shadow-md)',
                animation: 'pulse 2s infinite'
              }}>
                {simPhase === 'waiting' 
                  ? `Selesai! Menunggu Pola ${activePatternIndex + 2}...`
                  : `Operator: ${simStep === 0 ? `Siap POLA ${activePatternIndex + 1}!` : `Aba-aba ${simStep}!`}`
                }
              </div>
            )}
            
            <button 
              className={`btn ${isSimulating ? 'btn-outline' : 'btn-primary'}`}
              style={{ padding: '0.6rem 1.5rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              onClick={toggleSimulation}
            >
              {isSimulating ? (
                <><Square size={20} fill="currentColor" /> Stop Simulasi</>
              ) : (
                <><Play size={20} fill="currentColor" /> Mulai Simulasi</>
              )}
            </button>
          </div>
        </div>

        {/* Canvas Area */}
        <div style={{ flex: 1, padding: '2rem', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', perspective: '1500px' }}>
          <div style={{ 
            width: canvasWidth, 
            height: canvasHeight, 
            transform: cameraMode 
              ? `translate(${camPanX}px, ${camPanY}px) scale(${finalZoom * zoomLevel}) rotateX(${camRotX}deg) rotateZ(${camRotZ}deg)`
              : `scale(${finalZoom * zoomLevel})`,
            transformStyle: 'preserve-3d',
            transformOrigin: 'center center',
            transition: 'transform 0.1s ease-out',
            boxShadow: 'var(--shadow-lg)',
            backgroundColor: 'white'
          }}>
            <canvas 
              ref={canvasRef}
              width={canvasWidth}
              height={canvasHeight}
              style={{ display: 'block' }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
