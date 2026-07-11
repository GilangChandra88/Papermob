export const generateCanvasImage = (coord, patterns, projectData) => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Calculate grid dimensions first to determine canvas width
    const totalPatterns = patterns.length;
    const maxRows = 12; // Maximum patterns per column
    const cols = Math.max(1, Math.ceil(totalPatterns / maxRows));
    const colWidth = 165; // Fixed width per column
    
    const leftPanelW = 600;
    const width = leftPanelW + (cols * colWidth);
    const height = 1240; // Fixed height (A4 Landscape height)

    canvas.width = width;
    canvas.height = height;

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Draw main divider
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(leftPanelW, 0);
    ctx.lineTo(leftPanelW, height);
    ctx.stroke();

    // ==========================================
    // LEFT PANEL
    // ==========================================

    // 1. Title Box
    ctx.beginPath();
    ctx.moveTo(0, 120);
    ctx.lineTo(leftPanelW, 120);
    ctx.stroke();

    ctx.fillStyle = '#000000';
    ctx.font = 'bold 50px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`KOORDINAT ${coord}`, leftPanelW / 2, 60);

    // 2. Format Diagram Box
    ctx.beginPath();
    ctx.moveTo(0, 500);
    ctx.lineTo(leftPanelW, 500);
    ctx.stroke();

    // Diagram elements
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Kode', 40, 170);
    ctx.fillText('Pola', 40, 200);

    // Draw pattern box
    ctx.lineWidth = 3;
    ctx.strokeRect(30, 240, 60, 200);
    ctx.font = 'bold 30px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('1', 60, 280);
    ctx.fillText('2', 60, 340);
    ctx.fillText('3', 60, 410);

    // Draw diagram lines and text
    ctx.beginPath();
    ctx.moveTo(90, 280);
    ctx.lineTo(130, 280);
    ctx.moveTo(90, 340);
    ctx.lineTo(130, 340);
    ctx.moveTo(90, 410);
    ctx.lineTo(130, 410);
    ctx.stroke();

    // Draw example circles
    const drawCircle = (x, y, color, text, textColor = '#ffffff') => {
      ctx.beginPath();
      ctx.arc(x, y, 30, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#000000';
      ctx.stroke();
      
      ctx.fillStyle = textColor;
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, x, y + 2);
    };

    drawCircle(170, 280, '#ef4444', '1B'); // Red
    drawCircle(170, 340, '#ffffff', '1B', '#000000'); // White
    drawCircle(170, 410, '#f97316', '1J'); // Orange

    // Explanations
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 22px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Warna Yang Akan', 220, 265);
    ctx.fillText('Diangkat', 220, 295);

    ctx.fillText('Dengarkan Aba-Aba!', 220, 370);
    ctx.fillText('Angkat Warna', 220, 400);
    ctx.fillText('Sesuai Angka', 220, 430);
    ctx.fillText('Ketukannya', 220, 460);

    // 3. Legend Box
    ctx.beginPath();
    ctx.moveTo(0, 680);
    ctx.lineTo(leftPanelW, 680);
    ctx.stroke();

    ctx.font = 'bold 45px Arial';
    ctx.fillText('B', 80, 560);
    ctx.font = 'bold 28px Arial';
    ctx.fillText('Berdiri', 130, 540);
    ctx.font = 'italic 18px Arial';
    ctx.fillText('Angkat Warna Sambil Berdiri', 130, 570);

    ctx.font = 'bold 45px Arial';
    ctx.fillText('J', 80, 640);
    ctx.font = 'bold 28px Arial';
    ctx.fillText('Jongkok', 130, 620);
    ctx.font = 'italic 18px Arial';
    ctx.fillText('Angkat Warna Sambil Jongkok', 130, 650);

    // 4. Color Legend Box
    ctx.beginPath();
    ctx.moveTo(0, 880);
    ctx.lineTo(leftPanelW, 880);
    ctx.stroke();

    // Draw dynamic colors used in project
    const colors = projectData.colors || [];
    const colorStartY = 730;
    for (let i = 0; i < colors.length; i++) {
      const isRight = i % 2 !== 0;
      const xOffset = isRight ? 350 : 80;
      const yOffset = colorStartY + Math.floor(i / 2) * 50;
      
      ctx.beginPath();
      ctx.arc(xOffset, yOffset, 20, 0, Math.PI * 2);
      ctx.fillStyle = colors[i];
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#000000';
      ctx.stroke();

      ctx.fillStyle = '#000000';
      ctx.font = 'bold 20px Arial';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      
      let colorName = colors[i].toUpperCase();
      if (colorName === '#FFFFFF') colorName = 'Putih';
      else if (colorName === '#000000' || colorName === '#111827') colorName = 'Hitam';
      else if (colorName === '#EF4444') colorName = 'Merah';
      else if (colorName === '#F97316') colorName = 'Orange';
      else if (colorName === '#3B82F6') colorName = 'Biru';
      else if (colorName === '#EAB308') colorName = 'Kuning';
      else if (colorName === '#22C55E') colorName = 'Hijau';

      ctx.fillText(colorName, xOffset + 35, yOffset + 2);
    }

    // 5. Operator Steps Box
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 22px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Langkah Aba Aba Dari Operator', 40, 930);

    ctx.font = '18px Arial';
    const steps = [
      "1. Kode xxx / Perhatikan Warna dan Angkanya!",
      "2. Siap / Mulai Dengarkan Aba Aba!",
      "3. Satu !! / Warna Dengan Angka 1 Bergerak!",
      "4. Dua !! / Warna Dengan Angka 2 Bergerak!",
      "5. Tiga !! / Warna Dengan Angka 3 Bergerak!",
      "6. Empat !! / Warna Dengan Angka 4 Bergerak!",
      "7. Lima !! / Warna Dengan Angka 5 Bergerak!",
      "8. Enam !! / Warna Dengan Angka 6 Bergerak!"
    ];

    steps.forEach((step, idx) => {
      ctx.fillText(step, 40, 970 + (idx * 30));
    });

    // ==========================================
    // RIGHT PANEL (Dynamic Grid)
    // ==========================================

    const bottomFooterH = 100;
    ctx.beginPath();
    ctx.moveTo(leftPanelW, height - bottomFooterH);
    ctx.lineTo(width, height - bottomFooterH);
    ctx.stroke();

    ctx.font = 'bold 45px Arial';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('KODE PAPER MOB', width - 50, height - 50);

    const availableHeight = height - bottomFooterH;
    const rowHeight = availableHeight / maxRows;

    // Draw vertical dividers for columns
    ctx.lineWidth = 2;
    for (let c = 1; c < cols; c++) {
      ctx.beginPath();
      ctx.moveTo(leftPanelW + (c * colWidth), 0);
      ctx.lineTo(leftPanelW + (c * colWidth), height - bottomFooterH);
      ctx.stroke();
    }

    // Draw horizontal dividers for rows
    for (let r = 1; r < maxRows; r++) {
      ctx.beginPath();
      ctx.moveTo(leftPanelW, r * rowHeight);
      ctx.lineTo(width, r * rowHeight);
      ctx.stroke();
    }

    // Populate patterns
    for (let i = 0; i < totalPatterns; i++) {
      const pattern = patterns[i];
      const colIdx = Math.floor(i / maxRows);
      const rowIdx = i % maxRows;

      const cellX = leftPanelW + (colIdx * colWidth);
      const cellY = rowIdx * rowHeight;
      const cellH = rowHeight;
      
      const patternNumber = i + 1;
      
      // Pattern Number Text
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 30px Arial';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(patternNumber.toString(), cellX + 45, cellY + (cellH / 2));

      // Fetch cell data
      const cellData = pattern.grid[coord];
      const transData = pattern.transitions?.[coord];

      // Draw Circle
      const circleX = cellX + 105;
      const circleY = cellY + (cellH / 2);
      
      if (cellData && cellData.pos) {
        let textColor = '#ffffff';
        let hex = cellData.color || '#ffffff';
        let overlayColor = null;
        if (hex.startsWith('#') && hex.length === 7) {
          let rHex = parseInt(hex.substring(1, 3), 16);
          let gHex = parseInt(hex.substring(3, 5), 16);
          let bHex = parseInt(hex.substring(5, 7), 16);
          let yiq = ((rHex * 299) + (gHex * 587) + (bHex * 114)) / 1000;
          textColor = (yiq >= 128) ? '#000000' : '#ffffff';
          
          if (cellData.pos === 'J') {
            if (yiq >= 50) overlayColor = 'rgba(0,0,0,0.15)'; 
          } else if (cellData.pos === 'B') {
            if (yiq < 50) overlayColor = 'rgba(255,255,255,0.2)';
          }
        }

        // Draw Base Circle
        ctx.beginPath();
        ctx.arc(circleX, circleY, 35, 0, Math.PI * 2);
        ctx.fillStyle = cellData.color;
        ctx.fill();
        
        // Draw Overlay if needed
        if (overlayColor) {
          ctx.beginPath();
          ctx.arc(circleX, circleY, 35, 0, Math.PI * 2);
          ctx.fillStyle = overlayColor;
          ctx.fill();
        }

        // Draw Stroke
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#000000';
        ctx.beginPath();
        ctx.arc(circleX, circleY, 35, 0, Math.PI * 2);
        ctx.stroke();

        // Draw Action Text
        ctx.fillStyle = textColor;
        ctx.font = 'bold 28px Arial';
        ctx.textAlign = 'center';
        
        // If there's a transition step, format like "1B" or "1J". If no transition, just "B" or "J"
        let actionText = '';
        if (transData && transData.step) {
          actionText = `${transData.step}${cellData.pos}`;
        } else {
          actionText = cellData.pos;
        }

        ctx.fillText(actionText, circleX, circleY + 2);
      } else {
        // Empty Circle or just dash
        ctx.beginPath();
        ctx.arc(circleX, circleY, 35, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#cbd5e1'; // light grey
        ctx.stroke();
      }
    }

    // Convert to base64
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    resolve(dataUrl.replace(/^data:image\/jpeg;base64,/, ""));
  });
};
