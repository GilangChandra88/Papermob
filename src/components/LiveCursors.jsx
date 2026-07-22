import React, { useEffect, useState, useRef } from 'react';
import { subscribeToCursors, updateCursor } from '../utils/firebaseUtils';
import { MousePointer2 } from 'lucide-react';

const CURSOR_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'];

export default function LiveCursors({ projectId, currentUser, zoomLevel = 1 }) {
  const [cursors, setCursors] = useState({});

  useEffect(() => {
    if (!projectId) return;

    const unsubscribe = subscribeToCursors(projectId, (newCursors) => {
      const now = Date.now();
      const activeCursors = {};
      Object.entries(newCursors).forEach(([uid, cursor]) => {
        // Only keep cursors that were active within the last 10 seconds
        if (cursor.lastActive && now - cursor.lastActive < 10000) {
          activeCursors[uid] = cursor;
        }
      });
      setCursors(activeCursors);
    });

    return () => unsubscribe();
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !currentUser) return;

    let timeout;
    const handleMouseMove = (e) => {
      if (timeout) return;
      
      timeout = setTimeout(() => {
        const wrapper = document.getElementById('canvas-content-wrapper');
        if (!wrapper) return;
        
        const rect = wrapper.getBoundingClientRect();
        
        // Calculate the exact pixel offset inside the unscaled container
        const x = (e.clientX - rect.left) / zoomLevel;
        const y = (e.clientY - rect.top) / zoomLevel;
        
        updateCursor(projectId, currentUser.uid, {
          x, y,
          email: currentUser.email,
          color: getColorForEmail(currentUser.email),
          lastActive: Date.now()
        });
        
        timeout = null;
      }, 50); // throttle to 20fps
    };

    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (timeout) clearTimeout(timeout);
    };
  }, [projectId, currentUser, zoomLevel]);

  // Local cleanup interval to remove idle cursors visually without waiting for database changes
  useEffect(() => {
    const interval = setInterval(() => {
      setCursors(prev => {
        const now = Date.now();
        const active = {};
        let changed = false;
        Object.entries(prev).forEach(([uid, cursor]) => {
          if (cursor.lastActive && now - cursor.lastActive > 10000) {
            changed = true; // Needs removal
          } else {
            active[uid] = cursor;
          }
        });
        return changed ? active : prev;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const getColorForEmail = (email) => {
    if (!email) return CURSOR_COLORS[0];
    let hash = 0;
    for (let i = 0; i < email.length; i++) {
      hash = email.charCodeAt(i) + ((hash << 5) - hash);
    }
    return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
  };

  return (
    <div 
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 9998
      }}
    >
      {Object.entries(cursors).map(([uid, cursor]) => {
        if (uid === currentUser?.uid) return null; // Don't show own cursor
        if (!cursor.x || !cursor.y) return null;
        
        // Hide cursors that haven't moved in 10 minutes
        const isStale = cursor.updatedAt && (Date.now() - cursor.updatedAt.toMillis() > 10 * 60 * 1000);
        if (isStale) return null;

        return (
          <div
            key={uid}
            style={{
              position: 'absolute',
              left: `${cursor.x}px`,
              top: `${cursor.y}px`,
              transform: `translate(-2px, -2px) scale(${1 / zoomLevel})`,
              transformOrigin: 'top left',
              transition: 'left 0.1s linear, top 0.1s linear',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              pointerEvents: 'none'
            }}
          >
            <MousePointer2 
              size={20} 
              fill={cursor.color} 
              color={cursor.color} 
              style={{ filter: 'drop-shadow(1px 1px 2px rgba(0,0,0,0.3))' }}
            />
            <div style={{
              backgroundColor: cursor.color,
              color: 'white',
              fontSize: '10px',
              padding: '2px 6px',
              borderRadius: '4px',
              borderTopLeftRadius: 0,
              marginTop: '4px',
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}>
              {cursor.email?.split('@')[0]}
            </div>
          </div>
        );
      })}
    </div>
  );
}
