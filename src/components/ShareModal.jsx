import React, { useState } from 'react';
import { X, Copy, Link, Users, ShieldAlert, Check } from 'lucide-react';
import { updateProjectData } from '../utils/firebaseUtils';

export default function ShareModal({ projectData, onClose, showToast }) {
  const [sharingSettings, setSharingSettings] = useState(
    projectData.sharingSettings || { mode: 'restricted' }
  );
  const [sharedWith, setSharedWith] = useState(
    projectData.sharedWith || {}
  );
  const [sharedEmails, setSharedEmails] = useState(
    projectData.sharedEmails || []
  );

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    if (showToast) showToast('Tautan disalin!');
  };

  const handleInvite = () => {
    if (!inviteEmail || !inviteEmail.includes('@')) {
      alert('Masukkan email yang valid.');
      return;
    }
    
    if (sharedWith[inviteEmail]) {
      alert('Email ini sudah memiliki akses.');
      return;
    }

    const newSharedWith = { ...sharedWith, [inviteEmail]: { role: inviteRole } };
    const newSharedEmails = [...sharedEmails, inviteEmail];
    
    setSharedWith(newSharedWith);
    setSharedEmails(newSharedEmails);
    setInviteEmail('');
  };

  const handleRemoveAccess = (email) => {
    const newSharedWith = { ...sharedWith };
    delete newSharedWith[email];
    const newSharedEmails = sharedEmails.filter(e => e !== email);
    
    setSharedWith(newSharedWith);
    setSharedEmails(newSharedEmails);
  };

  const handleRoleChange = (email, newRole) => {
    const newSharedWith = { ...sharedWith, [email]: { role: newRole } };
    setSharedWith(newSharedWith);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateProjectData(projectData.id, {
        sharingSettings,
        sharedWith,
        sharedEmails
      });
      if (showToast) showToast('Pengaturan akses disimpan!');
      onClose();
    } catch (error) {
      console.error(error);
      alert('Gagal menyimpan pengaturan');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      zIndex: 1000
    }}>
      <div className="card glass" style={{ width: '100%', maxWidth: '500px', padding: '2rem', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users size={20} /> Bagikan Projek
          </h2>
          <button className="btn btn-outline" onClick={onClose} style={{ padding: '0.5rem', border: 'none' }}>
            <X size={20} />
          </button>
        </div>

        {/* Tautan */}
        <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem', color: '#111827' }}>Tautan Projek</h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input 
              type="text" 
              readOnly 
              value={window.location.href}
              style={{ flex: 1, padding: '0.6rem 0.75rem', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: '#ffffff', color: '#374151', fontSize: '0.875rem' }}
            />
            <button className="btn btn-outline" onClick={handleCopyLink} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#ffffff' }}>
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? 'Tersalin' : 'Salin'}
            </button>
          </div>
        </div>

        {/* Akses Umum */}
        <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem', color: '#111827' }}>Akses Umum (Link Sharing)</h3>
          <select 
            value={sharingSettings.mode}
            onChange={(e) => setSharingSettings({ ...sharingSettings, mode: e.target.value })}
            style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: '#ffffff', color: '#111827', fontSize: '0.875rem' }}
          >
            <option value="restricted">Terbatas (Hanya pengguna diundang)</option>
            <option value="link_viewer">Siapa saja yang memiliki tautan dapat Melihat (Viewer)</option>
            <option value="link_editor">Siapa saja yang memiliki tautan dapat Mengedit (Editor)</option>
          </select>
          {sharingSettings.mode !== 'restricted' && (
            <p style={{ fontSize: '0.875rem', color: '#d97706', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.5rem' }}>
              <ShieldAlert size={14} /> Pengguna tetap harus login untuk mengakses.
            </p>
          )}
        </div>

        {/* Undang Orang */}
        <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem', color: '#111827' }}>Undang Pengguna</h3>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <input 
              type="email" 
              placeholder="Masukkan email..." 
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              style={{ flex: 1, padding: '0.6rem 0.75rem', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: '#f9fafb', color: '#111827', fontSize: '0.875rem' }}
            />
            <select 
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              style={{ padding: '0.6rem 0.75rem', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: '#f9fafb', color: '#111827', fontSize: '0.875rem' }}
            >
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
            </select>
            <button className="btn btn-primary" onClick={handleInvite} style={{ padding: '0.6rem 1rem' }}>Undang</button>
          </div>

          {/* Daftar Pengguna Diundang */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', backgroundColor: '#f3f4f6', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>Pemilik Projek</span>
              <span style={{ fontSize: '0.75rem', color: '#4b5563', backgroundColor: '#e5e7eb', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 600 }}>PEMILIK</span>
            </div>
            
            {sharedEmails.map(email => (
              <div key={email} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', backgroundColor: '#ffffff', borderRadius: '6px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 500, wordBreak: 'break-all', color: '#374151' }}>{email}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <select 
                    value={sharedWith[email]?.role || 'viewer'}
                    onChange={(e) => handleRoleChange(email, e.target.value)}
                    style={{ padding: '0.35rem 0.5rem', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '0.875rem', backgroundColor: '#f9fafb', color: '#111827' }}
                  >
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                  </select>
                  <button 
                    onClick={() => handleRemoveAccess(email)}
                    style={{ background: '#fee2e2', border: '1px solid #fca5a5', color: '#ef4444', cursor: 'pointer', padding: '0.35rem', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title="Hapus Akses"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
          <button className="btn btn-outline" onClick={onClose} disabled={isSaving}>Batal</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Menyimpan...' : 'Simpan Pengaturan'}
          </button>
        </div>
      </div>
    </div>
  );
}
