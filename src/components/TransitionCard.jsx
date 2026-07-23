import React, { memo, useMemo, useCallback, useRef, useEffect, useState, Fragment } from 'react'
import { useProjectStore, getColName, getColIndex } from '../store/projectStore'
import { Play, Square } from 'lucide-react'

export default memo(function TransitionCard({ pattern, index, projectData }) {
  const { width, height, transitionSteps } = projectData
  const paintCell = useProjectStore(state => state.paintCell)
  const startStroke = useProjectStore(state => state.startStroke)
  const endStroke = useProjectStore(state => state.endStroke)
  const patterns = useProjectStore(state => state.patterns)
  const activePatternId = useProjectStore(state => state.activePatternId)
  const brushSize = useProjectStore(state => state.brushSize)
  const activeTool = useProjectStore(state => state.activeTool)
  const magicSelection = useProjectStore(state => state.magicSelection)
  const selectMagicWand = useProjectStore(state => state.selectMagicWand)
  const setMagicSelection = useProjectStore(state => state.setMagicSelection)
  const magicSelectionTarget = useProjectStore(state => state.magicSelectionTarget)
  const hoveredCoord = useProjectStore(state => state.hoveredCoord)
  const setHoveredCoord = useProjectStore(state => state.setHoveredCoord)
  const setToolState = useProjectStore(state => state.setToolState)
  const zoomLevel = useProjectStore(state => state.zoomLevel)
  
  const baseCanvasRef = useRef(null)
  const hoverCanvasRef = useRef(null)
  const lastHoveredRef = useRef(null)
  const dragStartRef = useRef(null)
  const isDraggingRef = useRef(false)

  const [isSimulating, setIsSimulating] = useState(false)
  const [simStep, setSimStep] = useState(0)
  
  const animationsRef = useRef(new Map())
  const animFrameRef = useRef(null)

  const isActive = activePatternId === pattern.id

  const previousPattern = useMemo(() => {
    if (index === 0) return null;
    return patterns[index - 1];
  }, [patterns, index]);

  const toggleSimulation = useCallback(() => {
    if (isSimulating) {
      setIsSimulating(false);
      setSimStep(0);
    } else {
      setIsSimulating(true);
      setSimStep(0);
    }
  }, [isSimulating]);

  useEffect(() => {
    let timer;
    if (isSimulating) {
      if (simStep <= transitionSteps) {
        timer = setTimeout(() => {
          setSimStep(s => s + 1);
        }, 2000);
      } else {
        // Auto stop after finishing
        timer = setTimeout(() => {
          setIsSimulating(false);
          setSimStep(0);
        }, 2000);
      }
    }
    return () => clearTimeout(timer);
  }, [isSimulating, simStep, transitionSteps]);

  // Populate animations when simStep changes
  useEffect(() => {
    if (!isSimulating || simStep === 0) {
      animationsRef.current.clear();
    } else if (simStep > 0 && simStep <= transitionSteps) {
      const now = Date.now();
      for (let c = 1; c <= width; c++) {
        for (let r = 1; r <= height; r++) {
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
  }, [simStep, isSimulating, width, height, pattern, previousPattern, transitionSteps]);

  const CELL_SIZE = 30;
  const GAP = 2;
  const HEADER_COL_W = 40;
  const HEADER_ROW_H = 30;
  
  const canvasWidth = HEADER_COL_W + GAP + (width * (CELL_SIZE + GAP));
  const canvasHeight = HEADER_ROW_H + GAP + (height * (CELL_SIZE + GAP));

  // Helper to get X and Y for a given col (1-indexed) and row (1-indexed)
  const getCellRect = (c, r) => {
    const x = HEADER_COL_W + GAP + (c - 1) * (CELL_SIZE + GAP);
    const y = HEADER_ROW_H + GAP + (r - 1) * (CELL_SIZE + GAP);
    return { x, y, w: CELL_SIZE, h: CELL_SIZE };
  }

  const getBlueShade = (step) => {
    if (!step) return '#e2e8f0';
    const lightness = 80 - ((step - 1) / (transitionSteps - 1)) * 60;
    return `hsl(210, 80%, ${lightness}%)`;
  }

  // Draw the entire base grid (and animation loop)
  useEffect(() => {
    const canvas = baseCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const render = () => {
      // Clear
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);

      // Draw Top-Left empty header
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, HEADER_COL_W, HEADER_ROW_H);

      // Draw Column Headers
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      for (let c = 1; c <= width; c++) {
        const colName = getColName(c);
        const rect = getCellRect(c, 1);
        
        ctx.fillStyle = '#f1f5f9';
        ctx.fillRect(rect.x, 0, rect.w, HEADER_ROW_H);
        
        ctx.fillStyle = '#1e293b';
        ctx.fillText(colName, rect.x + rect.w/2, HEADER_ROW_H/2);
      }

      // Draw Row Headers
      for (let r = 1; r <= height; r++) {
        const rect = getCellRect(1, r);
        
        ctx.fillStyle = '#f1f5f9';
        ctx.fillRect(0, rect.y, HEADER_COL_W, rect.h);
        
        ctx.fillStyle = '#1e293b';
        ctx.fillText(r.toString(), HEADER_COL_W/2, rect.y + rect.h/2);
      }

      const now = Date.now();

      // Draw Grid Cells
      for (let c = 1; c <= width; c++) {
        for (let r = 1; r <= height; r++) {
          const coord = `${getColName(c)}${r}`;
          const transData = pattern.transitions?.[coord];
          const rect = getCellRect(c, r);

          if (isSimulating) {
            // Background is always white
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
                // flipping
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
              const step = transData?.step || 1;
              if (step <= simStep) {
                cellData = pattern.grid?.[coord];
              } else if (previousPattern) {
                cellData = previousPattern.grid?.[coord];
              }
            }

            if (cellData) {
              ctx.fillStyle = cellData.color;
              ctx.fillRect(drawX, rect.y, drawW, rect.h);

              if (cellData.pos === 'J') {
                ctx.fillStyle = 'rgba(0,0,0,0.4)';
                ctx.fillRect(drawX, rect.y, drawW, rect.h);
              }
            }

            ctx.strokeStyle = '#cbd5e1';
            ctx.lineWidth = 1;
            ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
            
          } else {
            // Normal View
            ctx.fillStyle = getBlueShade(transData?.step);
            ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
            
            ctx.strokeStyle = '#cbd5e1';
            ctx.lineWidth = 1;
            ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);

            if (transData?.step) {
              ctx.fillStyle = 'white';
              ctx.fillText(transData.step.toString(), rect.x + rect.w/2, rect.y + rect.h/2);
            }

            // Draw magic selection highlight
            if (magicSelection?.includes(coord) && isActive && magicSelectionTarget === 'transition') {
              ctx.fillStyle = 'rgba(234, 179, 8, 0.4)'; // Yellow overlay
              ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
              ctx.strokeStyle = '#eab308'; // Yellow bold stroke
              ctx.lineWidth = 2;
              ctx.strokeRect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2);
            }
          }
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
  }, [width, height, pattern, previousPattern, transitionSteps, magicSelection, magicSelectionTarget, isActive, isSimulating, simStep]);

  const drawHoverCanvas = useCallback((centerCol, centerRow) => {
    const canvas = hoverCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    if (!centerCol || !centerRow || !isActive) return;

    const colOffsetLeft = Math.floor((brushSize - 1) / 2);
    const rowOffsetTop = Math.floor((brushSize - 1) / 2);
    
    const startColIdx = centerCol - colOffsetLeft;
    const endColIdx = startColIdx + brushSize - 1;
    const startRowIdx = centerRow - rowOffsetTop;
    const endRowIdx = startRowIdx + brushSize - 1;

    ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.strokeStyle = 'rgba(14, 165, 233, 0.8)';
    ctx.lineWidth = 2;

    for (let c = startColIdx; c <= endColIdx; c++) {
      if (c < 1 || c > width) continue;
      for (let r = startRowIdx; r <= endRowIdx; r++) {
        if (r < 1 || r > height) continue;
        
        const rect = getCellRect(c, r);
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
        ctx.strokeRect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2);
      }
    }
  }, [brushSize, width, height, isActive, canvasWidth, canvasHeight]);

  // Sync hover drawing with store
  useEffect(() => {
    drawHoverCanvas(hoveredCoord?.col, hoveredCoord?.row);
  }, [hoveredCoord, drawHoverCanvas]);

  const calculateGridCoord = useCallback((e) => {
    let x = e.nativeEvent.offsetX;
    let y = e.nativeEvent.offsetY;

    if (x < (HEADER_COL_W + GAP) || y < (HEADER_ROW_H + GAP)) return null;

    const col = Math.floor((x - HEADER_COL_W - GAP) / (CELL_SIZE + GAP)) + 1;
    const row = Math.floor((y - HEADER_ROW_H - GAP) / (CELL_SIZE + GAP)) + 1;

    if (col < 1 || col > width || row < 1 || row > height) return null;
    return { col, row };
  }, [width, height]);

  const handleGridMouseMove = useCallback((e) => {
    if (!isActive) return;
    
    const coord = calculateGridCoord(e);
    
    if (!coord) {
      if (lastHoveredRef.current) {
        setHoveredCoord(null);
        lastHoveredRef.current = null;
      }
      return;
    }

    const coordKey = `${coord.col}-${coord.row}`;

    if (lastHoveredRef.current !== coordKey) {
      setHoveredCoord(coord);
      lastHoveredRef.current = coordKey;
    }
    
    if (e.buttons === 1 && isDraggingRef.current) {
      if (activeTool === 'select' && dragStartRef.current) {
        const minCol = Math.min(dragStartRef.current.col, coord.col);
        const maxCol = Math.max(dragStartRef.current.col, coord.col);
        const minRow = Math.min(dragStartRef.current.row, coord.row);
        const maxRow = Math.max(dragStartRef.current.row, coord.row);

        const newSelection = [];
        for (let c = minCol; c <= maxCol; c++) {
          for (let r = minRow; r <= maxRow; r++) {
             newSelection.push(`${getColName(c)}${r}`);
          }
        }
        setMagicSelection(newSelection, 'transition');
      } else if (activeTool !== 'magic-wand' && activeTool !== 'select') {
        paintCell(pattern.id, getColName(coord.col), coord.row, 'transition');
      }
    }
  }, [isActive, calculateGridCoord, drawHoverCanvas, paintCell, pattern.id, activeTool, setMagicSelection]);

  const handleGridMouseOut = useCallback((e) => {
    setHoveredCoord(null);
    lastHoveredRef.current = null;
  }, [setHoveredCoord]);

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      isDraggingRef.current = false;
      endStroke();
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [endStroke]);

  const handleGridMouseUp = useCallback(() => {
    dragStartRef.current = null;
    isDraggingRef.current = false;
  }, []);

  const handleGridMouseDown = useCallback((e) => {
    if (!isActive) {
      setToolState({ activePatternId: pattern.id });
      return;
    }
    
    const coord = calculateGridCoord(e);
    if (!coord) return;
    
    isDraggingRef.current = true;
    
    if (activeTool === 'select') {
      dragStartRef.current = coord;
      setMagicSelection([`${getColName(coord.col)}${coord.row}`], 'transition');
    } else if (activeTool === 'magic-wand') {
      selectMagicWand(pattern.id, getColName(coord.col), coord.row, 'transition');
    } else {
      startStroke(pattern.id); // Save history before starting to paint
      paintCell(pattern.id, getColName(coord.col), coord.row, 'transition');
    }
  }, [isActive, calculateGridCoord, startStroke, paintCell, pattern.id, activeTool, selectMagicWand, setMagicSelection, setToolState]);

  return (
    <div className="card" style={{ 
      border: isActive ? '2px solid var(--primary)' : '2px solid transparent',
      opacity: isActive ? 1 : 0.6,
      transition: 'opacity 0.2s, border 0.2s',
      marginLeft: '1rem',
      cursor: isActive ? 'crosshair' : 'pointer'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: `${16 / zoomLevel}px`,
        height: `${40 / zoomLevel}px`
      }}>
        <h3 style={{ 
          fontSize: '1.125rem', 
          fontWeight: 'bold', 
          margin: 0, 
          userSelect: 'none',
          transform: `scale(${1 / zoomLevel})`,
          transformOrigin: 'left center'
        }}>
          Transisi - POLA {index + 1}
        </h3>
        
        <div style={{ 
          display: 'flex', 
          justifyContent: 'flex-end', 
          alignItems: 'center',
          gap: '0.5rem',
          visibility: isActive ? 'visible' : 'hidden',
          transform: `scale(${1 / zoomLevel})`,
          transformOrigin: 'right center'
        }}>
          {isSimulating && (
            <div style={{
              background: 'var(--primary)',
              color: 'white',
              padding: '0.4rem 0.75rem',
              borderRadius: '9999px',
              fontSize: '0.875rem',
              fontWeight: 600,
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              {simStep === 0 ? `Siap!` : `Aba-aba ${simStep}!`}
            </div>
          )}
          <button 
            className={`btn ${isSimulating ? 'btn-outline' : 'btn-primary'}`}
            style={{ 
              padding: '0.4rem 0.75rem', 
              fontSize: '0.875rem', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem'
            }}
            onClick={toggleSimulation}
          >
            {isSimulating ? (
              <>
                <Square size={16} fill="currentColor" /> Stop
              </>
            ) : (
              <>
                <Play size={16} fill="currentColor" /> Simulasi
              </>
            )}
          </button>
        </div>
      </div>
      
      <div 
        onMouseMove={handleGridMouseMove}
        onMouseLeave={handleGridMouseOut}
        onMouseDown={handleGridMouseDown}
        onMouseUp={handleGridMouseUp}
        style={{ 
          position: 'relative',
          width: canvasWidth,
          height: canvasHeight,
          overflow: 'hidden',
          userSelect: 'none'
        }}
      >
        <canvas 
          ref={baseCanvasRef}
          width={canvasWidth}
          height={canvasHeight}
          style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
        />
        <canvas 
          ref={hoverCanvasRef}
          width={canvasWidth}
          height={canvasHeight}
          style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
        />
      </div>
    </div>
  )
})
