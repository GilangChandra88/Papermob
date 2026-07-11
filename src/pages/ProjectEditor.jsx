import React, { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getProjectById, updateProjectData } from '../utils/firebaseUtils'
import { useProjectStore } from '../store/projectStore'
import { ArrowLeft, Save, Plus } from 'lucide-react'

import PatternCard from '../components/PatternCard'
import TransitionCard from '../components/TransitionCard'
import ToolsPanel from '../components/ToolsPanel'
import ExportEngine from '../components/ExportEngine'

export default function ProjectEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const store = useProjectStore()
  const { projectData, patterns, initProject, zoomLevel, undo, redo } = store
  const saveTimeoutRef = useRef(null)
  const [saveStatus, setSaveStatus] = useState('Tersimpan')

  useEffect(() => {
    loadProject()
  }, [id])

  // Auto-Save Effect
  useEffect(() => {
    if (!projectData) return;
    
    setSaveStatus('Menyimpan...')
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await updateProjectData(id, { patterns })
        setSaveStatus('Tersimpan')
      } catch (e) {
        console.error(e)
        setSaveStatus('Gagal menyimpan')
      }
    }, 2000)

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [patterns])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  const loadProject = async () => {
    try {
      const data = await getProjectById(id)
      initProject(data)
    } catch (e) {
      console.error(e)
      alert("Gagal memuat projek")
      navigate('/dashboard')
    } finally {
      setLoading(false)
    }
  }

  const handleBack = async () => {
    const confirmSave = window.confirm("Simpan perubahan terakhir dan kembali ke dashboard?")
    if (confirmSave) {
      try {
        setSaving(true)
        setSaveStatus('Menyimpan...')
        await updateProjectData(id, { patterns })
        setSaveStatus('Tersimpan')
        navigate('/dashboard')
      } catch (e) {
        console.error(e)
        alert("Gagal menyimpan projek ke database. Silakan periksa koneksi internet Anda. Anda tidak bisa kembali agar data tidak hilang.")
      } finally {
        setSaving(false)
      }
    }
  }

  if (loading || !projectData) {
    return <div className="app-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading Editor...</div>
  }

  return (
    <div className="app-container" style={{ height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      
      {/* Header */}
      <header style={{ 
        backgroundColor: 'var(--surface)', padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
        boxShadow: 'var(--shadow-sm)', zIndex: 10 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="btn btn-outline" onClick={handleBack} disabled={saving} style={{ padding: '0.4rem' }}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0 }}>{projectData.name}</h1>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {projectData.width} x {projectData.height} | {projectData.hasTransition ? 'Dengan Transisi' : 'Tanpa Transisi'}
              <span style={{ 
                fontSize: '0.75rem', 
                padding: '2px 6px', 
                borderRadius: '12px', 
                backgroundColor: saveStatus === 'Gagal menyimpan' ? '#fee2e2' : 'var(--border-color)',
                color: saveStatus === 'Gagal menyimpan' ? '#ef4444' : 'var(--text-muted)'
              }}>
                {saveStatus}
              </span>
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <ExportEngine projectData={projectData} patterns={patterns} />
        </div>
      </header>

      {/* Main Editor Area */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-color)', overflow: 'hidden' }}>
        
        {/* Tools Panel */}
        <div style={{ padding: '1rem 2rem 0 2rem' }}>
          <ToolsPanel projectData={projectData} />
        </div>

        {/* Canvas Area */}
        <div style={{ flex: 1, overflow: 'auto', padding: '2rem' }}>
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '2rem',
            transform: `scale(${zoomLevel})`,
            transformOrigin: 'top left',
            willChange: 'transform',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            width: 'max-content'
          }}>
            <style>{`
              .insert-divider {
                height: 24px;
                margin: 0.5rem 0;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                transition: opacity 0.2s;
                cursor: pointer;
              }
              .insert-divider:hover {
                opacity: 1;
              }
              .insert-divider .line {
                flex: 1;
                height: 2px;
                background-color: var(--primary);
              }
              .insert-divider button {
                background-color: var(--primary);
                color: white;
                border: none;
                border-radius: 50%;
                width: 28px;
                height: 28px;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 0.5rem;
                cursor: pointer;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              }
            `}</style>

            {patterns.map((pattern, index) => (
              <React.Fragment key={pattern.id}>
                {/* Insert Button Before Pattern (if index > 0) */}
                {index > 0 && (
                  <div className="insert-divider" onClick={() => store.addPattern(index)} title="Tambahkan pola di sini">
                    <div className="line"></div>
                    <button><Plus size={16} /></button>
                    <div className="line"></div>
                  </div>
                )}
                
                <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                  <PatternCard pattern={pattern} index={index} projectData={projectData} />
                  
                  {projectData.hasTransition && (
                    <TransitionCard pattern={pattern} index={index} projectData={projectData} />
                  )}
                </div>
              </React.Fragment>
            ))}

            {/* Add Pattern at End */}
            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center' }}>
              <button 
                className="btn btn-outline" 
                style={{ padding: '1rem 4rem', fontSize: '1.1rem', borderRadius: '8px', borderStyle: 'dashed', borderWidth: '2px', display: 'flex', alignItems: 'center' }} 
                onClick={() => store.addPattern(patterns.length)}
              >
                <Plus size={20} style={{ marginRight: '0.5rem' }} /> Tambah Pola Baru
              </button>
            </div>
          </div>
        </div>

      </main>
    </div>
  )
}
