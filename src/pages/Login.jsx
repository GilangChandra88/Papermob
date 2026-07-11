import React from 'react'
import { auth } from '../firebase'
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
import { useNavigate } from 'react-router-dom'
import { LogIn } from 'lucide-react'

export default function Login() {
  const navigate = useNavigate()

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider()
      await signInWithPopup(auth, provider)
      navigate('/dashboard')
    } catch (error) {
      console.error('Error signing in with Google', error)
      alert('Gagal login dengan Google. Silahkan coba lagi.')
    }
  }

  return (
    <div className="app-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #4F46E5 0%, #06B6D4 100%)' }}>
      <div className="card glass" style={{ textAlign: 'center', maxWidth: '400px', width: '90%', padding: '3rem 2rem' }}>
        <h1 style={{ marginBottom: '0.5rem', color: '#111827', fontSize: '2rem', fontWeight: 'bold' }}>Papermob Planner</h1>
        <p style={{ color: '#4B5563', marginBottom: '2rem' }}>Buat perencanaan papermob tribun dengan mudah dan cepat.</p>
        
        <button className="btn btn-primary" onClick={handleGoogleLogin} style={{ width: '100%', padding: '0.75rem', fontSize: '1rem' }}>
          <LogIn size={20} />
          Login dengan Google
        </button>
      </div>
    </div>
  )
}
