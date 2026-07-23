import { create } from 'zustand'
import { queueDeltaUpdate } from '../utils/firebaseUtils'

// Helper to generate coordinates (A1, B1, AA1, etc.)
export const getColName = (n) => {
  let name = ''
  while (n > 0) {
    let m = (n - 1) % 26
    name = String.fromCharCode(65 + m) + name
    n = Math.floor((n - m) / 26)
  }
  return name
}

export const getColIndex = (name) => {
  let idx = 0;
  for (let i = 0; i < name.length; i++) {
    idx = idx * 26 + name.charCodeAt(i) - 64;
  }
  return idx;
}

const generateDefaultPattern = (id, name, width, height, colors, positions, hasTransition) => {
  const grid = {};
  const transitions = {};
  
  const randomColor = colors && colors.length > 0 ? colors[Math.floor(Math.random() * colors.length)] : null;
  let randomPos = positions && positions.length > 0 ? positions[Math.floor(Math.random() * positions.length)] : null;
  if (randomPos === 'jongkok') randomPos = 'J';
  else if (randomPos === 'berdiri') randomPos = 'B';
  
  for (let c = 1; c <= width; c++) {
    const colStr = getColName(c);
    for (let r = 1; r <= height; r++) {
      const coord = `${colStr}${r}`;
      grid[coord] = { color: randomColor, pos: randomPos };
      if (hasTransition) {
        transitions[coord] = { step: 1 };
      }
    }
  }
  
  return { id, name, grid, transitions };
}

