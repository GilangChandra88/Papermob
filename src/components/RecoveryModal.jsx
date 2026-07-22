import React, { useState, useEffect } from 'react';
import { X, RotateCcw, Clock, AlertTriangle } from 'lucide-react';
import { getBackups, updateProjectData, createBackup } from '../utils/firebaseUtils';

export default function RecoveryModal({ projectData, patterns, onClose, showToast }) {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(false);
  const [backingUp, setBackingUp] = useState(false);

  useEffect(() => {
    loadBackups();
  }, [projectData.id]);

  const loadBackups = async () => {
    setLoading(true);
    const data = await getBackups(projectData.id);
    setBackups(data);
    setLoading(false);
  };

  const handleManualBackup = async () => {
    setBackingUp(true);
    await createBackup(projectData.id, patterns, "Backup Manual");
    if (showToast) showToast('Backup berhasil dibuat!');
    await loadBackups();
    setBackingUp(false);
  };

  const handleRestore = async (backup) => {
    const confirm = window.confirm(
      "Apakah Anda yakin ingin memulihkan versi ini? Versi yang ada sekarang akan ditimpa secara permanen."
    );
    if (!confirm) return;

    setRestoring(true);
    try {
      await updateProjectData(projectData.id, { patterns: backup.patterns });
      if (showToast) showToast('Projek berhasil dipulihkan!');
      // Reload window to fetch fresh data
      window.location.reload();
    } catch (e) {
      console.error(e);
      alert('Gagal memulihkan projek');
      setRestoring(false);
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).format(date);
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      zIndex: 1000
    }}>
      <div className="card glass" style={{ width: '100%', maxWidth: '600px', padding: '2rem', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <RotateCcw size={20} /> Recovery Mode
          </h2>
          <button className="btn btn-outline" onClick={onClose} style={{ padding: '0.5rem', border: 'none' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ marginBottom: '1.5rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', padding: '1rem', borderRadius: '8px' }}>
          <p style={{ fontSize: '0.875rem', color: '#b91c1c', display: 'flex', alignItems: 'flex-start', gap: '0.5rem', margin: 0 }}>
            <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>Memulihkan (Restore) projek ke versi sebelumnya akan menghapus semua perubahan yang Anda buat setelah versi tersebut. Harap berhati-hati!</span>
          </p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Riwayat Versi (Backups)</h3>
          <button className="btn btn-primary" onClick={handleManualBackup} disabled={backingUp} style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
            {backingUp ? 'Membuat Backup...' : 'Buat Backup Sekarang'}
          </button>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Memuat riwayat...</p>
        ) : backups.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Belum ada backup tersedia.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {backups.map(backup => (
              <div key={backup.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span style={{ fontWeight: 600, color: '#111827' }}>{backup.description || 'Auto Backup'}</span>
                  <span style={{ fontSize: '0.875rem', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Clock size={14} /> {formatTime(backup.createdAt)}
                  </span>
                </div>
                <button 
                  className="btn btn-outline" 
                  onClick={() => handleRestore(backup)}
                  disabled={restoring}
                  style={{ color: '#ef4444', borderColor: '#fca5a5', backgroundColor: '#fee2e2' }}
                >
                  <RotateCcw size={16} style={{ marginRight: '0.5rem' }} /> Restore
                </button>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
