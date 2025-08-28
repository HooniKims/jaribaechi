import React, { useState, useEffect } from 'react';
import './ClassroomLayout.css';

const ClassroomLayout = ({ 
  settings, 
  students, 
  onRandomArrangement, 
  seatData, 
  onViewResults, 
  onResetArrangement, 
  teacherNotes, 
  onTeacherNotesChange 
}) => {
  const [seatGrid, setSeatGrid] = useState([]);
  const [gridSize, setGridSize] = useState({ rows: 6, cols: 6 });
  const [verticalAisles, setVerticalAisles] = useState(new Set());
  const [showTeacherNotes, setShowTeacherNotes] = useState(true);

  // 화면 크기에 따른 최적 그리드 크기 계산
  const calculateOptimalGridSize = (studentCount, seatArrangement) => {
    // 화면 크기 기준 계산
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // 실제 사용 가능한 최대 너비 설정 (780px보다 작게)
    const maxAvailableWidth = Math.min(780, viewportWidth * 0.9);
    const availableHeight = viewportHeight * 0.65; // 65vh 사용
    
    // 좌석 크기와 간격을 고려한 최대 가능한 열과 행 계산
    let seatSize = Math.max(35, Math.min(55, viewportWidth * 0.04)); // 35px ~ 55px, 4vw
    let seatGap = Math.max(4, Math.min(8, viewportWidth * 0.008)); // 4px ~ 8px, 0.8vw
    
    // 좌석 크기를 동적으로 조정해서 maxAvailableWidth에 맞춤
    const estimatedCols = Math.ceil(Math.sqrt(studentCount * 1.2));
    let estimatedRowWidth = estimatedCols * (seatSize + seatGap) - seatGap; // 마지막 gap 제외
    
    // 만약 추정 너비가 최대 너비를 초과하면 좌석 크기를 줄임
    if (estimatedRowWidth > maxAvailableWidth) {
      const availableWidthPerSeat = maxAvailableWidth / estimatedCols;
      seatSize = Math.max(30, availableWidthPerSeat - seatGap); // 최소 30px 보장
      seatGap = Math.max(2, Math.min(seatGap, (maxAvailableWidth - estimatedCols * seatSize) / (estimatedCols - 1)));
    }
    
    const maxCols = Math.floor((maxAvailableWidth + seatGap) / (seatSize + seatGap));
    const maxRows = Math.floor(availableHeight / (seatSize + seatGap));
    
    let rows, cols;
    
    if (seatArrangement === 'single') {
      // 단일 배치: 최대 너비를 넘지 않는 범위에서 최적 배치 계산
      cols = Math.min(maxCols, Math.ceil(Math.sqrt(studentCount * 1.2)));
      rows = Math.ceil(studentCount / cols);
      
      // 행이 너무 많으면 열을 늘려서 조정 (최대 너비 내에서)
      while (rows > maxRows && cols < maxCols) {
        cols++;
        rows = Math.ceil(studentCount / cols);
      }
      
      // 최종 검증: 실제 너비가 maxAvailableWidth를 넘지 않는지 확인
      const actualRowWidth = cols * seatSize + (cols - 1) * seatGap;
      if (actualRowWidth > maxAvailableWidth) {
        cols = Math.floor((maxAvailableWidth + seatGap) / (seatSize + seatGap));
        rows = Math.ceil(studentCount / cols);
      }
    } else {
      // 쌍 배치: 최대 너비를 넘지 않는 범위에서 최적 배치 계산
      const pairCount = Math.ceil(studentCount / 2);
      cols = Math.min(maxCols, Math.ceil(Math.sqrt(pairCount * 1.5)));
      cols = cols % 2 === 0 ? cols : Math.min(maxCols, cols + 1); // 쌍 배치를 위해 짝수로 조정
      rows = Math.ceil(pairCount / (cols / 2));
      
      // 최종 검증
      const actualRowWidth = cols * seatSize + (cols - 1) * seatGap;
      if (actualRowWidth > maxAvailableWidth) {
        cols = Math.floor((maxAvailableWidth + seatGap) / (seatSize + seatGap));
        cols = cols % 2 === 0 ? cols : cols - 1; // 짝수로 맞춤
        rows = Math.ceil(pairCount / (cols / 2));
      }
    }
    
    // 최소값 보장
    rows = Math.max(2, Math.min(maxRows, rows));
    cols = Math.max(3, Math.min(maxCols, cols));
    
    console.log(`계산된 그리드: ${cols}열 x ${rows}행, 예상 너비: ${cols * seatSize + (cols - 1) * seatGap}px (최대: ${maxAvailableWidth}px)`);
    
    return { rows, cols };
  };

  useEffect(() => {
    // 기본 그리드 크기를 5행 6열로 설정
    const defaultRows = 5;
    const defaultCols = 6;
    const studentCount = settings.studentCount || 0;
    
    let rows, cols;
    
    if (studentCount === 0) {
      // 학생이 없을 때는 기본 5행 6열 빈 공간 표시
      rows = defaultRows;
      cols = defaultCols;
    } else {
      // 학생이 있을 때는 기본 그리드를 기준으로 배치하되, 필요시 확장
      const { rows: calculatedRows, cols: calculatedCols } = calculateOptimalGridSize(studentCount, settings.seatArrangement);
      rows = Math.max(defaultRows, calculatedRows);
      cols = Math.max(defaultCols, calculatedCols);
    }
    
    setGridSize({ rows, cols });

    const newAisles = new Set();
    if (settings.seatArrangement === 'pair') {
      for (let i = 1; i < cols - 1; i += 2) newAisles.add(i);
    } else if (settings.seatArrangement === 'single') {
      for (let i = 0; i < cols - 1; i++) newAisles.add(i);
    }
    setVerticalAisles(newAisles);

    const newGrid = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        row.push({ occupied: false, studentType: null });
      }
      newGrid.push(row);
    }
    setSeatGrid(newGrid);
    autoArrangeSeats(newGrid);
  }, [settings.studentCount, settings.seatArrangement, settings.pairingType, settings.maleCount, settings.femaleCount]);

  // 화면 크기 변경 감지
  useEffect(() => {
    const handleResize = () => {
      const studentCount = settings.studentCount || 24;
      const { rows, cols } = calculateOptimalGridSize(studentCount, settings.seatArrangement);
      if (rows !== gridSize.rows || cols !== gridSize.cols) {
        setGridSize({ rows, cols });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [settings.studentCount, settings.seatArrangement, gridSize]);

  const autoArrangeSeats = (initialGrid = null) => {
    const { studentCount, maleCount, femaleCount, seatArrangement } = settings;
    const gridToUse = initialGrid || seatGrid;
    if (!gridToUse || gridToUse.length === 0) return;

    const newGrid = gridToUse.map(row => row.map(() => ({ occupied: false, studentType: null })));
    const currentRows = newGrid.length;
    const currentCols = newGrid[0]?.length || 0;

    let malesToPlace = maleCount;
    let femalesToPlace = femaleCount;
    let placedStudents = 0;

    const seats = [];
    for (let r = currentRows - 1; r >= 0; r--) {
      for (let c = 0; c < currentCols; c++) {
        seats.push({ r, c });
      }
    }

    let seatIndex = 0;
    while (placedStudents < studentCount && seatIndex < seats.length) {
      if (seatArrangement === 'single') {
        const seat = seats[seatIndex];
        if (!newGrid[seat.r][seat.c].occupied) {
          if (malesToPlace > 0) {
            newGrid[seat.r][seat.c] = { occupied: true, studentType: 'male' };
            malesToPlace--;
          } else if (femalesToPlace > 0) {
            newGrid[seat.r][seat.c] = { occupied: true, studentType: 'female' };
            femalesToPlace--;
          }
          placedStudents++;
        }
        seatIndex++;
        continue;
      }

      if (seatIndex >= seats.length - 1) {
        if (placedStudents < studentCount && !newGrid[seats[seatIndex].r][seats[seatIndex].c].occupied) {
          if (malesToPlace > 0) {
            newGrid[seats[seatIndex].r][seats[seatIndex].c] = { occupied: true, studentType: 'male' };
            malesToPlace--;
          } else if (femalesToPlace > 0) {
            newGrid[seats[seatIndex].r][seats[seatIndex].c] = { occupied: true, studentType: 'female' };
            femalesToPlace--;
          }
          placedStudents++;
        }
        break;
      }

      const seat1 = seats[seatIndex];
      const seat2 = seats[seatIndex + 1];

      if (seat1.r !== seat2.r || verticalAisles.has(seat1.c)) {
        if (placedStudents < studentCount && !newGrid[seat1.r][seat1.c].occupied) {
          if (malesToPlace > 0) {
            newGrid[seat1.r][seat1.c] = { occupied: true, studentType: 'male' };
            malesToPlace--;
          } else if (femalesToPlace > 0) {
            newGrid[seat1.r][seat1.c] = { occupied: true, studentType: 'female' };
            femalesToPlace--;
          }
          placedStudents++;
        }
        seatIndex++;
        continue;
      }

      let s1_type = null, s2_type = null;
      if (settings.pairingType === 'mixed') {
        if (malesToPlace > 0 && femalesToPlace > 0) { s1_type = 'male'; s2_type = 'female'; }
        else if (malesToPlace >= 2) { s1_type = 'male'; s2_type = 'male'; }
        else if (femalesToPlace >= 2) { s1_type = 'female'; s2_type = 'female'; }
      } else if (settings.pairingType === 'samegender') {
        if (malesToPlace >= 2) { s1_type = 'male'; s2_type = 'male'; }
        else if (femalesToPlace >= 2) { s1_type = 'female'; s2_type = 'female'; }
      } else if (settings.pairingType === 'male' && malesToPlace >= 2) { s1_type = 'male'; s2_type = 'male'; }
      else if (settings.pairingType === 'female' && femalesToPlace >= 2) { s1_type = 'female'; s2_type = 'female'; }

      if (s1_type && s2_type) {
        newGrid[seat1.r][seat1.c] = { occupied: true, studentType: s1_type };
        newGrid[seat2.r][seat2.c] = { occupied: true, studentType: s2_type };
        malesToPlace -= (s1_type === 'male') + (s2_type === 'male');
        femalesToPlace -= (s1_type === 'female') + (s2_type === 'female');
        placedStudents += 2;
        seatIndex += 2;
      } else {
        if (placedStudents < studentCount && !newGrid[seat1.r][seat1.c].occupied) {
          if (malesToPlace > 0) {
            newGrid[seat1.r][seat1.c] = { occupied: true, studentType: 'male' };
            malesToPlace--;
          } else if (femalesToPlace > 0) {
            newGrid[seat1.r][seat1.c] = { occupied: true, studentType: 'female' };
            femalesToPlace--;
          }
          placedStudents++;
        }
        seatIndex++;
      }
    }
    setSeatGrid(newGrid);
  };

  const handleRandomArrangement = () => {
    if (!onRandomArrangement) return;

    // 배치 상태 확인
    const status = getPlacementStatus();
    if (status.totalOverflow || status.maleOverflow || status.femaleOverflow || status.totalUnderflow || status.maleUnderflow || status.femaleUnderflow) {
      let message = "현재 배치 상태에 문제가 있습니다:\n\n";
      if (status.maleOverflow) message += `• 남학생 ${status.placed.maleCount - status.target.maleCount}명 초과\n`;
      if (status.femaleOverflow) message += `• 여학생 ${status.placed.femaleCount - status.target.femaleCount}명 초과\n`;
      if (status.maleUnderflow) message += `• 남학생 ${status.target.maleCount - status.placed.maleCount}명 부족\n`;
      if (status.femaleUnderflow) message += `• 여학생 ${status.target.femaleCount - status.placed.femaleCount}명 부족\n`;
      message += "\n배치를 수정한 후 다시 시도해주세요.";
      
      alert(message);
      return;
    }

    const { pairingType } = settings;
    const { togetherStudents, separateStudents, considerationStudents } = teacherNotes;

    let studentPool = students.length > 0 ? [...students] : [];
    if (studentPool.length === 0) {
      for (let i = 1; i <= settings.maleCount; i++) studentPool.push({ number: `M${i}`, name: `남학생${i}`, gender: 'male' });
      for (let i = 1; i <= settings.femaleCount; i++) studentPool.push({ number: `F${i}`, name: `여학생${i}`, gender: 'female' });
    }

    const finalGrid = seatGrid.map(row => row.map(seat => ({ ...seat, studentName: null, studentId: null, studentType: null })));
    let allAvailableSeats = [];
    seatGrid.forEach((row, r) => row.forEach((seat, c) => {
      if (seat.occupied) allAvailableSeats.push({ r, c });
    }));

    // 통로가 있는지 확인하는 함수 (짝 배치를 위해)
    const hasAisleBetween = (c1, c2) => {
      const minCol = Math.min(c1, c2);
      const maxCol = Math.max(c1, c2);
      for (let i = minCol; i < maxCol; i++) {
        if (verticalAisles.has(i)) return true;
      }
      return false;
    };

    // 옆자리 (짝) 확인 함수 - 통로를 넘지 않는 바로 옆자리만
    const isAdjacent = (r1, c1, r2, c2) => {
      return r1 === r2 && Math.abs(c1 - c2) === 1 && !hasAisleBetween(c1, c2);
    };

    const isSeparated = (s1Name, s2Name) => separateStudents.some(p => new Set(p.students).has(s1Name) && new Set(p.students).has(s2Name));

    // 떨어뜨릴 학생 검사 - 상하좌우 모든 방향
    const checkNeighborSeparation = (studentName, r, c) => {
        const constraints = separateStudents.filter(p => p.students.includes(studentName));
        if (constraints.length === 0) return true;
        
        // 상하좌우 8방향 검사
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const nr = r + dr, nc = c + dc;
                if (finalGrid[nr] && finalGrid[nr][nc] && finalGrid[nr][nc].studentName) {
                    if (isSeparated(studentName, finalGrid[nr][nc].studentName)) return false;
                }
            }
        }
        return true;
    };

    const placeStudent = (student, seat) => {
        finalGrid[seat.r][seat.c] = { ...seat, occupied: true, studentName: student.name, studentId: student.number, studentType: student.gender };
        studentPool = studentPool.filter(s => s.name !== student.name);
        allAvailableSeats = allAvailableSeats.filter(s => s.r !== seat.r || s.c !== seat.c);
    };

    // 1. 먼저 '배려' 학생 배치 (최우선)
    considerationStudents.forEach(cs => {
        const student = studentPool.find(s => s.name === cs.student);
        if (!student) return;

        let targetSeats = [];
        
        if (cs.position === 'front') {
            // 맨 아래 행(교탁과 가장 가까운 행)의 모든 열
            const frontRow = gridSize.rows - 1;
            targetSeats = allAvailableSeats.filter(seat => seat.r === frontRow);
        } else if (cs.position === 'back') {
            // 맨 위 행들(교실 뒤쪽) - 한 자리만 있을 경우 앞줄도 포함
            let backRows = [0]; // 맨 뒷줄
            const backRowSeats = allAvailableSeats.filter(seat => seat.r === 0);
            
            // 뒷줄에 자리가 1개 이하면 그 앞줄도 포함
            if (backRowSeats.length <= 1 && gridSize.rows > 1) {
                backRows.push(1);
            }
            
            targetSeats = allAvailableSeats.filter(seat => backRows.includes(seat.r));
        } else if (cs.position === 'left') {
            // 왼쪽 절반의 모든 자리
            const midCol = Math.floor(gridSize.cols / 2);
            targetSeats = allAvailableSeats.filter(seat => seat.c < midCol);
        } else if (cs.position === 'right') {
            // 오른쪽 절반의 모든 자리
            const midCol = Math.floor(gridSize.cols / 2);
            targetSeats = allAvailableSeats.filter(seat => seat.c >= midCol);
        }

        // 해당 위치에서 랜덤 선택
        if (targetSeats.length > 0) {
            const shuffledTargets = targetSeats.sort(() => Math.random() - 0.5);
            for (const seat of shuffledTargets) {
                if (checkNeighborSeparation(student.name, seat.r, seat.c)) {
                    placeStudent(student, seat);
                    break;
                }
            }
        }
    });

    // 2. '붙여앉기' 학생 배치 - 랜덤 위치에 짝으로 배치
    togetherStudents.forEach(pair => {
        const s1 = studentPool.find(s => s.name === pair.students[0]);
        const s2 = studentPool.find(s => s.name === pair.students[1]);
        if (!s1 || !s2) return;

        // 가능한 짝자리 찾기
        let possiblePairs = [];
        for (let r = 0; r < gridSize.rows; r++) {
            for (let c = 0; c < gridSize.cols - 1; c++) {
                const seat1 = { r, c };
                const seat2 = { r, c: c + 1 };
                const isSeat1Available = allAvailableSeats.some(s => s.r === seat1.r && s.c === seat1.c);
                const isSeat2Available = allAvailableSeats.some(s => s.r === seat2.r && s.c === seat2.c);

                if (isSeat1Available && isSeat2Available && !hasAisleBetween(c, c + 1)) {
                    if (checkNeighborSeparation(s1.name, r, c) && checkNeighborSeparation(s2.name, r, c + 1)) {
                        possiblePairs.push([seat1, seat2]);
                    }
                }
            }
        }

        // 랜덤하게 짝자리 선택
        if (possiblePairs.length > 0) {
            const randomPair = possiblePairs[Math.floor(Math.random() * possiblePairs.length)];
            placeStudent(s1, randomPair[0]);
            placeStudent(s2, randomPair[1]);
        }
    });

    // 3. 나머지 학생 무작위 배치
    [...studentPool].forEach(student => {
        if (!studentPool.some(s => s.name === student.name)) return;
        const shuffledSeats = [...allAvailableSeats].sort(() => Math.random() - 0.5);
        for (const seat of shuffledSeats) {
            if (checkNeighborSeparation(student.name, seat.r, seat.c)) {
                placeStudent(student, seat);
                break;
            }
        }
    });

    const seatData = {
      grid: finalGrid,
      gridSize: gridSize,
      verticalAisles: Array.from(verticalAisles),
      students: students,
      settings: settings
    };

    onRandomArrangement(seatData);
  };

  // UI 렌더링 코드 (이하 동일)
  const handleSeatClick = (row, col, e) => {
    e.preventDefault();
    e.stopPropagation();
    setSeatGrid(prev => {
      const newGrid = prev.map(r => [...r]);
      const seat = newGrid[row][col];
      if (!seat.occupied) {
        newGrid[row][col] = { occupied: true, studentType: 'male' };
      } else if (seat.studentType === 'male') {
        newGrid[row][col] = { occupied: true, studentType: 'female' };
      } else {
        newGrid[row][col] = { occupied: false, studentType: null };
      }
      return newGrid;
    });
  };
  const toggleVerticalAisle = (colIndex) => { setVerticalAisles(prev => { const newAisles = new Set(prev); if (newAisles.has(colIndex)) { newAisles.delete(colIndex); } else { newAisles.add(colIndex); } return newAisles; }); };
  const addRowTop = () => { const newRow = Array(gridSize.cols).fill(null).map(() => ({ occupied: false, studentType: null })); setSeatGrid(prev => [newRow, ...prev]); setGridSize(prev => ({ ...prev, rows: prev.rows + 1 })); };
  const addRowBottom = () => { const newRow = Array(gridSize.cols).fill(null).map(() => ({ occupied: false, studentType: null })); setSeatGrid(prev => [...prev, newRow]); setGridSize(prev => ({ ...prev, rows: prev.rows + 1 })); };
  const addColumnRight = () => { setSeatGrid(prev => prev.map(row => [...row, { occupied: false, studentType: null }])); setGridSize(prev => ({ ...prev, cols: prev.cols + 1 })); };
  const addColumnLeft = () => { setSeatGrid(prev => prev.map(row => [{ occupied: false, studentType: null }, ...row])); setGridSize(prev => ({ ...prev, cols: prev.cols + 1 })); setVerticalAisles(prev => { const newAisles = new Set(); prev.forEach(index => newAisles.add(index + 1)); return newAisles; }); };
  const removeRowTop = () => { if (gridSize.rows > 1) { setSeatGrid(prev => prev.slice(1)); setGridSize(prev => ({ ...prev, rows: prev.rows - 1 })); } };
  const removeRowBottom = () => { if (gridSize.rows > 1) { setSeatGrid(prev => prev.slice(0, -1)); setGridSize(prev => ({ ...prev, rows: prev.rows - 1 })); } };
  const removeColumnRight = () => { if (gridSize.cols > 1) { setSeatGrid(prev => prev.map(row => row.slice(0, -1))); setGridSize(prev => ({ ...prev, cols: prev.cols - 1 })); setVerticalAisles(prev => { const newAisles = new Set(); prev.forEach(index => { if (index < gridSize.cols - 2) newAisles.add(index); }); return newAisles; }); } };
  const removeColumnLeft = () => { if (gridSize.cols > 1) { setSeatGrid(prev => prev.map(row => row.slice(1))); setGridSize(prev => ({ ...prev, cols: prev.cols - 1 })); setVerticalAisles(prev => { const newAisles = new Set(); prev.forEach(index => { if (index > 0) newAisles.add(index - 1); }); return newAisles; }); } };
  const manualAutoArrange = () => { const clearedGrid = seatGrid.map(row => row.map(() => ({ occupied: false, studentType: null }))); setSeatGrid(clearedGrid); setTimeout(() => autoArrangeSeats(clearedGrid), 0); };
  const clearAll = () => { setSeatGrid(prev => prev.map(row => row.map(() => ({ occupied: false, studentType: null })))); };
  const getPlacedCountByGender = () => { const allSeats = seatGrid.flat(); const maleCount = allSeats.filter(seat => seat.studentType === 'male').length; const femaleCount = allSeats.filter(seat => seat.studentType === 'female').length; return { maleCount, femaleCount, totalCount: maleCount + femaleCount }; };
  const getPlacementStatus = () => { const placed = getPlacedCountByGender(); const target = { totalCount: settings?.studentCount || 0, maleCount: settings?.maleCount || 0, femaleCount: settings?.femaleCount || 0 }; return { totalOverflow: placed.totalCount > target.totalCount, maleOverflow: placed.maleCount > target.maleCount, femaleOverflow: placed.femaleCount > target.femaleCount, totalUnderflow: placed.totalCount < target.totalCount, maleUnderflow: placed.maleCount < target.maleCount, femaleUnderflow: placed.femaleCount < target.femaleCount, placed, target }; };
  const addTogetherStudent = () => onTeacherNotesChange(prev => ({ ...prev, togetherStudents: [...prev.togetherStudents, { id: Date.now(), students: ['', ''] }] }));
  const addSeparateStudent = () => onTeacherNotesChange(prev => ({ ...prev, separateStudents: [...prev.separateStudents, { id: Date.now(), students: ['', ''] }] }));
  const addConsiderationStudent = () => onTeacherNotesChange(prev => ({ ...prev, considerationStudents: [...prev.considerationStudents, { id: Date.now(), student: '', position: 'front' }] }));
  const updateTogetherStudent = (id, index, value) => onTeacherNotesChange(prev => ({ ...prev, togetherStudents: prev.togetherStudents.map(item => item.id === id ? { ...item, students: item.students.map((s, i) => i === index ? value : s) } : item) }));
  const updateSeparateStudent = (id, index, value) => onTeacherNotesChange(prev => ({ ...prev, separateStudents: prev.separateStudents.map(item => item.id === id ? { ...item, students: item.students.map((s, i) => i === index ? value : s) } : item) }));
  const updateConsiderationStudent = (id, field, value) => onTeacherNotesChange(prev => ({ ...prev, considerationStudents: prev.considerationStudents.map(item => item.id === id ? { ...item, [field]: value } : item) }));
  const removeTogetherStudent = (id) => onTeacherNotesChange(prev => ({ ...prev, togetherStudents: prev.togetherStudents.filter(item => item.id !== id) }));
  const removeSeparateStudent = (id) => onTeacherNotesChange(prev => ({ ...prev, separateStudents: prev.separateStudents.filter(item => item.id !== id) }));
  const removeConsiderationStudent = (id) => onTeacherNotesChange(prev => ({ ...prev, considerationStudents: prev.considerationStudents.filter(item => item.id !== id) }));
  
  const handleToggleNotes = () => setShowTeacherNotes(prev => !prev);

  return (
    <div className="classroom-layout">
      <div className="classroom-header">
        <h2>🏫 교실 자리배치</h2>
        <div className="classroom-controls">
          <button className="control-btn auto" onClick={manualAutoArrange}>🎯 자동 배치</button>
          <button className="control-btn clear" onClick={clearAll}>🗑️전체 초기화</button>
          <div className="seat-counter">
            {(() => {
              const placed = getPlacedCountByGender();
              const target = { totalCount: settings?.studentCount || 0, maleCount: settings?.maleCount || 0, femaleCount: settings?.femaleCount || 0 };
              return (
                <div className="counter-details">
                  <div className="counter-total">전체: {placed.totalCount} / {target.totalCount}</div>
                  <div className="counter-gender">
                    <span className="counter-male">남: {placed.maleCount} / {target.maleCount}</span>
                    <span className="counter-female">여: {placed.femaleCount} / {target.femaleCount}</span>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {(() => {
        const status = getPlacementStatus();
        
        if (!status.totalOverflow && !status.maleOverflow && !status.femaleOverflow && !status.totalUnderflow && !status.maleUnderflow && !status.femaleUnderflow) return null;
        
        return (
          <div className={`overflow-alert ${status.totalUnderflow && !status.totalOverflow ? 'underflow-alert' : ''}`}>
            <div className="alert-icon">{status.totalOverflow || status.maleOverflow || status.femaleOverflow ? '⚠️' : '📋'}</div>
            <div className="alert-content">
              <div className="alert-title">
                {status.totalOverflow || status.maleOverflow || status.femaleOverflow ? '배치 인원 초과' : '배치 인원 부족'}
              </div>
              <div className="alert-details">
                {status.maleOverflow && <div className="alert-item">• 남학생 {status.placed.maleCount - status.target.maleCount}명 초과</div>}
                {status.femaleOverflow && <div className="alert-item">• 여학생 {status.placed.femaleCount - status.target.femaleCount}명 초과</div>}
                {status.maleUnderflow && <div className="alert-item">• 남학생 {status.target.maleCount - status.placed.maleCount}명 부족</div>}
                {status.femaleUnderflow && <div className="alert-item">• 여학생 {status.target.femaleCount - status.placed.femaleCount}명 부족</div>}
              </div>
            </div>
          </div>
        );
      })()}

      <div className="classroom-back"><span>🚪 교실 뒤</span></div>
      <div className="seating-area">
        <div className="grid-container">
          <div className="seating-grid-wrapper">
            <div className="left-column-control"><div className="add-column-btn left" onClick={addColumnLeft}>+</div></div>
            <div className="main-grid-area">
              <div className="add-row-btn top" onClick={addRowTop}>+ 위쪽 행 추가</div>
              <div className="vertical-aisle-controls">
                {Array.from({ length: Math.max(0, gridSize.cols - 1) }).map((_, index) => {
                  const seatWidth = 60, gap = 8, aisleWidth = 30, buttonWidth = 30;
                  let activeAislesBefore = 0;
                  for (let i = 0; i < index; i++) if (verticalAisles.has(i)) activeAislesBefore++;
                  let basePosition = seatWidth + (seatWidth + gap) * index + activeAislesBefore * aisleWidth;
                  let leftPosition = verticalAisles.has(index) ? basePosition + (aisleWidth / 2) - (buttonWidth / 2) : basePosition + (gap / 2) - (buttonWidth / 2);
                  return <div key={`aisle-${index}`} className={`aisle-toggle-btn ${verticalAisles.has(index) ? 'active' : ''}`} onClick={() => toggleVerticalAisle(index)} title="통로 생성/제거" style={{ position: 'absolute', left: `${leftPosition}px` }}>{verticalAisles.has(index) ? '⋯' : '⋮'}</div>;
                })}
              </div>
              <div className="seat-grid">
                {seatGrid.map((row, rowIndex) => (
                  <div key={`row-${rowIndex}`} className="seat-row">
                    {row.map((seat, colIndex) => (
                      <React.Fragment key={`${rowIndex}-${colIndex}`}>
                        {colIndex > 0 && verticalAisles.has(colIndex - 1) && <div className="vertical-aisle"></div>}
                        <div className={`seat ${seat.occupied ? 'occupied' : 'empty'} ${seat.studentType === 'male' ? 'male' : seat.studentType === 'female' ? 'female' : ''}`} onClick={(e) => handleSeatClick(rowIndex, colIndex, e)}>
                          {seat.occupied ? <><div className="student-id">{seat.studentId}</div><div className="student-name">{seat.studentName}</div><div className="remove-btn">×</div></> : <div className="empty-indicator">+</div>}
                        </div>
                      </React.Fragment>
                    ))}
                  </div>
                ))}
              </div>
              <div className="add-row-btn bottom" onClick={addRowBottom}>+ 아래쪽 행 추가</div>
            </div>
            <div className="right-column-control"><div className="add-column-btn right" onClick={addColumnRight}>+</div></div>
          </div>
          <div className="grid-controls">
            <button className="grid-control-btn" onClick={removeColumnLeft} disabled={gridSize.cols <= 1}>← 왼쪽 열 제거</button>
            <button className="grid-control-btn" onClick={removeRowTop} disabled={gridSize.rows <= 1}>↑ 위쪽 행 제거</button>
            <button className="grid-control-btn" onClick={removeRowBottom} disabled={gridSize.rows <= 1}>↓ 아래쪽 행 제거</button>
            <button className="grid-control-btn" onClick={removeColumnRight} disabled={gridSize.cols <= 1}>오른쪽 열 제거 →</button>
          </div>
        </div>
      </div>
      <div className="classroom-front"><span>🏫 교탁</span></div>

      <div className="random-arrangement-section">
        <div className="random-arrangement-header"><h3>🎲 랜덤 자리 배치</h3><p>현재 설정을 바탕으로 랜덤하게 자리를 배치하고 출력용 페이지로 이동합니다</p></div>
        <div className="random-arrangement-content">
          <div className="random-info-card">
            <div className="random-info-item"><span className="info-label">배치 방식</span><span className="info-value">{settings.seatArrangement === 'pair' ? '짝' : '혼자 앉기'}{settings.seatArrangement === 'pair' && <span className="sub-info">({settings.pairingType === 'mixed' ? '남녀' : settings.pairingType === 'samegender' ? '성별끼리' : settings.pairingType === 'male' ? '남학교' : '여학교'})</span>}</span></div>
            <div className="random-info-item"><span className="info-label">학생 수</span><span className="info-value">총 {settings.studentCount}명 (남 {settings.maleCount}명, 여 {settings.femaleCount}명)</span></div>
          </div>
          {seatData ? (
            <div className="arrangement-results-buttons">
              <button className="arrangement-result-btn view" onClick={() => onViewResults(true)}>
                <span className="btn-icon">📋</span>
                <span className="btn-text">배치 다시보기</span>
                <span className="btn-arrow">→</span>
              </button>
              <button className="arrangement-result-btn rearrange" onClick={() => {
                onResetArrangement(); // 기존 배치 데이터 초기화
                handleRandomArrangement(); // 새로운 랜덤 배치 실행
              }}>
                <span className="btn-icon">🔄</span>
                <span className="btn-text">재배치하기</span>
                <span className="btn-arrow">→</span>
              </button>
            </div>
          ) : (
            <button className="random-arrangement-btn" onClick={handleRandomArrangement}>
              <span className="btn-icon">🎲</span>
              <span className="btn-text">랜덤 배치 & 출력 페이지로 이동</span>
              <span className="btn-arrow">→</span>
            </button>
          )}
        </div>
      </div>

      <div className="teacher-notes-section">
        <div className="teacher-notes-header">
          <h3 style={{ display: showTeacherNotes ? 'inline-block' : 'none' }}>📝 교사 참고 사항</h3>
          <div className="header-right">
            <p style={{ display: showTeacherNotes ? 'block' : 'none' }}>자리 배치 시 고려할 학생들의 특별 사항을 입력하세요</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <small style={{ display: showTeacherNotes ? 'block' : 'none', color: '#666' }}>학생들에게 공개하고 싶지 않을 땐, 토글 버튼으로 닫아주세요.</small>
              <button
                className="toggle-button"
                onClick={handleToggleNotes}
                title={showTeacherNotes ? "접기" : "펼치기"}
              >
                {showTeacherNotes ? '▲' : '▼'}
              </button>
            </div>
          </div>
        </div>
        {showTeacherNotes && (
          <div className="teacher-notes-content">
            <div className="note-category">
              <div className="category-header">
                <h4>👫 붙여 앉을 학생들</h4>
                <button className="add-note-btn" onClick={addTogetherStudent}>
                  <span>+</span> 추가
                </button>
              </div>
              <div className="note-list">
                {teacherNotes.togetherStudents.map(item => (
                  <div key={item.id} className="note-item">
                    <div className="note-item-header">
                      <div className="note-item-content">
                        <div className="note-inputs">
                          <input
                            type="text"
                            placeholder="첫 번째 학생"
                            value={item.students[0]}
                            onChange={(e) => updateTogetherStudent(item.id, 0, e.target.value)}
                            className="note-input"
                          />
                          <input
                            type="text"
                            placeholder="두 번째 학생"
                            value={item.students[1]}
                            onChange={(e) => updateTogetherStudent(item.id, 1, e.target.value)}
                            className="note-input"
                          />
                        </div>
                        {(item.students[0] || item.students[1]) && (
                          <div className="note-display">
                            {item.students[0] && <span className="student-tag">{item.students[0]}</span>}
                            {item.students[0] && item.students[1] && <span className="connector-text">와</span>}
                            {item.students[1] && <span className="student-tag">{item.students[1]}</span>}
                            {item.students[0] && item.students[1] && <span className="action-text">을 붙여 앉히기</span>}
                          </div>
                        )}
                      </div>
                      <div className="note-actions">
                        <button
                          className="note-action-btn delete"
                          onClick={() => removeTogetherStudent(item.id)}
                          title="삭제"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {teacherNotes.togetherStudents.length === 0 && (
                  <div className="empty-note">
                    <div>👥</div>
                    <p>붙여 앉을 학생 조합이 없습니다</p>
                    <small>+ 추가 버튼을 눌러 학생들을 추가해보세요</small>
                  </div>
                )}
              </div>
            </div>
            <div className="note-category">
              <div className="category-header">
                <h4>↔️ 떨어뜨릴 학생들</h4>
                <button className="add-note-btn" onClick={addSeparateStudent}>
                  <span>+</span> 추가
                </button>
              </div>
              <div className="note-list">
                {teacherNotes.separateStudents.map(item => (
                  <div key={item.id} className="note-item">
                    <div className="note-item-header">
                      <div className="note-item-content">
                        <div className="note-inputs">
                          <input
                            type="text"
                            placeholder="첫 번째 학생"
                            value={item.students[0]}
                            onChange={(e) => updateSeparateStudent(item.id, 0, e.target.value)}
                            className="note-input"
                          />
                          <input
                            type="text"
                            placeholder="두 번째 학생"
                            value={item.students[1]}
                            onChange={(e) => updateSeparateStudent(item.id, 1, e.target.value)}
                            className="note-input"
                          />
                        </div>
                        {(item.students[0] || item.students[1]) && (
                          <div className="note-display">
                            {item.students[0] && <span className="student-tag">{item.students[0]}</span>}
                            {item.students[0] && item.students[1] && <span className="connector-text">와</span>}
                            {item.students[1] && <span className="student-tag">{item.students[1]}</span>}
                            {item.students[0] && item.students[1] && <span className="action-text">을 떨어뜨려 앉히기</span>}
                          </div>
                        )}
                      </div>
                      <div className="note-actions">
                        <button
                          className="note-action-btn delete"
                          onClick={() => removeSeparateStudent(item.id)}
                          title="삭제"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {teacherNotes.separateStudents.length === 0 && (
                  <div className="empty-note">
                    <div>↔️</div>
                    <p>떨어뜨릴 학생 조합이 없습니다</p>
                    <small>+ 추가 버튼을 눌러 학생들을 추가해보세요</small>
                  </div>
                )}
              </div>
            </div>
            <div className="note-category">
              <div className="category-header">
                <h4>🎯 배려할 학생들</h4>
                <button className="add-note-btn" onClick={addConsiderationStudent}>
                  <span>+</span> 추가
                </button>
              </div>
              <div className="note-list">
                {teacherNotes.considerationStudents.map(item => (
                  <div key={item.id} className="note-item">
                    <div className="note-item-header">
                      <div className="note-item-content">
                        <div className="note-inputs">
                          <input
                            type="text"
                            placeholder="학생 이름"
                            value={item.student}
                            onChange={(e) => updateConsiderationStudent(item.id, 'student', e.target.value)}
                            className="note-input"
                          />
                          <select
                            value={item.position}
                            onChange={(e) => updateConsiderationStudent(item.id, 'position', e.target.value)}
                            className="note-input position-select"
                          >
                            <option value="front">🔝 앞쪽</option>
                            <option value="back">🔽 뒤쪽</option>
                            <option value="left">◀️ 왼쪽</option>
                            <option value="right">▶️ 오른쪽</option>
                          </select>
                        </div>
                        {item.student && (
                          <div className="note-display">
                            <span className="student-tag">{item.student}</span>
                            <span className="connector-text">을</span>
                            <span className="position-tag">
                              {item.position === 'front'
                                ? '🔝 앞쪽'
                                : item.position === 'back'
                                ? '🔽 뒤쪽'
                                : item.position === 'left'
                                ? '◀️ 왼쪽'
                                : '▶️ 오른쪽'}
                            </span>
                            <span className="action-text">에 배치</span>
                          </div>
                        )}
                      </div>
                      <div className="note-actions">
                        <button
                          className="note-action-btn delete"
                          onClick={() => removeConsiderationStudent(item.id)}
                          title="삭제"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {teacherNotes.considerationStudents.length === 0 && (
                  <div className="empty-note">
                    <div>🎯</div>
                    <p>배려할 학생이 없습니다</p>
                    <small>+ 추가 버튼을 눌러 학생을 추가해보세요</small>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClassroomLayout;
