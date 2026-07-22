import React from 'react'
import { useProjectStore } from '../store/projectStore'
import { Paintbrush, Eraser, Settings2, Plus, ZoomIn, ZoomOut, Undo, Redo, Wand2, Edit3, Pointer, Copy, ClipboardPaste } from 'lucide-react'

export default function ToolsPanel({ projectData }) {
  const store = useProjectStore()
  const { activeTool, selectedColor, selectedPosition, selectedTransitionStep, patterns, activePatternId, zoomLevel, setZoomLevel, brushSize, past, future, undo, redo, magicSelection, copySelection, pasteSelection, clipboardData } = store
  const { colors, positions, hasTransition, transitionSteps } = projectData

  const [flashCopy, setFlashCopy] = React.useState(false)
  const [flashPaste, setFlashPaste] = React.useState(false)

  React.useEffect(() => {
    const handleCopyFlash = () => {
      setFlashCopy(true)
      setTimeout(() => setFlashCopy(false), 200)
    }
    const handlePasteFlash = () => {
      setFlashPaste(true)
      setTimeout(() => setFlashPaste(false), 200)
    }
    window.addEventListener('copy-flash', handleCopyFlash)
    window.addEventListener('paste-flash', handlePasteFlash)
    return () => {
      window.removeEventListener('copy-flash', handleCopyFlash)
      window.removeEventListener('paste-flash', handlePasteFlash)
    }
  }, [])

  return (
    <div className="card glass" style={{ marginBottom: '1.5rem', display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'center' }}>
      
      {/* Tools */}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button 
          className={`btn ${activeTool === 'select' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => {
            store.setToolState({ activeTool: 'select' })
          }}
          title="Selection (Seleksi)&#10;Klik atau drag untuk menyeleksi banyak kotak sekaligus."
          style={{ padding: '0.6rem' }}
        >
          <Pointer size={18} />
        </button>

        <button 
          className={`btn ${activeTool === 'brush' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => {
            store.setToolState({ activeTool: 'brush' })
            if (magicSelection?.length > 0) store.clearMagicSelection()
          }}
          title="Brush Pola&#10;Mewarnai kotak dengan warna & posisi terpilih."
          style={{ padding: '0.6rem' }}
        >
          <Paintbrush size={18} />
        </button>
        


        <button 
          className={`btn ${activeTool === 'magic-wand' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => {
            store.setToolState({ activeTool: 'magic-wand' })
          }}
          title="Magic Wand (Pemilihan Ajaib)&#10;Pilih area terhubung, lalu klik warna di palet untuk menggantinya sekaligus."
          style={{ padding: '0.6rem' }}
        >
          <Wand2 size={18} />
        </button>

        {/* Copy / Paste */}
        {(activeTool === 'select' || activeTool === 'magic-wand') && (
          <div style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '0.5rem', display: 'flex', gap: '0.5rem' }}>
            <button
              className="btn btn-outline"
              disabled={!magicSelection || magicSelection.length === 0}
              onClick={() => {
                copySelection()
                window.dispatchEvent(new Event('copy-flash'))
                window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Tersalin ke Clipboard!' }))
              }}
              style={{ 
                padding: '0.6rem', 
                opacity: (!magicSelection || magicSelection.length === 0) ? 0.5 : 1,
                backgroundColor: flashCopy ? 'var(--primary)' : 'transparent',
                color: flashCopy ? 'white' : 'inherit',
                transition: 'background-color 0.1s'
              }}
              title="Copy (Ctrl+C)"
            >
              <Copy size={18} />
            </button>
            
            <button
              className="btn btn-outline"
              disabled={!clipboardData || (!magicSelection || magicSelection.length === 0)}
              onClick={() => {
                pasteSelection()
                window.dispatchEvent(new Event('paste-flash'))
                window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Berhasil dipaste!' }))
              }}
              style={{ 
                padding: '0.6rem', 
                opacity: (!clipboardData || !magicSelection || magicSelection.length === 0) ? 0.5 : 1,
                backgroundColor: flashPaste ? 'var(--success)' : 'transparent',
                color: flashPaste ? 'white' : 'inherit',
                transition: 'background-color 0.1s'
              }}
              title="Paste (Ctrl+V)"
            >
              <ClipboardPaste size={18} />
            </button>
          </div>
        )}
      </div>

      {/* Brush Settings */}
      {(activeTool === 'brush' || activeTool === 'magic-wand' || activeTool === 'select') && (
        <div style={{ display: 'flex', gap: '1.5rem', marginLeft: 'auto' }}>
          <div>
            <p style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Warna</p>
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              {colors.map(color => (
                <div 
                  key={color}
                  onClick={() => {
                    store.setToolState({ selectedColor: color })
                    if (magicSelection?.length > 0) {
                      store.fillMagicSelection(color, selectedPosition)
                    }
                  }}
                  style={{
                    width: '24px', height: '24px', borderRadius: '50%', backgroundColor: color,
                    border: selectedColor === color ? '2px solid var(--text-main)' : '1px solid #ccc',
                    cursor: 'pointer'
                  }}
                />
              ))}
            </div>
          </div>

          <div>
            <p style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Posisi</p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {positions.includes('jongkok') && (
                <button 
                  className={`btn ${selectedPosition === 'J' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => {
                    store.setToolState({ selectedPosition: 'J' })
                    if (magicSelection?.length > 0) {
                      store.fillMagicSelection(selectedColor, 'J')
                    }
                  }}
                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                >
                  Jongkok (Gelap)
                </button>
              )}
              {positions.includes('berdiri') && (
                <button 
                  className={`btn ${selectedPosition === 'B' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => {
                    store.setToolState({ selectedPosition: 'B' })
                    if (magicSelection?.length > 0) {
                      store.fillMagicSelection(selectedColor, 'B')
                    }
                  }}
                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                >
                  Berdiri (Terang)
                </button>
              )}
            </div>
          </div>
          {hasTransition && (
            <div>
              <p style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Step Transisi</p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {Array.from({ length: transitionSteps }, (_, i) => i + 1).map(step => (
                  <button
                    key={step}
                    className={`btn ${selectedTransitionStep === step ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => {
                      store.setToolState({ selectedTransitionStep: step })
                      if (magicSelection?.length > 0) {
                        store.fillMagicSelectionTransition(step)
                      }
                    }}
                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                  >
                    Step {step}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Brush Size */}
      {activeTool === 'brush' && (
        <div style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '2rem' }}>
          <p style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Ukuran Brush</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input 
              type="range" 
              min="1" 
              max="20" 
              value={brushSize} 
              onChange={(e) => store.setToolState({ brushSize: parseInt(e.target.value) })}
              style={{ width: '80px' }}
            />
            <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{brushSize}x{brushSize}</span>
          </div>
        </div>
      )}

      {/* History Controls */}
      <div style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '2rem', marginLeft: '0' }}>
        <p style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Riwayat</p>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            className="btn btn-outline" 
            onClick={undo}
            disabled={past.length === 0}
            style={{ padding: '0.5rem', opacity: past.length === 0 ? 0.5 : 1 }}
            title="Undo (Ctrl+Z)"
          >
            <Undo size={18} />
          </button>
          <button 
            className="btn btn-outline" 
            onClick={redo}
            disabled={future.length === 0}
            style={{ padding: '0.5rem', opacity: future.length === 0 ? 0.5 : 1 }}
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo size={18} />
          </button>
        </div>
      </div>

      {/* Zoom Controls */}
      <div style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '2rem', marginLeft: '0' }}>
        <p style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Zoom: {Math.round(zoomLevel * 100)}%</p>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button 
            className="btn btn-outline" 
            onClick={() => setZoomLevel(Math.max(0.1, zoomLevel - 0.1))}
            style={{ padding: '0.4rem' }}
            title="Zoom Out"
          >
            <ZoomOut size={16} />
          </button>
          <button 
            className="btn btn-outline" 
            onClick={() => setZoomLevel(1)}
            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
            title="Reset Zoom"
          >
            Reset
          </button>
          <button 
            className="btn btn-outline" 
            onClick={() => setZoomLevel(Math.min(3, zoomLevel + 0.1))}
            style={{ padding: '0.4rem' }}
            title="Zoom In"
          >
            <ZoomIn size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

