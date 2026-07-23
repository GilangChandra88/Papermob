import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { oldAuth, getOldProjects, migrateProjectToNewDb } from '../utils/firebaseMigration';
import { ArrowLeft, Database, DownloadCloud, CheckCircle, AlertCircle, Loader } from 'lucide-react';

export default function Migration() {
  const navigate = useNavigate();
  const [oldUser, setOldUser] = useState(null);
  const [oldProjects, setOldProjects] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | fetching | ready | migrating | done | error
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState(0);

  const currentUser = auth.currentUser;

  const handleLoginOldDB = async () => {
    if (!currentUser) {
      setMessage("Anda harus login ke aplikasi terlebih dahulu.");
      setStatus('error');
      return;
    }

    try {
      setStatus('fetching');
      setMessage("Menghubungkan ke database lama...");
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(oldAuth, provider);
      const user = result.user;
      
      if (user.email !== currentUser.email) {
        setMessage(`Peringatan: Email berbeda! Lama (${user.email}), Baru (${currentUser.email})`);
        setStatus('error');
        // Let them proceed if they really want to, but ideally block or warn heavily.
        return;
      }

      setOldUser(user);
      setMessage("Berhasil terhubung. Mencari projek...");
      
      const projects = await getOldProjects(user.uid);
      setOldProjects(projects);
      
      if (projects.length === 0) {
        setMessage("Tidak ada projek yang ditemukan di database lama.");
        setStatus('done');
      } else {
        setMessage(`Ditemukan ${projects.length} projek. Siap untuk migrasi.`);
        setStatus('ready');
      }

    } catch (error) {
      console.error(error);
      setMessage(`Gagal terhubung: ${error.message}`);
      setStatus('error');
    }
  };

  const handleStartMigration = async () => {
    if (oldProjects.length === 0) return;
    
    setStatus('migrating');
    setMessage("Memulai migrasi data. Mohon jangan tutup halaman ini...");
    let successCount = 0;

    for (let i = 0; i < oldProjects.length; i++) {
      try {
        await migrateProjectToNewDb(currentUser.uid, oldProjects[i]);
        successCount++;
        setProgress(Math.round(((i + 1) / oldProjects.length) * 100));
      } catch (err) {
        console.error("Error migrating project: ", err);
      }
    }

    setStatus('done');
    setMessage(`Migrasi Selesai! Berhasil memindahkan ${successCount} dari ${oldProjects.length} projek.`);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
      <div className="max-w-xl w-full bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-blue-600 p-6 text-white flex items-center gap-4">
          <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-blue-700 rounded-full transition">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-2xl font-bold">Migrasi Data Papermob</h1>
            <p className="text-blue-100 text-sm">Pindahkan projek dari database versi lama</p>
          </div>
        </div>

        <div className="p-8">
          {!currentUser ? (
            <div className="text-center p-6 bg-red-50 text-red-700 rounded-xl">
              <AlertCircle size={48} className="mx-auto mb-4 opacity-50" />
              <p>Anda belum login. Silakan kembali ke halaman utama dan login terlebih dahulu.</p>
              <button 
                onClick={() => navigate('/')}
                className="mt-4 px-6 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition"
              >
                Kembali ke Beranda
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              
              <div className="bg-slate-100 p-5 rounded-xl border border-slate-200">
                <h3 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
                  <Database size={18} className="text-blue-600" /> 
                  Status Akun Saat Ini (DB Baru)
                </h3>
                <p className="text-slate-600 text-sm">Email: <span className="font-semibold text-slate-900">{currentUser.email}</span></p>
              </div>

              {/* Step 1: Login to Old DB */}
              <div className={`p-5 rounded-xl border transition ${oldUser ? 'border-green-200 bg-green-50' : 'border-slate-200'}`}>
                <h3 className="font-semibold text-slate-800 mb-2">Langkah 1: Verifikasi Akun Lama</h3>
                <p className="text-slate-500 text-sm mb-4">
                  Klik tombol di bawah ini dan login menggunakan akun Google <b>{currentUser.email}</b> untuk mengakses database lama.
                </p>
                {!oldUser ? (
                  <button
                    onClick={handleLoginOldDB}
                    disabled={status === 'fetching'}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-slate-800 text-white rounded-lg font-semibold hover:bg-slate-900 transition disabled:opacity-50"
                  >
                    {status === 'fetching' ? <Loader className="animate-spin" size={20} /> : <Database size={20} />}
                    {status === 'fetching' ? 'Menghubungkan...' : 'Login ke Database Lama'}
                  </button>
                ) : (
                  <div className="flex items-center gap-2 text-green-700">
                    <CheckCircle size={20} />
                    <span className="font-medium">Terhubung sebagai {oldUser.email}</span>
                  </div>
                )}
              </div>

              {/* Step 2: Migrate */}
              {status !== 'idle' && status !== 'fetching' && (
                <div className="p-5 rounded-xl border border-blue-200 bg-blue-50">
                  <h3 className="font-semibold text-blue-900 mb-2">Langkah 2: Proses Migrasi</h3>
                  <p className="text-blue-700 text-sm mb-4">{message}</p>
                  
                  {status === 'ready' && (
                    <button
                      onClick={handleStartMigration}
                      className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
                    >
                      <DownloadCloud size={20} />
                      Mulai Eksekusi Migrasi
                    </button>
                  )}

                  {status === 'migrating' && (
                    <div className="space-y-2">
                      <div className="h-4 w-full bg-blue-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-600 transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                      <p className="text-right text-xs font-bold text-blue-800">{progress}%</p>
                    </div>
                  )}

                  {status === 'done' && (
                    <button
                      onClick={() => navigate('/dashboard')}
                      className="w-full mt-4 py-3 px-4 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition"
                    >
                      Kembali ke Dashboard
                    </button>
                  )}
                </div>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
