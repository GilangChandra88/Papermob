import React, { useState } from 'react'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { getColName } from '../store/projectStore'
import { Download } from 'lucide-react'
import { generateCanvasImage } from '../utils/exportUtils'

export default function ExportEngine({ projectData, patterns }) {
  const [isExporting, setIsExporting] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })

  const startExport = async () => {
    if (!projectData || patterns.length === 0) return

    setIsExporting(true)
    const { width, height, name } = projectData
    
    const coordinates = []
    for (let r = 1; r <= height; r++) {
      for (let c = 1; c <= width; c++) {
        coordinates.push(`${getColName(c)}${r}`)
      }
    }

    setProgress({ current: 0, total: coordinates.length })
    const zip = new JSZip()
    const folder = zip.folder(`Papermob_${name}`)

    // Use pure Canvas generation loop
    for (let i = 0; i < coordinates.length; i++) {
      const coord = coordinates[i]
      
      try {
        const base64Data = await generateCanvasImage(coord, patterns, projectData)
        folder.file(`Instruksi_${coord}.jpg`, base64Data, { base64: true })
      } catch (err) {
        console.error(`Error generating image for ${coord}`, err)
      }
      
      // Update progress. A small timeout every 50 images to prevent blocking the UI thread completely
      if (i % 50 === 0) {
        setProgress({ current: i + 1, total: coordinates.length })
        await new Promise(resolve => setTimeout(resolve, 10))
      }
    }

    setProgress({ current: coordinates.length, total: coordinates.length })

    try {
      const content = await zip.generateAsync({ type: "blob" })
      saveAs(content, `Papermob_${name}_Export.zip`)
    } catch (e) {
      console.error("Error zipping files", e)
      alert("Terjadi kesalahan saat menyatukan file zip (mungkin karena jumlah file terlalu banyak).")
    }

    setIsExporting(false)
  }

  return (
    <>
      <button 
        className="btn btn-primary" 
        onClick={startExport} 
        disabled={isExporting}
      >
        <Download size={18} />
        {isExporting ? `Mengekspor... (${progress.current}/${progress.total})` : 'Export Desain (ZIP)'}
      </button>
    </>
  )
}
