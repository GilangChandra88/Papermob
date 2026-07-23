import React, { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getProjectById, updateProjectData, subscribeToProject, hasPendingUpdates } from '../utils/firebaseUtils'
import { useProjectStore } from '../store/projectStore'
import { ArrowLeft, Save, Plus, Play, CheckCircle2, Share2, RotateCcw, Download } from 'lucide-react'

import PatternCard from '../components/PatternCard'
import TransitionCard from '../components/TransitionCard'
import ToolsPanel from '../components/ToolsPanel'
import ShareModal from '../components/ShareModal'
import RecoveryModal from '../components/RecoveryModal'
import LiveCursors from '../components/LiveCursors'

export default function ProjectEditor({ user }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toastMessage, setToastMessage] = useState('')

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 2000)
  }
  
  const store = useProjectStore()
  const { projectData, patterns, initProject, zoomLevel, undo, redo } = store
  const [showShareModal, setShowShareModal] = useState(false)
  const [showRecoveryModal, setShowRecoveryModal] = useState(false)
  const [patternToDelete, setPatternToDelete] = useState(null)

  // Access Control Logic
  const isOwner = user?.uid === projectData?.userId;
  const sharedWithUser = projectData?.sharedWith?.[user?.email];
  const isEditor = isOwner || sharedWithUser?.role === 'editor' || projectData?.sharingSettings?.mode === 'link_editor';
  const isViewer = !isEditor && (sharedWithUser?.role === 'viewer' || projectData?.sharingSettings?.mode === 'link_viewer');

  // Real-time listener for project data
  useEffect(() => {
    const unsubscribe = subscribeToProject(id, (newData) => {
      const currentStore = useProjectStore.getState();

      // If projectData is not yet loaded, initialize it normally.
      // But actually, loadProject() does this too, so they might race.
      // To be safe, if we haven't loaded it, we use initProject.
      if (!currentStore.projectData || currentStore.projectData.id !== id) {
        currentStore.initProject(newData);
      } else {
        // For real-time updates from other users, ONLY update patterns and projectData
        // DO NOT reset activePatternId, zoomLevel, selectedColor, etc.
        // Reconstruct the array from patternsMap if it exists (Delta Updates Architecture)
        let serverPatterns = null;
        if (newData.patternsMap && Array.isArray(newData.patternOrder)) {
          serverPatterns = newData.patternOrder.map(id => newData.patternsMap[id]).filter(Boolean);
        } else if (Array.isArray(newData.patterns)) {
          serverPatterns = newData.patterns.filter(Boolean);
        }

        if (serverPatterns) {
          // If we have pending local updates, we don't overwrite local patterns with incoming server data 
          // because it would wipe out our unsaved drawing for a split second (flicker).
          // Once our updates are flushed, the server will confirm them and trigger a new snapshot.
          if (hasPendingUpdates()) {
            currentStore.setToolState({ projectData: newData });
          } else {
            currentStore.setToolState({ 
              patterns: serverPatterns,
              projectData: newData 
            });
          }
        } else {
           currentStore.setToolState({ projectData: newData });
        }
      }
    });

    return () => unsubscribe();
  }, [id]);

  useEffect(() => {
    loadProject()
  }, [id])

  // Auto-Backup Check Effect (Runs every 1 minute to see if 15 mins passed)
  useEffect(() => {
    if (!projectData || !isOwner) return; // Only owner performs auto backup to prevent duplicates
    
    const interval = setInterval(() => {
      const lastBackupTime = projectData.lastBackupAt ? (typeof projectData.lastBackupAt.toMillis === 'function' ? projectData.lastBackupAt.toMillis() : 0) : 0;
      const now = Date.now();
      
      if (now - lastBackupTime > 15 * 60 * 1000) {
        // If 15 minutes have passed, trigger backup using the CURRENT patterns state
        const currentPatterns = useProjectStore.getState().patterns;
        if (currentPatterns && currentPatterns.length > 0) {
          import('../utils/firebaseUtils').then(({ createBackup }) => {
            createBackup(id, currentPatterns, "Auto Backup");
          });
        }
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [id, isOwner, projectData]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      const currentState = useProjectStore.getState();

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          currentState.redo();
        } else {
          currentState.undo();
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        if (currentState.activeTool === 'select' || currentState.activeTool === 'magic-wand') {
          e.preventDefault();
          currentState.copySelection();
          window.dispatchEvent(new Event('copy-flash'));
          showToast('Tersalin ke Clipboard!');
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        if (currentState.activeTool === 'select' || currentState.activeTool === 'magic-wand') {
          e.preventDefault();
          currentState.pasteSelection();
          window.dispatchEvent(new Event('paste-flash'));
          showToast('Berhasil dipaste!');
        }
      }
    };

    const handleShowToast = (e) => {
      showToast(e.detail);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('show-toast', handleShowToast);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('show-toast', handleShowToast);
    };
  }, []);

  const loadProject = async () => {
    try {
      const data = await getProjectById(id)
      initProject(data)
    } catch (e) {
      console.error(e)
      alert("Gagal memuat projek: " + e.message)
      navigate('/dashboard')
    } finally {
      setLoading(false)
    }
  }

  const handleBack = async () => {
    // Delta updates handle real-time saving. We just need to wait if there's a sync in progress.
    if (hasPendingUpdates()) {
      setSaving(true)
      
      // Wait up to 3 seconds for sync to finish
      let attempts = 0;
      while (hasPendingUpdates() && attempts < 15) {
        await new Promise(resolve => setTimeout(resolve, 200));
        attempts++;
      }
      setSaving(false)
    }
    navigate('/dashboard')
  }

  if (loading || !projectData) {
    return <div className="app-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading Editor...</div>
  }

  if (!isOwner && !isEditor && !isViewer) {
    return (
      <div className="app-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
        <h2>Akses Ditolak</h2>
        <p>Anda tidak memiliki akses ke projek ini.</p>
        <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>Kembali ke Dashboard</button>
      </div>
    );
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
                backgroundColor: 'var(--border-color)',
                color: 'var(--text-muted)'
              }}>
                Disinkronkan secara Real-Time
              </span>
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {isOwner && (
            <>
              <button className="btn btn-outline" onClick={() => setShowRecoveryModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderColor: '#ef4444', color: '#ef4444' }}>
                <RotateCcw size={16} /> Recovery
              </button>
              <button className="btn btn-outline" onClick={() => setShowShareModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Share2 size={16} /> Bagikan
              </button>
            </>
          )}
          <button 
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#3b82f6' }}
            onClick={() => navigate(`/project/${id}/simulation`)}
          >
            <Play size={18} fill="currentColor" /> Simulasi
          </button>
          <button 
            className="btn btn-primary" 
            onClick={() => navigate(`/project/${id}/export`)}
            title="Buka Halaman Export (Cetak & Kolase)"
          >
            <Download size={18} /> Export Desain (ZIP / Kolase)
          </button>
        </div>
      </header>

      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'var(--success)',
          color: 'white',
          padding: '0.5rem 1rem',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          zIndex: 9999,
          animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
        }}>
          <CheckCircle2 size={18} />
          {toastMessage}
        </div>
      )}

      {/* Main Editor Area */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-color)', overflow: 'hidden' }}>
        
        {/* Tools Panel */}
        {isEditor && (
          <div style={{ padding: '1rem 2rem 0 2rem' }}>
            <ToolsPanel projectData={projectData} />
          </div>
        )}

        {isViewer && !isEditor && (
          <div style={{ padding: '1rem', backgroundColor: '#fef9c3', color: '#854d0e', textAlign: 'center', fontSize: '0.875rem' }}>
            Anda dalam mode <strong>View Only</strong>. Anda tidak dapat melakukan perubahan.
          </div>
        )}

        {/* Canvas Area */}
        <div style={{ flex: 1, overflow: 'auto', padding: '2rem', pointerEvents: isEditor ? 'auto' : 'none' }}>
          <div 
            id="canvas-content-wrapper"
            style={{ 
              position: 'relative',
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
            
            <LiveCursors projectId={id} currentUser={user} zoomLevel={zoomLevel} />
            
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
                  <div className="insert-divider" onClick={() => store.addPattern(index)} title="Tambahkan pola di sini" style={{ height: `${32 / zoomLevel}px` }}>
                    <div className="line"></div>
                    <button style={{ transform: `scale(${1 / zoomLevel})` }}><Plus size={16} /></button>
                    <div className="line"></div>
                  </div>
                )}
                
                <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                  <PatternCard 
                    pattern={pattern} 
                    index={index} 
                    projectData={projectData} 
                    onDeleteClick={(id) => setPatternToDelete(id)}
                  />
                  
                  {projectData.hasTransition && (
                    <TransitionCard pattern={pattern} index={index} projectData={projectData} />
                  )}
                </div>
              </React.Fragment>
            ))}

            {isEditor && (
              <div style={{ 
                marginTop: `${32 / zoomLevel}px`, 
                display: 'flex', 
                justifyContent: 'center', 
                height: `${100 / zoomLevel}px`
              }}>
                <button 
                  className="btn btn-outline" 
                  style={{ 
                    padding: '1rem 4rem', 
                    fontSize: '1.1rem', 
                    borderRadius: '8px', 
                    borderStyle: 'dashed', 
                    borderWidth: '2px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    pointerEvents: 'auto',
                    transform: `scale(${1 / zoomLevel})`,
                    transformOrigin: 'center top'
                  }} 
                  onClick={() => store.addPattern(patterns.length)}
                >
                  <Plus size={20} style={{ marginRight: '0.5rem' }} /> Tambah Pola Baru
                </button>
              </div>
            )}
          </div>
        </div>

      </main>

      {showShareModal && (
        <ShareModal projectData={projectData} onClose={() => setShowShareModal(false)} showToast={showToast} />
      )}
      
      {showRecoveryModal && (
        <RecoveryModal projectData={projectData} patterns={patterns} onClose={() => setShowRecoveryModal(false)} showToast={showToast} />
      )}

      {/* Delete Confirmation Modal */}
      {patternToDelete && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div className="card glass" style={{ width: '90%', maxWidth: '400px', padding: '2rem', textAlign: 'center', animation: 'slideUp 0.2s ease-out' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem', color: 'var(--text-main)' }}>Hapus Pola</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
              Apakah Anda yakin ingin menghapus pola ini beserta transisinya? Tindakan ini dapat dibatalkan dengan tombol Undo.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button 
                className="btn btn-outline" 
                onClick={() => setPatternToDelete(null)}
                style={{ flex: 1 }}
              >
                Batal
              </button>
              <button 
                className="btn btn-primary" 
                onClick={() => {
                  store.deletePattern(patternToDelete);
                  setPatternToDelete(null);
                  showToast('Pola berhasil dihapus');
                }}
                style={{ flex: 1, backgroundColor: '#ef4444', borderColor: '#ef4444' }}
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
