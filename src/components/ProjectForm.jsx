import React, { useState } from 'react'

const AVAILABLE_COLORS = [
  { name: 'Merah', hex: '#EF4444' },
  { name: 'Biru', hex: '#3B82F6' },
  { name: 'Kuning', hex: '#EAB308' },
  { name: 'Hijau', hex: '#10B981' },
  { name: 'Hitam', hex: '#111827' },
  { name: 'Putih', hex: '#FFFFFF' }
]

export default function ProjectForm({ onSubmit, onCancel }) {
  const [name, setName] = useState('')
  const [width, setWidth] = useState('')
  const [height, setHeight] = useState('')
  const [selectedColors, setSelectedColors] = useState([])
  const [positions, setPositions] = useState([])
  const [hasTransition, setHasTransition] = useState(false)
  const [transitionSteps, setTransitionSteps] = useState(2)

  const handleColorToggle = (hex) => {
    if (selectedColors.includes(hex)) {
      setSelectedColors(selectedColors.filter(c => c !== hex))
    } else {
      setSelectedColors([...selectedColors, hex])
    }
  }

  const handlePositionToggle = (pos) => {
    if (positions.includes(pos)) {
      setPositions(positions.filter(p => p !== pos))
    } else {
      setPositions([...positions, pos])
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name || !width || !height || selectedColors.length === 0 || positions.length === 0) {
      alert("Harap isi semua field utama (Nama, Dimensi, Warna, dan Posisi).")
      return
    }
    
    onSubmit({
      name,
      width: parseInt(width),
      height: parseInt(height),
      colors: selectedColors,
      positions,
      hasTransition,
      transitionSteps: hasTransition ? parseInt(transitionSteps) : 0
    })
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
    }}>
      <div className="card" style={{ width: '90%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
        <h2 style={{ marginBottom: '1.5rem' }}>Buat Projek Baru</h2>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Nama Projek</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} style={{ width: '100%' }} placeholder="Contoh: HUT RI ke-80" />
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Lebar (Kolom A-Z)</label>
              <input type="number" min="1" value={width} onChange={e => setWidth(e.target.value)} style={{ width: '100%' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Tinggi (Baris 1-N)</label>
              <input type="number" min="1" value={height} onChange={e => setHeight(e.target.value)} style={{ width: '100%' }} />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Warna Palette</label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {AVAILABLE_COLORS.map(color => (
                <div 
                  key={color.hex}
                  onClick={() => handleColorToggle(color.hex)}
                  style={{
                    width: '36px', height: '36px', borderRadius: '50%', backgroundColor: color.hex,
                    border: selectedColors.includes(color.hex) ? '3px solid var(--primary)' : '1px solid #ccc',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: selectedColors.includes(color.hex) ? '0 0 0 2px white inset' : 'none'
                  }}
                  title={color.name}
                />
              ))}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Posisi Peserta</label>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={positions.includes('jongkok')} onChange={() => handlePositionToggle('jongkok')} />
                Jongkok
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={positions.includes('berdiri')} onChange={() => handlePositionToggle('berdiri')} />
                Berdiri
              </label>
            </div>
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500, cursor: 'pointer' }}>
              <input type="checkbox" checked={hasTransition} onChange={e => setHasTransition(e.target.checked)} />
              Terapkan Mekanisme Transisi
            </label>
            
            {hasTransition && (
              <div style={{ marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Jumlah Step (2-10)</label>
                <input type="number" min="2" max="10" value={transitionSteps} onChange={e => setTransitionSteps(e.target.value)} style={{ width: '100px' }} />
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
            <button type="button" className="btn btn-outline" onClick={onCancel}>Batal</button>
            <button type="submit" className="btn btn-primary">Simpan Projek</button>
          </div>
        </form>
      </div>
    </div>
  )
}
