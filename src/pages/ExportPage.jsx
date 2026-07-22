import React, { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getProjectById, updateProjectData } from '../utils/firebaseUtils'
import { getColName, useProjectStore } from '../store/projectStore'
import { generateCanvasImage } from '../utils/exportUtils'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { jsPDF } from 'jspdf'
import { ArrowLeft, Download, FileText, Settings, Layers } from 'lucide-react'

// Constants for paper sizes (in mm)
const PAPER_SIZES = {
  'A4': { width: 210, height: 297, name: 'A4 (210 x 297 mm)' },
  'F4': { width: 215, height: 330, name: 'F4 / HVS (215 x 330 mm)' }
}

export default function ExportPage({ user }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const store = useProjectStore()
  
  const [projectData, setProjectData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0, text: '' })

  // Settings
  const [selectedCol, setSelectedCol] = useState(1) // Column index 1 = A
  const [paperType, setPaperType] = useState('A4')
  const [orientation, setOrientation] = useState('portrait')
  
  // Previews
  const [columnImages, setColumnImages] = useState({})
  const [generatingPreviews, setGeneratingPreviews] = useState(false)
  const [previewZoom, setPreviewZoom] = useState(0.5) // Default zoom for collage
  
  // Design Dimensions (default 90x130mm which is a good 3:4-ish ratio card)
  const [cardWidth, setCardWidth] = useState(90)
  const [cardHeight, setCardHeight] = useState(130)
  const [lockRatio, setLockRatio] = useState(true)
  const [ratio, setRatio] = useState(90 / 130)
  
  const [gap, setGap] = useState(2) // 2mm gap default
  const [guideThickness, setGuideThickness] = useState(0.2) // Default 0.2mm
  const margin = 10 // Fixed 10mm margin around the paper
  
  const [isInitialized, setIsInitialized] = useState(false)

  // Fetch project data (similar to ProjectEditor)
  useEffect(() => {
    const fetchProject = async () => {
      try {
        const data = await getProjectById(id)
        
        // Load saved settings if they exist
        if (data.exportSettings) {
          if (data.exportSettings.paperType) setPaperType(data.exportSettings.paperType)
          if (data.exportSettings.orientation) setOrientation(data.exportSettings.orientation)
          if (data.exportSettings.cardWidth) setCardWidth(data.exportSettings.cardWidth)
          if (data.exportSettings.cardHeight) setCardHeight(data.exportSettings.cardHeight)
          if (data.exportSettings.lockRatio !== undefined) setLockRatio(data.exportSettings.lockRatio)
          if (data.exportSettings.gap !== undefined) setGap(data.exportSettings.gap)
          if (data.exportSettings.guideThickness !== undefined) setGuideThickness(data.exportSettings.guideThickness)
        }
        
        setProjectData(data)
        // Ensure store has the patterns loaded
        if (data.patternsMap && data.patternOrder) {
          const patterns = data.patternOrder.map(pid => data.patternsMap[pid]).filter(Boolean)
          store.setToolState({ patterns, projectData: data })
        }
      } catch (err) {
        console.error(err)
        alert('Gagal memuat proyek')
      } finally {
        setLoading(false)
        setIsInitialized(true)
      }
    }
    fetchProject()
  }, [id])

  // Generate previews for the selected column
  useEffect(() => {
    if (!projectData || store.patterns.length === 0) return
    let isMounted = true

    const fetchPreviews = async () => {
      setGeneratingPreviews(true)
      const colStr = getColName(selectedCol)
      const images = {}
      
      for(let r = 1; r <= projectData.height; r++) {
         if (!isMounted) break
         const coord = `${colStr}${r}`
         try {
           const b64 = await generateCanvasImage(coord, store.patterns, projectData)
           images[coord] = `data:image/jpeg;base64,${b64}`
         } catch(e) {
           console.error('Error generating preview for', coord, e)
         }
      }
      
      if (isMounted) {
        setColumnImages(images)
        setGeneratingPreviews(false)
      }
    }
    
    fetchPreviews()
    return () => { isMounted = false }
  }, [selectedCol, projectData, store.patterns])

  // Save settings to database automatically (debounced)
  useEffect(() => {
    if (!isInitialized || !id) return
    const timer = setTimeout(() => {
      updateProjectData(id, {
        exportSettings: {
          paperType,
          orientation,
          cardWidth,
          cardHeight,
          lockRatio,
          gap,
          guideThickness
        }
      }).catch(err => console.error('Failed to save export settings', err))
    }, 1000)
    
    return () => clearTimeout(timer)
  }, [paperType, orientation, cardWidth, cardHeight, lockRatio, gap, guideThickness, id, isInitialized])

  // Handle aspect ratio lock
  const handleWidthChange = (val) => {
    setCardWidth(val)
    if (lockRatio) setCardHeight(parseFloat((val / ratio).toFixed(1)))
  }
  const handleHeightChange = (val) => {
    setCardHeight(val)
    if (lockRatio) setCardWidth(parseFloat((val * ratio).toFixed(1)))
  }
  const toggleLockRatio = () => {
    if (!lockRatio) {
      setRatio(cardWidth / cardHeight)
    }
    setLockRatio(!lockRatio)
  }

  // Layout Calculations
  const layout = useMemo(() => {
    if (!projectData) return null
    
    const paper = PAPER_SIZES[paperType]
    
    // Swap dimensions if landscape
    const pWidth = orientation === 'landscape' ? paper.height : paper.width
    const pHeight = orientation === 'landscape' ? paper.width : paper.height
    
    const usableWidth = pWidth - (2 * margin)
    const usableHeight = pHeight - (2 * margin)
    
    // Calculate how many fit
    const cols = Math.max(1, Math.floor((usableWidth + gap) / (cardWidth + gap)))
    const rows = Math.max(1, Math.floor((usableHeight + gap) / (cardHeight + gap)))
    
    const itemsPerPage = cols * rows
    const totalItems = projectData.height // Number of rows in a column
    const totalPages = Math.ceil(totalItems / itemsPerPage)
    
    return {
      paper, pWidth, pHeight, cols, rows, itemsPerPage, totalItems, totalPages,
      usableWidth, usableHeight
    }
  }, [paperType, orientation, cardWidth, cardHeight, gap, projectData])

  // Generate Cut-And-Stack Layout array for Preview
  const previewPages = useMemo(() => {
    if (!layout) return []
    const pages = []
    
    for (let p = 0; p < layout.totalPages; p++) {
      const pageSlots = []
      for (let r = 0; r < layout.rows; r++) {
        for (let c = 0; c < layout.cols; c++) {
          const slotIndex = r * layout.cols + c
          // Cut and stack logic:
          const itemIndex = slotIndex * layout.totalPages + p
          
          if (itemIndex < layout.totalItems) {
            // itemIndex is 0-based. Convert to row coordinate (1-based)
            const rowCoord = itemIndex + 1
            pageSlots.push({ slotIndex, rowCoord, r, c })
          } else {
            pageSlots.push({ slotIndex, rowCoord: null, r, c })
          }
        }
      }
      pages.push(pageSlots)
    }
    return pages
  }, [layout])

  const handleExportIndividual = async () => {
    if (!projectData || store.patterns.length === 0) return

    setIsExporting(true)
    const { width, height, name } = projectData
    
    const coordinates = []
    for (let r = 1; r <= height; r++) {
      for (let c = 1; c <= width; c++) {
        coordinates.push(`${getColName(c)}${r}`)
      }
    }

    setProgress({ current: 0, total: coordinates.length, text: 'Mengekspor gambar individual...' })
    const zip = new JSZip()
    const folder = zip.folder(`Papermob_${name}`)

    for (let i = 0; i < coordinates.length; i++) {
      const coord = coordinates[i]
      try {
        const base64Data = await generateCanvasImage(coord, store.patterns, projectData)
        folder.file(`Instruksi_${coord}.jpg`, base64Data, { base64: true })
      } catch (err) {
        console.error(`Error generating image for ${coord}`, err)
      }
      if (i % 20 === 0) {
        setProgress(prev => ({ ...prev, current: i + 1 }))
        await new Promise(resolve => setTimeout(resolve, 10))
      }
    }

    setProgress(prev => ({ ...prev, text: 'Menyusun file ZIP...' }))
    try {
      const content = await zip.generateAsync({ type: "blob" })
      saveAs(content, `Papermob_${name}_Export_Semua.zip`)
    } catch (e) {
      console.error("Error zipping files", e)
      alert("Terjadi kesalahan saat menyatukan file zip.")
    }

    setIsExporting(false)
  }

  const handleExportPDF = async () => {
    if (!projectData || store.patterns.length === 0 || !layout) return
    setIsExporting(true)
    
    const { width: totalCols, height: totalRows, name } = projectData
    const zip = new JSZip()
    const folder = zip.folder(`Kolase_${name}`)
    
    setProgress({ current: 0, total: totalCols, text: 'Memulai generate PDF...' })

    // Loop through all columns
    for (let colIdx = 1; colIdx <= totalCols; colIdx++) {
      const colStr = getColName(colIdx)
      setProgress({ current: colIdx, total: totalCols, text: `Mengekspor Kolom ${colStr} ke PDF...` })
      await new Promise(resolve => setTimeout(resolve, 50)) // UI refresh
      
      const pdf = new jsPDF({
        orientation: orientation,
        unit: 'mm',
        format: paperType.toLowerCase() === 'f4' ? [215, 330] : 'a4'
      })
      
      const totalContentWidth = layout.cols * cardWidth + (layout.cols - 1) * gap
      const totalContentHeight = layout.rows * cardHeight + (layout.rows - 1) * gap
      const startX = margin + (layout.usableWidth - totalContentWidth) / 2
      const startY = margin + (layout.usableHeight - totalContentHeight) / 2

      for (let p = 0; p < layout.totalPages; p++) {
        if (p > 0) pdf.addPage()
        
        for (let r = 0; r < layout.rows; r++) {
          for (let c = 0; c < layout.cols; c++) {
            const slotIndex = r * layout.cols + c
            const itemIndex = slotIndex * layout.totalPages + p
            
            if (itemIndex < totalRows) {
              const rowCoord = itemIndex + 1
              const coord = `${colStr}${rowCoord}`
              
              try {
                // generateCanvasImage in our app actually returns a base64 string without the prefix
                const base64Data = await generateCanvasImage(coord, store.patterns, projectData)
                const dataUri = `data:image/jpeg;base64,${base64Data}`
                
                const x = startX + c * (cardWidth + gap)
                const y = startY + r * (cardHeight + gap)
                
                pdf.addImage(dataUri, 'JPEG', x, y, cardWidth, cardHeight)
                
                // Add a border guide line to help cutting
                if (guideThickness > 0) {
                  pdf.setDrawColor(200, 200, 200)
                  pdf.setLineWidth(guideThickness)
                  pdf.rect(x, y, cardWidth, cardHeight)
                }
                
              } catch (err) {
                console.error(`Error on PDF ${coord}`, err)
              }
            }
          }
        }
      }
      
      const pdfBlob = pdf.output('blob')
      folder.file(`Kolom_${colStr}.pdf`, pdfBlob)
    }

    setProgress(prev => ({ ...prev, text: 'Menyusun file ZIP...' }))
    try {
      const content = await zip.generateAsync({ type: "blob" })
      saveAs(content, `Kolase_${name}_Lengkap.zip`)
    } catch (e) {
      console.error("Error zipping files", e)
      alert("Terjadi kesalahan saat menyatukan file zip.")
    }
    
    setIsExporting(false)
  }

  if (loading || !projectData) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-app)' }}>
        <p>Memuat Pengaturan Export...</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100vh', flexDirection: 'column', background: 'var(--bg-app)' }}>
      {/* Header */}
      <div style={{ padding: '1rem 2rem', background: 'rgba(255, 255, 255, 0.8)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backdropFilter: 'blur(10px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="btn btn-outline" onClick={() => navigate(`/project/${id}`)}>
            <ArrowLeft size={18} /> Kembali
          </button>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Export & Cetak Kolase</h1>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{projectData.name}</p>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* Left Panel: Individual Previews */}
        <div style={{ width: '320px', background: '#f8fafc', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', background: 'white' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
              Preview Desain {getColName(selectedCol)}
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>
              Isi baris dari koordinat {getColName(selectedCol)}1 hingga {getColName(selectedCol)}{projectData.height}
            </p>
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {generatingPreviews ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                <p>Memuat desain...</p>
              </div>
            ) : (
              Array.from({ length: projectData.height }, (_, i) => i + 1).map(rowIdx => {
                const coord = `${getColName(selectedCol)}${rowIdx}`
                return (
                  <div key={coord} style={{ background: 'white', padding: '1rem', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}>
                    <p style={{ fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '0.5rem', color: '#475569' }}>Koordinat: {coord}</p>
                    {columnImages[coord] ? (
                      <img src={columnImages[coord]} alt={coord} style={{ width: '100%', height: 'auto', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                    ) : (
                      <div style={{ width: '100%', height: '150px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px' }}>
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Gagal memuat</span>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Center Panel: Collage Layout Preview */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '2rem', background: '#e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem' }}>
          
          <div style={{ alignSelf: 'flex-start', width: '100%', maxWidth: '800px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                Layout Kolase Halaman
              </h2>
              <p style={{ fontSize: '0.875rem', color: '#64748b' }}>
                Simulasi hasil print pada kertas {PAPER_SIZES[paperType].name}.
              </p>
            </div>
            
            {/* Zoom Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'white', padding: '0.5rem 1rem', borderRadius: '8px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', border: '1px solid #cbd5e1' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#475569' }}>Zoom:</span>
              <input 
                type="range" 
                min="0.2" max="2" step="0.1" 
                value={previewZoom} 
                onChange={(e) => setPreviewZoom(parseFloat(e.target.value))}
                style={{ width: '100px' }}
              />
              <span style={{ fontSize: '0.875rem', color: '#64748b', width: '40px', textAlign: 'right' }}>
                {Math.round(previewZoom * 100)}%
              </span>
            </div>
          </div>
          
          {layout && previewPages.map((pageSlots, pageIdx) => (
            <div key={pageIdx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2rem' }}>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: '500' }}>
                Halaman {pageIdx + 1}
              </p>
              
              {/* Wrapper to reserve exact scaled space in DOM */}
              <div style={{
                width: `${layout.pWidth * previewZoom}px`,
                height: `${layout.pHeight * previewZoom}px`,
                position: 'relative'
              }}>
                {/* Paper representation */}
                <div style={{
                  width: `${layout.pWidth}px`,
                  height: `${layout.pHeight}px`,
                  background: 'white',
                  boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  transform: `scale(${previewZoom})`, 
                  transformOrigin: 'top left'
                }}>
                  {/* Usable Area / Content Area (centered) */}
                  <div style={{
                    position: 'absolute',
                    top: `${margin + (layout.usableHeight - (layout.rows * cardHeight + (layout.rows - 1) * gap)) / 2}px`,
                    left: `${margin + (layout.usableWidth - (layout.cols * cardWidth + (layout.cols - 1) * gap)) / 2}px`,
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: `${gap}px`,
                    width: `${layout.cols * cardWidth + (layout.cols - 1) * gap}px`,
                    height: `${layout.rows * cardHeight + (layout.rows - 1) * gap}px`,
                  }}>
                    {pageSlots.map((slot, i) => {
                      const coord = slot.rowCoord ? `${getColName(selectedCol)}${slot.rowCoord}` : null
                      const imgSrc = coord ? columnImages[coord] : null
                      return (
                        <div key={i} style={{
                          width: `${cardWidth}px`,
                          height: `${cardHeight}px`,
                          border: slot.rowCoord 
                            ? (guideThickness > 0 ? `${Math.max(1, guideThickness)}px solid #94a3b8` : (imgSrc ? 'none' : '1px dashed #94a3b8')) 
                            : 'none',
                          background: slot.rowCoord ? (imgSrc ? 'transparent' : '#f8fafc') : 'transparent',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          visibility: slot.rowCoord ? 'visible' : 'hidden',
                          overflow: 'hidden',
                          boxSizing: 'border-box'
                        }}>
                          {imgSrc ? (
                            <img src={imgSrc} alt={coord} style={{ width: '100%', height: '100%', objectFit: 'fill' }} />
                          ) : (
                            <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#475569' }}>
                              {coord}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Right Panel: Settings */}
        <div style={{ width: '400px', background: 'white', borderLeft: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Settings size={20} /> Pengaturan Cetak
            </h2>
          </div>
          
          <div style={{ padding: '1.5rem', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Kolom Preview</label>
              <select className="form-control" value={selectedCol} onChange={e => setSelectedCol(parseInt(e.target.value))}>
                {Array.from({ length: projectData.width }, (_, i) => i + 1).map(colIdx => (
                  <option key={colIdx} value={colIdx}>Preview Kolom {getColName(colIdx)}</option>
                ))}
              </select>
              <span className="text-muted" style={{ fontSize: '0.75rem', display: 'block', marginTop: '0.5rem', color: '#64748b' }}>
                Hanya untuk mengganti tampilan preview. Tombol export akan otomatis men-generate seluruh kolom A s/d {getColName(projectData.width)}.
              </span>
            </div>
            
            <hr style={{ border: 0, borderTop: '1px solid var(--border-color)', margin: '0' }} />

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Ukuran Kertas</label>
              <select className="form-control" value={paperType} onChange={e => setPaperType(e.target.value)}>
                {Object.keys(PAPER_SIZES).map(key => (
                  <option key={key} value={key}>{PAPER_SIZES[key].name}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Orientasi</label>
              <select className="form-control" value={orientation} onChange={e => setOrientation(e.target.value)}>
                <option value="portrait">Potrait (Berdiri)</option>
                <option value="landscape">Landscape (Tidur)</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                Dimensi Desain (mm)
                <button 
                  type="button" 
                  onClick={toggleLockRatio}
                  style={{ background: 'none', border: 'none', color: lockRatio ? 'var(--primary)' : '#94a3b8', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}
                >
                  {lockRatio ? '🔒 TERKUNCI' : '🔓 BEBAS'}
                </button>
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input 
                  type="number" className="form-control" 
                  value={cardWidth} onChange={e => handleWidthChange(parseFloat(e.target.value) || 0)} 
                  min="10" max={PAPER_SIZES[paperType].width} 
                  placeholder="Lebar"
                />
                <span style={{ color: '#64748b' }}>x</span>
                <input 
                  type="number" className="form-control" 
                  value={cardHeight} onChange={e => handleHeightChange(parseFloat(e.target.value) || 0)} 
                  min="10" max={PAPER_SIZES[paperType].height}
                  placeholder="Tinggi"
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Gap / Jarak Antar Desain (mm)</label>
              <input 
                type="number" className="form-control" 
                value={gap} onChange={e => setGap(parseFloat(e.target.value) || 0)} 
                min="0" max="50"
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Tebal Garis Potong (mm) - <span style={{fontWeight: 'normal'}}>0 untuk hilangkan</span></label>
              <input 
                type="number" className="form-control" 
                value={guideThickness} onChange={e => setGuideThickness(parseFloat(e.target.value))} 
                min="0" max="5" step="0.1"
              />
            </div>

            {layout && (
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.875rem' }}>
                <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold', color: 'var(--text-main)' }}>Informasi Layout</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', color: '#475569' }}>
                  <span>Susunan:</span> <span style={{ fontWeight: 600 }}>{layout.cols} Kolom x {layout.rows} Baris</span>
                  <span>Muat per Halaman:</span> <span style={{ fontWeight: 600 }}>{layout.itemsPerPage} desain</span>
                  <span>Total Kertas (1 Kolom):</span> <span style={{ fontWeight: 600 }}>{layout.totalPages} lembar</span>
                </div>
              </div>
            )}
            
            <hr style={{ border: 0, borderTop: '1px solid var(--border-color)', margin: '0' }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: 'auto' }}>
              <button 
                className="btn btn-primary" 
                style={{ width: '100%', padding: '1rem', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                onClick={handleExportPDF}
                disabled={isExporting}
              >
                <Layers size={20} style={{ marginRight: '0.5rem' }} />
                Export Kolase (PDF per Kolom)
              </button>
              
              <button 
                className="btn btn-outline" 
                style={{ width: '100%', padding: '0.75rem', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                onClick={handleExportIndividual}
                disabled={isExporting}
              >
                <FileText size={18} style={{ marginRight: '0.5rem' }} />
                Export Gambar (Satu-Satu)
              </button>
            </div>
            
            {isExporting && (
              <div style={{ marginTop: '0', padding: '1rem', background: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold', color: '#1e40af', fontSize: '0.875rem' }}>{progress.text}</p>
                <div style={{ width: '100%', height: '8px', background: '#dbeafe', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${(progress.current / progress.total) * 100}%`, height: '100%', background: '#3b82f6', transition: 'width 0.2s' }}></div>
                </div>
                <p style={{ margin: '0.5rem 0 0 0', color: '#1e40af', fontSize: '0.75rem', textAlign: 'right' }}>
                  {progress.current} / {progress.total}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
