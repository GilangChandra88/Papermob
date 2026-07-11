import React, { memo, useMemo, useCallback, useRef, useEffect, Fragment } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { useProjectStore, getColName, getColIndex } from '../store/projectStore'

export default memo(function PatternCard({ pattern, index, projectData }) {
  const { width, height } = projectData
  const paintCell = useProjectStore(state => state.paintCell)
  const saveHistory = useProjectStore(state => state.saveHistory)
  const activePatternId = useProjectStore(state => state.activePatternId)
  const brushSize = useProjectStore(state => state.brushSize)
  const activeTool = useProjectStore(state => state.activeTool)
  const magicSelection = useProjectStore(state => state.magicSelection)
  const selectMagicWand = useProjectStore(state => state.selectMagicWand)
  const setMagicSelection = useProjectStore(state => state.setMagicSelection)
  const hoveredCoord = useProjectStore(state => state.hoveredCoord)
  const setHoveredCoord = useProjectStore(state => state.setHoveredCoord)
  const setToolState = useProjectStore(state => state.setToolState)
  const movePatternUp = useProjectStore(state => state.movePatternUp)
  const movePatternDown = useProjectStore(state => state.movePatternDown)
  const renamePattern = useProjectStore(state => state.renamePattern)
  
  const baseCanvasRef = useRef(null)
  const hoverCanvasRef = useRef(null)
  const lastHoveredRef = useRef(null)
  const dragStartRef = useRef(null)

  const isActive = activePatternId === pattern.id

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

  // Draw the entire base grid
  useEffect(() => {
    const canvas = baseCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
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

    // Draw Grid Cells
    for (let c = 1; c <= width; c++) {
      for (let r = 1; r <= height; r++) {
        const coord = `${getColName(c)}${r}`;
        const cellData = pattern.grid[coord];
        const rect = getCellRect(c, r);

        let bgColor = '#e2e8f0';
        let textColor = '#64748b';
        let overlayColor = null;

        if (cellData) {
          bgColor = cellData.color;
          
          let hex = cellData.color || '#ffffff';
          if (hex.startsWith('#') && hex.length === 7) {
            let rHex = parseInt(hex.substring(1, 3), 16);
            let gHex = parseInt(hex.substring(3, 5), 16);
            let bHex = parseInt(hex.substring(5, 7), 16);
            let yiq = ((rHex * 299) + (gHex * 587) + (bHex * 114)) / 1000;
            
            textColor = (yiq >= 128) ? '#0f172a' : 'white';
            
            if (cellData.pos === 'J') {
              // Jika Gelap, buat warna terang menjadi sedikit lebih gelap (jangan terlalu abu)
              if (yiq >= 50) overlayColor = 'rgba(0,0,0,0.15)'; 
            } else if (cellData.pos === 'B') {
              // Jika Terang, buat warna gelap (seperti hitam) menjadi sedikit lebih terang
              if (yiq < 50) overlayColor = 'rgba(255,255,255,0.2)';
            }
          }
        }

        ctx.fillStyle = bgColor;
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
        
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);

        if (overlayColor) {
          ctx.fillStyle = overlayColor;
          ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
        }

        if (cellData?.pos) {
          ctx.fillStyle = textColor;
          ctx.fillText(cellData.pos, rect.x + rect.w/2, rect.y + rect.h/2);
        }

        // Draw magic selection highlight
        if (magicSelection?.includes(coord) && isActive) {
          ctx.fillStyle = 'rgba(234, 179, 8, 0.4)'; // Yellow overlay
          ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
          ctx.strokeStyle = '#eab308'; // Yellow bold stroke
          ctx.lineWidth = 2;
          ctx.strokeRect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2);
        }
      }
    }
  }, [width, height, pattern.grid, magicSelection, isActive]);

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

    ctx.fillStyle = 'rgba(56, 189, 248, 0.4)'; // Light blue highlight
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
    
    if (e.buttons === 1) {
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
        setMagicSelection(newSelection);
      } else if (activeTool !== 'magic-wand' && activeTool !== 'select') {
        paintCell(pattern.id, getColName(coord.col), coord.row);
      }
    }
  }, [isActive, calculateGridCoord, drawHoverCanvas, paintCell, pattern.id, activeTool, setMagicSelection]);

  const handleGridMouseOut = useCallback((e) => {
    setHoveredCoord(null);
    lastHoveredRef.current = null;
  }, [setHoveredCoord]);

  const handleGridMouseUp = useCallback(() => {
    dragStartRef.current = null;
  }, []);

  const handleGridMouseDown = useCallback((e) => {
    if (!isActive) {
      setToolState({ activePatternId: pattern.id });
    }
    
    const coord = calculateGridCoord(e);
    if (!coord) return;
    
    if (activeTool === 'select') {
      dragStartRef.current = coord;
      setMagicSelection([`${getColName(coord.col)}${coord.row}`]);
    } else if (activeTool === 'magic-wand') {
      selectMagicWand(pattern.id, getColName(coord.col), coord.row);
    } else {
      saveHistory(); // Save history before starting to paint
      paintCell(pattern.id, getColName(coord.col), coord.row);
    }
  }, [isActive, calculateGridCoord, saveHistory, paintCell, pattern.id, activeTool, selectMagicWand, setMagicSelection, setToolState]);

  return (
    <div className="card" style={{ 
      border: isActive ? '2px solid var(--primary)' : '2px solid transparent',
      opacity: isActive ? 1 : 0.6,
      transition: 'opacity 0.2s, border 0.2s',
      cursor: isActive ? 'crosshair' : 'pointer'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', flex: 1, overflow: 'hidden' }}>
          <span style={{ fontSize: '1.125rem', fontWeight: 'bold', whiteSpace: 'nowrap', userSelect: 'none' }}>POLA {index + 1} -&nbsp;</span>
          <input 
            type="text"
            value={pattern.name.replace(/^Pola \d+(\s*-\s*)?/i, '')}
            onChange={(e) => renamePattern(pattern.id, e.target.value)}
            style={{ 
              fontSize: '1.125rem', 
              fontWeight: 'bold', 
              border: '1px solid transparent', 
              background: 'transparent',
              outline: 'none',
              padding: '0.2rem 0.5rem',
              borderRadius: '4px',
              width: '100%',
              cursor: 'text'
            }}
          onFocus={(e) => {
            e.target.style.border = '1px solid var(--primary)';
            setToolState({ activePatternId: pattern.id });
          }}
          onBlur={(e) => e.target.style.border = '1px solid transparent'}
        />
        </div>
        <div style={{ display: 'flex', gap: '0.25rem', paddingLeft: '1rem' }}>
          <button className="btn btn-outline" onClick={() => movePatternUp(pattern.id)} style={{ padding: '0.2rem' }} title="Naikkan urutan">
            <ChevronUp size={16} />
          </button>
          <button className="btn btn-outline" onClick={() => movePatternDown(pattern.id)} style={{ padding: '0.2rem' }} title="Turunkan urutan">
            <ChevronDown size={16} />
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
        }}>
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