export const useProjectStore = create((set, get) => ({
  projectData: null,
  patterns: [], // Array of patterns. Each pattern has { id: 1, name: 'Pattern 1', grid: {}, transitions: {} }
  activePatternId: 1,
  
  // Tools state
  selectedColor: '', // Color hex
  selectedPosition: '', // 'J' (Jongkok) or 'B' (Berdiri)
  selectedTransitionStep: 1,
  activeTool: 'brush', // 'brush', 'eraser', 'transition-brush'
  zoomLevel: 1, // Default zoom is 100%
  brushSize: 1, // Default brush size is 1x1

  // History for Undo/Redo
  past: [],
  future: [],

  initProject: (data) => {
    const defaultColor = data.colors[0];
    const defaultPos = data.positions.includes('berdiri') ? 'B' : 'J';
    
    let initialPatterns = [];
    if (data.patternsMap && data.patternOrder) {
      initialPatterns = data.patternOrder.map(id => data.patternsMap[id]);
    } else if (data.patterns && data.patterns.length > 0) {
      initialPatterns = data.patterns;
    } else {
      initialPatterns = [generateDefaultPattern(Date.now(), 'Pola 1 - Untitled', data.width, data.height, defaultColor, defaultPos, data.hasTransition)];
    }

    const canvasWidth = 42 + (data.width * 32);
    const canvasHeight = 32 + (data.height * 32);
    
    const availableWidth = window.innerWidth > 768 ? window.innerWidth - 400 : window.innerWidth - 50;
    const availableHeight = window.innerHeight - 300;

    const totalRequiredWidth = data.hasTransition ? (canvasWidth * 2 + 50) : canvasWidth;
    
    let initialZoom = Math.min(availableWidth / totalRequiredWidth, availableHeight / canvasHeight, 1);
    initialZoom = Math.floor(initialZoom * 100) / 100;
    if (initialZoom < 0.1) initialZoom = 0.1;

    set({
      projectData: data,
      patterns: initialPatterns,
      activePatternId: initialPatterns[0].id,
      selectedColor: defaultColor,
      selectedPosition: defaultPos,
      selectedTransitionStep: 1,
      activeTool: 'brush',
      hoveredCoord: null,
      magicSelection: [],
      magicSelectionTarget: 'pattern',
      clipboardData: null,
      zoomLevel: initialZoom,
      brushSize: 1,
      past: [],
      future: [],
      currentStroke: null
    })
  },

  startStroke: (patternId) => set((state) => {
    return {
      currentStroke: { patternId, deltas: {} }
    }
  }),

  endStroke: () => set((state) => {
    if (!state.currentStroke || Object.keys(state.currentStroke.deltas).length === 0) {
      return { currentStroke: null };
    }
    const maxHistory = 30; // Limit history
    const newPast = [...state.past, state.currentStroke];
    if (newPast.length > maxHistory) {
      newPast.shift(); // Remove oldest
    }
    return {
      past: newPast,
      future: [], // Clear future when a new action is performed
      currentStroke: null
    }
  }),

  undo: () => set((state) => {
    if (state.past.length === 0) return state;
    
    const stroke = state.past[state.past.length - 1];
    const newPast = state.past.slice(0, state.past.length - 1);
    
    let newPatterns = [...state.patterns];
    let newActiveId = state.activePatternId;
    const firebaseDeltas = {};

    if (stroke.type === 'STRUCTURAL') {
      if (stroke.subType === 'ADD_PATTERN') {
         newPatterns = state.patterns.filter(p => p.id !== stroke.pattern.id);
         firebaseDeltas[`patternsMap.${stroke.pattern.id}`] = null;
         firebaseDeltas.patternOrder = stroke.previousOrder;
         newActiveId = stroke.previousActiveId;
      } else if (stroke.subType === 'DELETE_PATTERN') {
         newPatterns.splice(stroke.index, 0, stroke.pattern);
         firebaseDeltas[`patternsMap.${stroke.pattern.id}`] = stroke.pattern;
         firebaseDeltas.patternOrder = stroke.previousOrder;
         newActiveId = stroke.previousActiveId;
      } else if (stroke.subType === 'MOVE_PATTERN') {
         newPatterns.sort((a, b) => stroke.previousOrder.indexOf(a.id) - stroke.previousOrder.indexOf(b.id));
         firebaseDeltas.patternOrder = stroke.previousOrder;
         newActiveId = stroke.previousActiveId;
      }
    } else {
      const patternIndex = state.patterns.findIndex(p => p.id === stroke.patternId);
      if (patternIndex !== -1) {
        const pattern = { ...newPatterns[patternIndex] };
        const newGrid = { ...pattern.grid };
        const newTransitions = { ...pattern.transitions };
        
        for (const coord in stroke.deltas) {
          const { old: oldVal, target } = stroke.deltas[coord];
          
          if (target === 'pattern') {
            if (oldVal) {
              newGrid[coord] = oldVal;
              firebaseDeltas[`patternsMap.${stroke.patternId}.grid.${coord}`] = oldVal;
            } else {
              delete newGrid[coord];
              firebaseDeltas[`patternsMap.${stroke.patternId}.grid.${coord}`] = null;
            }
          } else if (target === 'transition') {
            if (oldVal) {
              newTransitions[coord] = oldVal;
              firebaseDeltas[`patternsMap.${stroke.patternId}.transitions.${coord}`] = oldVal;
            } else {
              delete newTransitions[coord];
              firebaseDeltas[`patternsMap.${stroke.patternId}.transitions.${coord}`] = null;
            }
          }
        }
        pattern.grid = newGrid;
        pattern.transitions = newTransitions;
        newPatterns[patternIndex] = pattern;
      }
    }

    if (state.projectData?.id && Object.keys(firebaseDeltas).length > 0) {
      queueDeltaUpdate(state.projectData.id, firebaseDeltas);
    }

    return {
      past: newPast,
      patterns: newPatterns,
      activePatternId: newActiveId,
      future: [stroke, ...state.future]
    }
  }),

  redo: () => set((state) => {
    if (state.future.length === 0) return state;
    
    const stroke = state.future[0];
    const newFuture = state.future.slice(1);
    
    let newPatterns = [...state.patterns];
    let newActiveId = state.activePatternId;
    const firebaseDeltas = {};

    if (stroke.type === 'STRUCTURAL') {
      if (stroke.subType === 'ADD_PATTERN') {
         newPatterns.splice(stroke.index, 0, stroke.pattern);
         firebaseDeltas[`patternsMap.${stroke.pattern.id}`] = stroke.pattern;
         firebaseDeltas.patternOrder = newPatterns.map(p => p.id);
         newActiveId = stroke.pattern.id;
      } else if (stroke.subType === 'DELETE_PATTERN') {
         newPatterns = state.patterns.filter(p => p.id !== stroke.pattern.id);
         firebaseDeltas[`patternsMap.${stroke.pattern.id}`] = null;
         firebaseDeltas.patternOrder = newPatterns.map(p => p.id);
         if (newActiveId === stroke.pattern.id) {
           newActiveId = newPatterns[0]?.id || null;
         }
      } else if (stroke.subType === 'MOVE_PATTERN') {
         newPatterns.sort((a, b) => stroke.newOrder.indexOf(a.id) - stroke.newOrder.indexOf(b.id));
         firebaseDeltas.patternOrder = stroke.newOrder;
         newActiveId = stroke.newActiveId;
      }
    } else {
      const patternIndex = state.patterns.findIndex(p => p.id === stroke.patternId);
      if (patternIndex !== -1) {
        const pattern = { ...newPatterns[patternIndex] };
        const newGrid = { ...pattern.grid };
        const newTransitions = { ...pattern.transitions };
        
        for (const coord in stroke.deltas) {
          const { new: newVal, target } = stroke.deltas[coord];
          
          if (target === 'pattern') {
            if (newVal) {
              newGrid[coord] = newVal;
              firebaseDeltas[`patternsMap.${stroke.patternId}.grid.${coord}`] = newVal;
            } else {
              delete newGrid[coord];
              firebaseDeltas[`patternsMap.${stroke.patternId}.grid.${coord}`] = null;
            }
          } else if (target === 'transition') {
            if (newVal) {
              newTransitions[coord] = newVal;
              firebaseDeltas[`patternsMap.${stroke.patternId}.transitions.${coord}`] = newVal;
            } else {
              delete newTransitions[coord];
              firebaseDeltas[`patternsMap.${stroke.patternId}.transitions.${coord}`] = null;
            }
          }
        }
        
        pattern.grid = newGrid;
        pattern.transitions = newTransitions;
        newPatterns[patternIndex] = pattern;
      }
    }

    if (state.projectData?.id && Object.keys(firebaseDeltas).length > 0) {
      queueDeltaUpdate(state.projectData.id, firebaseDeltas);
    }

    return {
      past: [...state.past, stroke],
      patterns: newPatterns,
      activePatternId: newActiveId,
      future: newFuture
    }
  }),

  setToolState: (newState) => set((state) => ({ ...state, ...newState })),
  setHoveredCoord: (coord) => set({ hoveredCoord: coord }),
  setZoomLevel: (level) => set({ zoomLevel: level }),

  addPattern: (indexToInsert = null) => set((state) => {
    const newId = state.patterns.length > 0 ? Math.max(...state.patterns.map(p => p.id)) + 1 : 1;
    const { width, height, hasTransition, colors, positions } = state.projectData;
    const newPattern = generateDefaultPattern(
      newId, 
      `Untitled`, 
      width, 
      height, 
      colors, 
      positions, 
      hasTransition
    );
    
    const previousOrder = state.patterns.map(p => p.id);
    let newPatterns = [...state.patterns];
    let insertedIndex;

    if (indexToInsert !== null && indexToInsert >= 0 && indexToInsert <= newPatterns.length) {
      newPatterns.splice(indexToInsert, 0, newPattern);
      insertedIndex = indexToInsert;
    } else {
      newPatterns.push(newPattern);
      insertedIndex = newPatterns.length - 1;
    }
    
    if (state.projectData?.id) {
      queueDeltaUpdate(state.projectData.id, {
        [`patternsMap.${newId}`]: newPattern,
        patternOrder: newPatterns.map(p => p.id)
      });
    }

    const stroke = {
      type: 'STRUCTURAL',
      subType: 'ADD_PATTERN',
      pattern: newPattern,
      index: insertedIndex,
      previousOrder: previousOrder,
      previousActiveId: state.activePatternId
    };

    const newPast = [...state.past, stroke];
    if (newPast.length > 30) newPast.shift();

    return {
      patterns: newPatterns,
      activePatternId: newId,
      past: newPast,
      future: []
    }
  }),

  duplicatePattern: (id) => set((state) => {
    const index = state.patterns.findIndex(p => p.id === id);
    if (index === -1) return state;

    const sourcePattern = state.patterns[index];
    const newId = state.patterns.length > 0 ? Math.max(...state.patterns.map(p => p.id)) + 1 : 1;
    
    const newPattern = {
      id: newId,
      name: `${sourcePattern.name} (Copy)`,
      grid: JSON.parse(JSON.stringify(sourcePattern.grid || {})),
      transitions: JSON.parse(JSON.stringify(sourcePattern.transitions || {}))
    };
    
    const previousOrder = state.patterns.map(p => p.id);
    const newPatterns = [...state.patterns];
    newPatterns.splice(index + 1, 0, newPattern);
    
    if (state.projectData?.id) {
      queueDeltaUpdate(state.projectData.id, {
        [`patternsMap.${newId}`]: newPattern,
        patternOrder: newPatterns.map(p => p.id)
      });
    }

    const stroke = {
      type: 'STRUCTURAL',
      subType: 'ADD_PATTERN', // It's essentially an ADD action!
      pattern: newPattern,
      index: index + 1,
      previousOrder: previousOrder,
      previousActiveId: state.activePatternId
    };

    const newPast = [...state.past, stroke];
    if (newPast.length > 30) newPast.shift();

    return {
      patterns: newPatterns,
      activePatternId: newId,
      past: newPast,
      future: []
    }
  }),

  renamePattern: (id, newName) => set((state) => {
    const newPatterns = state.patterns.map(p => 
      p.id === id ? { ...p, name: newName } : p
    );
    if (state.projectData?.id) {
      queueDeltaUpdate(state.projectData.id, {
        [`patternsMap.${id}.name`]: newName
      });
    }
    return { patterns: newPatterns };
  }),

  movePatternUp: (id) => set((state) => {
    const index = state.patterns.findIndex(p => p.id === id);
    if (index <= 0) return state; // Already at top
    
    const previousOrder = state.patterns.map(p => p.id);
    const newPatterns = [...state.patterns];
    const temp = newPatterns[index - 1];
    newPatterns[index - 1] = newPatterns[index];
    newPatterns[index] = temp;
    
    const newOrder = newPatterns.map(p => p.id);
    if (state.projectData?.id) queueDeltaUpdate(state.projectData.id, { patternOrder: newOrder });

    const stroke = {
      type: 'STRUCTURAL',
      subType: 'MOVE_PATTERN',
      previousOrder: previousOrder,
      newOrder: newOrder,
      previousActiveId: state.activePatternId,
      newActiveId: id
    };
    const newPast = [...state.past, stroke];
    if (newPast.length > 30) newPast.shift();

    return { patterns: newPatterns, activePatternId: id, past: newPast, future: [] };
  }),

  movePatternDown: (id) => set((state) => {
    const index = state.patterns.findIndex(p => p.id === id);
    if (index === -1 || index === state.patterns.length - 1) return state; // Already at bottom
    
    const previousOrder = state.patterns.map(p => p.id);
    const newPatterns = [...state.patterns];
    const temp = newPatterns[index + 1];
    newPatterns[index + 1] = newPatterns[index];
    newPatterns[index] = temp;
    
    const newOrder = newPatterns.map(p => p.id);
    if (state.projectData?.id) queueDeltaUpdate(state.projectData.id, { patternOrder: newOrder });

    const stroke = {
      type: 'STRUCTURAL',
      subType: 'MOVE_PATTERN',
      previousOrder: previousOrder,
      newOrder: newOrder,
      previousActiveId: state.activePatternId,
      newActiveId: id
    };
    const newPast = [...state.past, stroke];
    if (newPast.length > 30) newPast.shift();

    return { patterns: newPatterns, activePatternId: id, past: newPast, future: [] };
  }),

  deletePattern: (id) => set((state) => {
    if (state.patterns.length <= 1) return state; // Prevent deleting the last pattern
    
    const index = state.patterns.findIndex(p => p.id === id);
    const deletedPattern = state.patterns[index];
    const previousOrder = state.patterns.map(p => p.id);

    const newPatterns = state.patterns.filter(p => p.id !== id);
    let newActiveId = state.activePatternId;
    if (newActiveId === id) {
      newActiveId = newPatterns[0]?.id || null;
    }
    
    if (state.projectData?.id) {
      queueDeltaUpdate(state.projectData.id, { 
        patternOrder: newPatterns.map(p => p.id),
        [`patternsMap.${id}`]: null 
      });
    }

    const stroke = {
      type: 'STRUCTURAL',
      subType: 'DELETE_PATTERN',
      pattern: deletedPattern,
      index: index,
      previousOrder: previousOrder,
      previousActiveId: state.activePatternId
    };
    
    const newPast = [...state.past, stroke];
    if (newPast.length > 30) newPast.shift();

    return { patterns: newPatterns, activePatternId: newActiveId, past: newPast, future: [] };
  }),

  // Action to paint a cell on the grid
  paintCell: (patternId, colStr, rowNum, target = 'pattern') => set((state) => {
    const patternIndex = state.patterns.findIndex(p => p.id === patternId)
    if (patternIndex === -1) return state

    const newPatterns = [...state.patterns]
    const pattern = { ...newPatterns[patternIndex] }
    
    const centerColIdx = getColIndex(colStr)
    const { width, height } = state.projectData

    const newGrid = { ...pattern.grid }
    const newTransitions = { ...pattern.transitions }
    const deltas = {}

    // Calculate centered bounds
    const colOffsetLeft = Math.floor((state.brushSize - 1) / 2)
    const rowOffsetTop = Math.floor((state.brushSize - 1) / 2)
    
    // We don't clamp the start index to 1 when calculating the absolute loop bounds 
    // because if we clamp it, the brush shape gets distorted on edges. 
    // We just skip invalid coordinates inside the loop.
    const startColIdx = centerColIdx - colOffsetLeft
    const endColIdx = startColIdx + state.brushSize - 1
    
    const startRowIdx = rowNum - rowOffsetTop
    const endRowIdx = startRowIdx + state.brushSize - 1

    for (let c = startColIdx; c <= endColIdx; c++) {
      if (c < 1 || c > width) continue; // Boundary check

      for (let r = startRowIdx; r <= endRowIdx; r++) {
        if (r < 1 || r > height) continue; // Boundary check

        const coord = `${getColName(c)}${r}`

        if (state.activeTool === 'brush') {
          if (target === 'pattern') {
            const oldVal = newGrid[coord] ? { ...newGrid[coord] } : null;
            const newVal = { color: state.selectedColor, pos: state.selectedPosition };
            
            newGrid[coord] = newVal;
            deltas[`patternsMap.${patternId}.grid.${coord}`] = newVal;
            
            if (state.currentStroke && state.currentStroke.patternId === patternId) {
              if (!state.currentStroke.deltas[coord]) {
                state.currentStroke.deltas[coord] = { old: oldVal, new: newVal, target: 'pattern' };
              } else {
                state.currentStroke.deltas[coord].new = newVal;
              }
            }
          } else if (target === 'transition' && state.projectData?.hasTransition) {
            const oldVal = newTransitions[coord] ? { ...newTransitions[coord] } : null;
            const newVal = { step: state.selectedTransitionStep };
            
            newTransitions[coord] = newVal;
            deltas[`patternsMap.${patternId}.transitions.${coord}`] = newVal;
            
            if (state.currentStroke && state.currentStroke.patternId === patternId) {
              if (!state.currentStroke.deltas[coord]) {
                state.currentStroke.deltas[coord] = { old: oldVal, new: newVal, target: 'transition' };
              } else {
                state.currentStroke.deltas[coord].new = newVal;
              }
            }
          }
        }
      }
    }

    if (state.projectData?.id && Object.keys(deltas).length > 0) {
      queueDeltaUpdate(state.projectData.id, deltas);
    }

    pattern.grid = newGrid
    pattern.transitions = newTransitions

    newPatterns[patternIndex] = pattern
    return { patterns: newPatterns }
  }),

  // Magic Selection / Select logic
  clearMagicSelection: () => set({ magicSelection: [] }),
  setMagicSelection: (selection, target = 'pattern') => set({ magicSelection: selection, magicSelectionTarget: target }),
  
  copySelection: () => set((state) => {
    if (!state.magicSelection || state.magicSelection.length === 0) return state;
    
    const pattern = state.patterns.find(p => p.id === state.activePatternId);
    if (!pattern) return state;

    let minColIdx = Infinity;
    let minRow = Infinity;

    state.magicSelection.forEach(coord => {
      const match = coord.match(/^([A-Z]+)(\d+)$/);
      if (match) {
        const colStr = match[1];
        const r = parseInt(match[2]);
        const cIdx = getColIndex(colStr);
        if (cIdx < minColIdx) minColIdx = cIdx;
        if (r < minRow) minRow = r;
      }
    });

    const clipboardCells = [];
    state.magicSelection.forEach(coord => {
      const match = coord.match(/^([A-Z]+)(\d+)$/);
      if (match) {
        const colStr = match[1];
        const r = parseInt(match[2]);
        const cIdx = getColIndex(colStr);
        
        let cellData = null;
        if (state.magicSelectionTarget === 'pattern') {
          cellData = pattern.grid?.[coord] || null;
        } else if (state.magicSelectionTarget === 'transition') {
          cellData = pattern.transitions?.[coord] || { step: 1 };
        }

        clipboardCells.push({
          dCol: cIdx - minColIdx,
          dRow: r - minRow,
          cellData: cellData ? JSON.parse(JSON.stringify(cellData)) : null
        });
      }
    });

    return { 
      clipboardData: { 
        target: state.magicSelectionTarget, 
        cells: clipboardCells 
      } 
    };
  }),

  pasteSelection: () => set((state) => {
    if (!state.clipboardData || !state.clipboardData.cells || state.clipboardData.cells.length === 0) return state;
    if (state.clipboardData.target !== state.magicSelectionTarget) {
      // alert or silently ignore if pasting pattern to transition
      return state;
    }
    
    if (!state.magicSelection || state.magicSelection.length === 0) return state;

    const patternIndex = state.patterns.findIndex(p => p.id === state.activePatternId);
    if (patternIndex === -1) return state;

    // We will push to history after processing paste
    let minColIdx = Infinity;
    let minRow = Infinity;

    state.magicSelection.forEach(coord => {
      const match = coord.match(/^([A-Z]+)(\d+)$/);
      if (match) {
        const colStr = match[1];
        const r = parseInt(match[2]);
        const cIdx = getColIndex(colStr);
        if (cIdx < minColIdx) minColIdx = cIdx;
        if (r < minRow) minRow = r;
      }
    });

    const newPatterns = [...state.patterns];
    const newPattern = { ...newPatterns[patternIndex] };
    
    if (state.clipboardData.target === 'pattern') {
      newPattern.grid = { ...(newPattern.grid || {}) };
    } else {
      newPattern.transitions = { ...(newPattern.transitions || {}) };
    }

    const firebaseDeltas = {};
    const strokeDeltas = {};

    state.clipboardData.cells.forEach(item => {
      const targetColIdx = minColIdx + item.dCol;
      const targetRow = minRow + item.dRow;
      
      if (targetColIdx >= 1 && targetColIdx <= state.projectData.width && targetRow >= 1 && targetRow <= state.projectData.height) {
        const targetCoord = `${getColName(targetColIdx)}${targetRow}`;
        if (state.clipboardData.target === 'pattern') {
          const oldVal = newPattern.grid[targetCoord] ? { ...newPattern.grid[targetCoord] } : null;
          
          if (item.cellData) {
            newPattern.grid[targetCoord] = JSON.parse(JSON.stringify(item.cellData));
            firebaseDeltas[`patternsMap.${newPattern.id}.grid.${targetCoord}`] = item.cellData;
            strokeDeltas[targetCoord] = { old: oldVal, new: item.cellData, target: 'pattern' };
          } else {
            delete newPattern.grid[targetCoord];
            firebaseDeltas[`patternsMap.${newPattern.id}.grid.${targetCoord}`] = null;
            strokeDeltas[targetCoord] = { old: oldVal, new: null, target: 'pattern' };
          }
        } else {
          const oldVal = newPattern.transitions[targetCoord] ? { ...newPattern.transitions[targetCoord] } : null;
          
          if (item.cellData) {
            newPattern.transitions[targetCoord] = JSON.parse(JSON.stringify(item.cellData));
            firebaseDeltas[`patternsMap.${newPattern.id}.transitions.${targetCoord}`] = item.cellData;
            strokeDeltas[targetCoord] = { old: oldVal, new: item.cellData, target: 'transition' };
          } else {
            delete newPattern.transitions[targetCoord];
            firebaseDeltas[`patternsMap.${newPattern.id}.transitions.${targetCoord}`] = null;
            strokeDeltas[targetCoord] = { old: oldVal, new: null, target: 'transition' };
          }
        }
      }
    });

    if (state.projectData?.id && Object.keys(firebaseDeltas).length > 0) {
      queueDeltaUpdate(state.projectData.id, firebaseDeltas);
    }

    newPatterns[patternIndex] = newPattern;
    
    const stroke = { patternId: newPattern.id, deltas: strokeDeltas };
    const maxHistory = 30;
    const newPast = [...state.past, stroke];
    if (newPast.length > maxHistory) newPast.shift();

    return { patterns: newPatterns, past: newPast, future: [] };
  }),
  
  selectMagicWand: (patternId, colStr, rowNum, target = 'pattern') => set((state) => {
    const pattern = state.patterns.find(p => p.id === patternId);
    if (!pattern) return state;

    const { width, height } = state.projectData;
    const startCoord = `${colStr}${rowNum}`;
    
    let targetColor = null;
    let targetPos = null;
    let targetStep = null;
    
    if (target === 'pattern') {
      const startCell = pattern.grid?.[startCoord];
      targetColor = startCell ? startCell.color : null;
      targetPos = startCell ? startCell.pos : null;
    } else {
      const startCell = pattern.transitions?.[startCoord];
      targetStep = startCell ? startCell.step : null;
    }
    
    // Flood fill (BFS)
    const queue = [{ c: getColIndex(colStr), r: rowNum }];
    const visited = new Set([startCoord]);
    const selection = [];
    
    while (queue.length > 0) {
      const { c, r } = queue.shift();
      const coord = `${getColName(c)}${r}`;
      selection.push(coord);
      
      // Check neighbors
      const neighbors = [
        { c: c, r: r - 1 }, // up
        { c: c, r: r + 1 }, // down
        { c: c - 1, r: r }, // left
        { c: c + 1, r: r }  // right
      ];
      
      for (const n of neighbors) {
        if (n.c >= 1 && n.c <= width && n.r >= 1 && n.r <= height) {
          const nCoord = `${getColName(n.c)}${n.r}`;
          if (!visited.has(nCoord)) {
            let isMatch = false;
            
            if (target === 'pattern') {
              const nCell = pattern.grid?.[nCoord];
              const nColor = nCell ? nCell.color : null;
              const nPos = nCell ? nCell.pos : null;
              isMatch = (nColor === targetColor && nPos === targetPos);
            } else {
              const nCell = pattern.transitions?.[nCoord];
              const nStep = nCell ? nCell.step : null;
              isMatch = (nStep === targetStep);
            }

            if (isMatch) {
              visited.add(nCoord);
              queue.push(n);
            }
          }
        }
      }
    }
    
    return { magicSelection: selection, magicSelectionTarget: target };
  }),

  fillMagicSelection: (color, pos) => set((state) => {
    if (!state.magicSelection || state.magicSelection.length === 0) return state;
    
    const patternIndex = state.patterns.findIndex(p => p.id === state.activePatternId);
    if (patternIndex === -1) return state;

    const newPatterns = [...state.patterns];
    const pattern = { ...newPatterns[patternIndex] };
    const newGrid = { ...pattern.grid };
    const firebaseDeltas = {};
    const strokeDeltas = {};

    for (const coord of state.magicSelection) {
      const oldVal = newGrid[coord] ? { ...newGrid[coord] } : null;
      const newVal = { color, pos };
      newGrid[coord] = newVal;
      firebaseDeltas[`patternsMap.${pattern.id}.grid.${coord}`] = newVal;
      strokeDeltas[coord] = { old: oldVal, new: newVal, target: 'pattern' };
    }

    if (state.projectData?.id && Object.keys(firebaseDeltas).length > 0) {
      queueDeltaUpdate(state.projectData.id, firebaseDeltas);
    }

    pattern.grid = newGrid;
    newPatterns[patternIndex] = pattern;
    
    const stroke = { patternId: pattern.id, deltas: strokeDeltas };
    const maxHistory = 30;
    const newPast = [...state.past, stroke];
    if (newPast.length > maxHistory) newPast.shift();

    return { 
      patterns: newPatterns,
      past: newPast,
      future: []
    };
  }),

  fillMagicSelectionTransition: (step) => set((state) => {
    if (!state.magicSelection || state.magicSelection.length === 0) return state;
    
    const patternIndex = state.patterns.findIndex(p => p.id === state.activePatternId);
    if (patternIndex === -1) return state;

    const newPatterns = [...state.patterns];
    const pattern = { ...newPatterns[patternIndex] };
    const newTransitions = { ...pattern.transitions };
    const firebaseDeltas = {};
    const strokeDeltas = {};

    for (const coord of state.magicSelection) {
      const oldVal = newTransitions[coord] ? { ...newTransitions[coord] } : null;
      const newVal = { step };
      newTransitions[coord] = newVal;
      firebaseDeltas[`patternsMap.${pattern.id}.transitions.${coord}`] = newVal;
      strokeDeltas[coord] = { old: oldVal, new: newVal, target: 'transition' };
    }

    if (state.projectData?.id && Object.keys(firebaseDeltas).length > 0) {
      queueDeltaUpdate(state.projectData.id, firebaseDeltas);
    }

    pattern.transitions = newTransitions;
    newPatterns[patternIndex] = pattern;
    
    const stroke = { patternId: pattern.id, deltas: strokeDeltas };
    const maxHistory = 30;
    const newPast = [...state.past, stroke];
    if (newPast.length > maxHistory) newPast.shift();

    return { 
      patterns: newPatterns,
      past: newPast,
      future: []
    };
  }),
  
  getExportData: () => {
    return get().patterns
  }
}))
