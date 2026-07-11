import { create } from 'zustand'

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

const generateDefaultPattern = (id, name, width, height, color, pos, hasTransition) => {
  const grid = {};
  const transitions = {};
  
  for (let c = 1; c <= width; c++) {
    const colStr = getColName(c);
    for (let r = 1; r <= height; r++) {
      const coord = `${colStr}${r}`;
      grid[coord] = { color, pos };
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
    
    let initialPatterns = data.patterns;
    if (!initialPatterns || initialPatterns.length === 0) {
      initialPatterns = [generateDefaultPattern(Date.now(), 'Pola 1 - Untitled', data.width, data.height, defaultColor, defaultPos, data.hasTransition)];
    }

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
      zoomLevel: 1,
      brushSize: 1,
      past: [],
      future: []
    })
  },

  saveHistory: () => set((state) => {
    const maxHistory = 30; // Limit history to prevent excessive memory usage
    const clonedPatterns = JSON.parse(JSON.stringify(state.patterns));
    const newPast = [...state.past, clonedPatterns];
    if (newPast.length > maxHistory) {
      newPast.shift(); // Remove oldest
    }
    return {
      past: newPast,
      future: [] // Clear future when a new action is performed
    }
  }),

  undo: () => set((state) => {
    if (state.past.length === 0) return state;
    
    const previous = state.past[state.past.length - 1];
    const newPast = state.past.slice(0, state.past.length - 1);
    
    return {
      past: newPast,
      patterns: previous,
      future: [JSON.parse(JSON.stringify(state.patterns)), ...state.future]
    }
  }),

  redo: () => set((state) => {
    if (state.future.length === 0) return state;
    
    const next = state.future[0];
    const newFuture = state.future.slice(1);
    
    return {
      past: [...state.past, JSON.parse(JSON.stringify(state.patterns))],
      patterns: next,
      future: newFuture
    }
  }),

  setToolState: (newState) => set((state) => ({ ...state, ...newState })),
  setHoveredCoord: (coord) => set({ hoveredCoord: coord }),
  setZoomLevel: (level) => set({ zoomLevel: level }),

  addPattern: (indexToInsert = null) => set((state) => {
    const newId = state.patterns.length > 0 ? Math.max(...state.patterns.map(p => p.id)) + 1 : 1;
    const { width, height, hasTransition } = state.projectData;
    const newPattern = generateDefaultPattern(
      newId, 
      `Untitled`, 
      width, 
      height, 
      state.selectedColor, 
      state.selectedPosition, 
      hasTransition
    );
    
    let newPatterns = [...state.patterns];
    if (indexToInsert !== null && indexToInsert >= 0 && indexToInsert <= newPatterns.length) {
      newPatterns.splice(indexToInsert, 0, newPattern);
    } else {
      newPatterns.push(newPattern);
    }
    
    return {
      patterns: newPatterns,
      activePatternId: newId
    }
  }),

  renamePattern: (id, newName) => set((state) => {
    const newPatterns = state.patterns.map(p => 
      p.id === id ? { ...p, name: newName } : p
    );
    return { patterns: newPatterns };
  }),

  movePatternUp: (id) => set((state) => {
    const index = state.patterns.findIndex(p => p.id === id);
    if (index <= 0) return state; // Already at top
    
    const newPatterns = [...state.patterns];
    const temp = newPatterns[index - 1];
    newPatterns[index - 1] = newPatterns[index];
    newPatterns[index] = temp;
    
    return { patterns: newPatterns, activePatternId: id };
  }),

  movePatternDown: (id) => set((state) => {
    const index = state.patterns.findIndex(p => p.id === id);
    if (index === -1 || index === state.patterns.length - 1) return state; // Already at bottom
    
    const newPatterns = [...state.patterns];
    const temp = newPatterns[index + 1];
    newPatterns[index + 1] = newPatterns[index];
    newPatterns[index] = temp;
    
    return { patterns: newPatterns, activePatternId: id };
  }),

  // Action to paint a cell on the grid
  paintCell: (patternId, colStr, rowNum) => set((state) => {
    const patternIndex = state.patterns.findIndex(p => p.id === patternId)
    if (patternIndex === -1) return state

    const newPatterns = [...state.patterns]
    const pattern = { ...newPatterns[patternIndex] }
    
    const centerColIdx = getColIndex(colStr)
    const { width, height } = state.projectData

    const newGrid = { ...pattern.grid }
    const newTransitions = { ...pattern.transitions }

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

        if (state.activeTool === 'eraser') {
          delete newGrid[coord]
          delete newTransitions[coord]
        } else if (state.activeTool === 'brush') {
          newGrid[coord] = { color: state.selectedColor, pos: state.selectedPosition }
        } else if (state.activeTool === 'transition-brush' && state.projectData?.hasTransition) {
          newTransitions[coord] = { step: state.selectedTransitionStep }
        }
      }
    }

    pattern.grid = newGrid
    pattern.transitions = newTransitions

    newPatterns[patternIndex] = pattern
    return { patterns: newPatterns }
  }),

  // Magic Selection / Select logic
  clearMagicSelection: () => set({ magicSelection: [] }),
  setMagicSelection: (selection) => set({ magicSelection: selection }),
  
  selectMagicWand: (patternId, colStr, rowNum) => set((state) => {
    const pattern = state.patterns.find(p => p.id === patternId);
    if (!pattern) return state;

    const { width, height } = state.projectData;
    const startCoord = `${colStr}${rowNum}`;
    const startCell = pattern.grid[startCoord];
    const targetColor = startCell ? startCell.color : null;
    const targetPos = startCell ? startCell.pos : null;
    
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
            const nCell = pattern.grid[nCoord];
            const nColor = nCell ? nCell.color : null;
            const nPos = nCell ? nCell.pos : null;
            if (nColor === targetColor && nPos === targetPos) {
              visited.add(nCoord);
              queue.push(n);
            }
          }
        }
      }
    }
    
    return { magicSelection: selection };
  }),

  fillMagicSelection: (color, pos) => set((state) => {
    if (!state.magicSelection || state.magicSelection.length === 0) return state;
    
    const patternIndex = state.patterns.findIndex(p => p.id === state.activePatternId);
    if (patternIndex === -1) return state;

    const newPatterns = [...state.patterns];
    const pattern = { ...newPatterns[patternIndex] };
    const newGrid = { ...pattern.grid };

    for (const coord of state.magicSelection) {
      newGrid[coord] = { color, pos };
    }

    pattern.grid = newGrid;
    newPatterns[patternIndex] = pattern;
    
    return { 
      patterns: newPatterns
    };
  }),

  fillMagicSelectionTransition: (step) => set((state) => {
    if (!state.magicSelection || state.magicSelection.length === 0) return state;
    
    const patternIndex = state.patterns.findIndex(p => p.id === state.activePatternId);
    if (patternIndex === -1) return state;

    const newPatterns = [...state.patterns];
    const pattern = { ...newPatterns[patternIndex] };
    const newTransitions = { ...pattern.transitions };

    for (const coord of state.magicSelection) {
      newTransitions[coord] = { step };
    }

    pattern.transitions = newTransitions;
    newPatterns[patternIndex] = pattern;
    
    return { 
      patterns: newPatterns
    };
  }),
  
  getExportData: () => {
    return get().patterns
  }
}))
