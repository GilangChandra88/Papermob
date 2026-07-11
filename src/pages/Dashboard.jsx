import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { auth } from '../firebase'
import { signOut } from 'firebase/auth'
import { getProjects, createProject } from '../utils/firebaseUtils'
import ProjectForm from '../components/ProjectForm'
import { Plus, LogOut, FileImage } from 'lucide-react'

export default function Dashboard({ user }) {
  const navigate = useNavigate()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    loadProjects()
  }, [user.uid])

  const loadProjects = async () => {
    try {
      const data = await getProjects(user.uid)
      setProjects(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    signOut(auth)
  }

  const handleCreateProject = async (projectData) => {
    try {
      setLoading(true)
      const projectId = await createProject(user.uid, projectData)
      setShowForm(false)
      navigate(`/project/${projectId}`)
    } catch (e) {
      console.error(e)
      alert('Gagal membuat projek')
      setLoading(false)
    }
  }

  return (
    <div className="app-container" style={{ backgroundColor: 'var(--bg-color)' }}>
      <header style={{ backgroundColor: 'var(--surface)', padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: 'var(--shadow-sm)' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FileImage color="var(--primary)" />
          Papermob Planner
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{user.email}</span>
          <button className="btn btn-outline" onClick={handleLogout} style={{ padding: '0.4rem 0.75rem' }}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </header>

      <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Projek Saya</h2>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={18} /> Buat Projek
          </button>
        </div>

        {loading ? (
          <p>Loading projects...</p>
        ) : projects.length === 0 ? (
          <div className="card glass" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>Belum ada projek yang dibuat.</p>
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>
              Buat Projek Pertama Anda
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {projects.map(project => (
              <div 
                key={project.id} 
                className="card" 
                style={{ cursor: 'pointer', transition: 'transform 0.2s', border: '1px solid transparent' }}
                onClick={() => navigate(`/project/${project.id}`)}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem' }}>{project.name}</h3>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <p>Dimensi: {project.width} x {project.height}</p>
                  <p>Posisi: {project.positions.join(', ')}</p>
                  <p>Transisi: {project.hasTransition ? `${project.transitionSteps} Step` : 'Tidak Ada'}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {showForm && (
        <ProjectForm 
          onSubmit={handleCreateProject} 
          onCancel={() => setShowForm(false)} 
        />
      )}
    </div>
  )
}
