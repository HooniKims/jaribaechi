import React, { useState, useEffect, useCallback } from 'react';
import './ClassroomLayout.css';

const LAYOUT_STORAGE_KEY = 'jaribaechi-layout-state-v1';

const createEmptySeatGrid = (rows, cols) =>
  Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ occupied: false, studentType: null }))
  );

const cloneSeatGrid = (grid) => grid.map(row => row.map(seat => ({ ...seat })));

const getLayoutSignature = (settings) =>
  JSON.stringify({
    studentCount: Number(settings?.studentCount || 0),
    maleCount: Number(settings?.maleCount || 0),
    femaleCount: Number(settings?.femaleCount || 0),
    seatArrangement: settings?.seatArrangement || 'pair',
    pairingType: settings?.pairingType || 'mixed',
  });

const loadPersistedLayoutState = () => {
  if (typeof window === 'undefined') return null;

  try {
    const rawLayout = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!rawLayout) return null;

    const parsedLayout = JSON.parse(rawLayout);
    return parsedLayout && typeof parsedLayout === 'object' ? parsedLayout : null;
  } catch (error) {
    console.error('??λ맂 醫뚯꽍 ?덉씠?꾩썐??遺덈윭?ㅼ? 紐삵뻽?듬땲??', error);
    return null;
  }
};

const isValidPersistedLayout = (layout) => {
  if (!layout?.gridSize || !Array.isArray(layout?.seatGrid)) return false;

  const rows = Number(layout.gridSize.rows);
  const cols = Number(layout.gridSize.cols);

  return (
    Number.isInteger(rows) &&
    Number.isInteger(cols) &&
    rows > 0 &&
    cols > 0 &&
    layout.seatGrid.length === rows &&
    layout.seatGrid.every(row => Array.isArray(row) && row.length === cols)
  );
};

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
  const layoutSignature = getLayoutSignature(settings);

  // ?붾㈃ ?ш린???곕Ⅸ 理쒖쟻 洹몃━???ш린 怨꾩궛
  const calculateOptimalGridSize = (studentCount, seatArrangement) => {
    // ?붾㈃ ?ш린 湲곗? 怨꾩궛
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // ?ㅼ젣 ?ъ슜 媛?ν븳 理쒕? ?덈퉬 ?ㅼ젙 (780px蹂대떎 ?묎쾶)
    const maxAvailableWidth = Math.min(780, viewportWidth * 0.9);
    const availableHeight = viewportHeight * 0.65; // 65vh ?ъ슜
    
    // 醫뚯꽍 ?ш린? 媛꾧꺽??怨좊젮??理쒕? 媛?ν븳 ?닿낵 ??怨꾩궛
    let seatSize = Math.max(35, Math.min(55, viewportWidth * 0.04)); // 35px ~ 55px, 4vw
    let seatGap = Math.max(4, Math.min(8, viewportWidth * 0.008)); // 4px ~ 8px, 0.8vw
    
    // 醫뚯꽍 ?ш린瑜??숈쟻?쇰줈 議곗젙?댁꽌 maxAvailableWidth??留욎땄
    const estimatedCols = Math.ceil(Math.sqrt(studentCount * 1.2));
    let estimatedRowWidth = estimatedCols * (seatSize + seatGap) - seatGap; // 留덉?留?gap ?쒖쇅
    
    // 留뚯빟 異붿젙 ?덈퉬媛 理쒕? ?덈퉬瑜?珥덇낵?섎㈃ 醫뚯꽍 ?ш린瑜?以꾩엫
    if (estimatedRowWidth > maxAvailableWidth) {
      const availableWidthPerSeat = maxAvailableWidth / estimatedCols;
      seatSize = Math.max(30, availableWidthPerSeat - seatGap); // 理쒖냼 30px 蹂댁옣
      seatGap = Math.max(2, Math.min(seatGap, (maxAvailableWidth - estimatedCols * seatSize) / (estimatedCols - 1)));
    }
    
    const maxCols = Math.floor((maxAvailableWidth + seatGap) / (seatSize + seatGap));
    const maxRows = Math.floor(availableHeight / (seatSize + seatGap));
    
    let rows, cols;
    
    if (seatArrangement === 'single') {
      // ?⑥씪 諛곗튂: 理쒕? ?덈퉬瑜??섏? ?딅뒗 踰붿쐞?먯꽌 理쒖쟻 諛곗튂 怨꾩궛
      cols = Math.min(maxCols, Math.ceil(Math.sqrt(studentCount * 1.2)));
      rows = Math.ceil(studentCount / cols);
      
      // ?됱씠 ?덈Т 留롮쑝硫??댁쓣 ?섎젮??議곗젙 (理쒕? ?덈퉬 ?댁뿉??
      while (rows > maxRows && cols < maxCols) {
        cols++;
        rows = Math.ceil(studentCount / cols);
      }
      
      // 理쒖쥌 寃利? ?ㅼ젣 ?덈퉬媛 maxAvailableWidth瑜??섏? ?딅뒗吏 ?뺤씤
      const actualRowWidth = cols * seatSize + (cols - 1) * seatGap;
      if (actualRowWidth > maxAvailableWidth) {
        cols = Math.floor((maxAvailableWidth + seatGap) / (seatSize + seatGap));
        rows = Math.ceil(studentCount / cols);
      }
    } else {
      // ??諛곗튂: 理쒕? ?덈퉬瑜??섏? ?딅뒗 踰붿쐞?먯꽌 理쒖쟻 諛곗튂 怨꾩궛
      const pairCount = Math.ceil(studentCount / 2);
      cols = Math.min(maxCols, Math.ceil(Math.sqrt(pairCount * 1.5)));
      cols = cols % 2 === 0 ? cols : Math.min(maxCols, cols + 1); // ??諛곗튂瑜??꾪빐 吏앹닔濡?議곗젙
      rows = Math.ceil(pairCount / (cols / 2));
      
      // 理쒖쥌 寃利?
      const actualRowWidth = cols * seatSize + (cols - 1) * seatGap;
      if (actualRowWidth > maxAvailableWidth) {
        cols = Math.floor((maxAvailableWidth + seatGap) / (seatSize + seatGap));
        cols = cols % 2 === 0 ? cols : cols - 1; // 吏앹닔濡?留욎땄
        rows = Math.ceil(pairCount / (cols / 2));
      }
    }
    
    // 理쒖냼媛?蹂댁옣
    rows = Math.max(2, Math.min(maxRows, rows));
    cols = Math.max(3, Math.min(maxCols, cols));
    
    console.log(`怨꾩궛??洹몃━?? ${cols}??x ${rows}?? ?덉긽 ?덈퉬: ${cols * seatSize + (cols - 1) * seatGap}px (理쒕?: ${maxAvailableWidth}px)`);
    
    return { rows, cols };
  };

  useEffect(() => {
    const persistedLayout = loadPersistedLayoutState();
    if (persistedLayout?.signature === layoutSignature && isValidPersistedLayout(persistedLayout)) {
      setGridSize(persistedLayout.gridSize);
      setVerticalAisles(new Set(Array.isArray(persistedLayout.verticalAisles) ? persistedLayout.verticalAisles : []));
      setSeatGrid(cloneSeatGrid(persistedLayout.seatGrid));
      setShowTeacherNotes(
        typeof persistedLayout.showTeacherNotes === 'boolean' ? persistedLayout.showTeacherNotes : true
      );
      return;
    }

    // 湲곕낯 洹몃━???ш린瑜?5??6?대줈 ?ㅼ젙
    const defaultRows = 5;
    const defaultCols = 6;
    const studentCount = settings.studentCount || 0;
    
    let rows, cols;
    
    if (studentCount === 0) {
      // ?숈깮???놁쓣 ?뚮뒗 湲곕낯 5??6??鍮?怨듦컙 ?쒖떆
      rows = defaultRows;
      cols = defaultCols;
    } else {
      // ?숈깮???덉쓣 ?뚮뒗 湲곕낯 洹몃━?쒕? 湲곗??쇰줈 諛곗튂?섎릺, ?꾩슂???뺤옣
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
    setShowTeacherNotes(true);

    const newGrid = createEmptySeatGrid(rows, cols);
    setSeatGrid(newGrid);
    autoArrangeSeats(newGrid, newAisles);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutSignature]);

  // ?붾㈃ ?ш린 蹂寃?媛먯?
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

  useEffect(() => {
    if (!seatGrid.length || typeof window === 'undefined') return;

    try {
      window.localStorage.setItem(
        LAYOUT_STORAGE_KEY,
        JSON.stringify({
          signature: layoutSignature,
          seatGrid,
          gridSize,
          verticalAisles: Array.from(verticalAisles),
          showTeacherNotes,
        })
      );
    } catch (error) {
      console.error('醫뚯꽍 ?덉씠?꾩썐????ν븯吏 紐삵뻽?듬땲??', error);
    }
  }, [layoutSignature, seatGrid, gridSize, verticalAisles, showTeacherNotes]);

  const autoArrangeSeats = useCallback((initialGrid = null, aislesOverride = null) => {
    const { studentCount, maleCount, femaleCount, seatArrangement } = settings;
    const gridToUse = initialGrid || seatGrid;
    const aislesToUse = aislesOverride || verticalAisles;
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

      if (seat1.r !== seat2.r || aislesToUse.has(seat1.c)) {
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
        // ?⑤? 吏? ?곗꽑 ?⑤? ?욎뼱???됲엳怨? 媛숈? ?깅퀎?쇰━??諛곗튂
        if (malesToPlace > 0 && femalesToPlace > 0) { 
          s1_type = 'male'; s2_type = 'female'; 
        }
        else if (malesToPlace >= 2) { 
          s1_type = 'male'; s2_type = 'male'; 
        }
        else if (femalesToPlace >= 2) { 
          s1_type = 'female'; s2_type = 'female'; 
        }
      } else if (settings.pairingType === 'samegender') {
        // ?깅퀎 吏? 媛숈? ?깅퀎?쇰━留??됲옒
        if (malesToPlace >= 2) { 
          s1_type = 'male'; s2_type = 'male'; 
        }
        else if (femalesToPlace >= 2) { 
          s1_type = 'female'; s2_type = 'female'; 
        }
      } else if (settings.pairingType === 'male' && malesToPlace >= 2) { 
        // ?⑦븰援? ?⑥옄留??덉쓬
        s1_type = 'male'; s2_type = 'male'; 
      }
      else if (settings.pairingType === 'female' && femalesToPlace >= 2) { 
        // ?ы븰援? ?ъ옄留??덉쓬
        s1_type = 'female'; s2_type = 'female'; 
      }

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
  }, [settings, seatGrid, verticalAisles]);

  const handleRandomArrangement = () => {
    if (!onRandomArrangement) return;

    // 諛곗튂 ?곹깭 ?뺤씤
    const status = getPlacementStatus();
    const placementIssueLines = [];

    if (status.maleOverflow) placementIssueLines.push(`남학생 ${status.placed.maleCount - status.target.maleCount}명 초과`);
    if (status.femaleOverflow) placementIssueLines.push(`여학생 ${status.placed.femaleCount - status.target.femaleCount}명 초과`);
    if (status.maleUnderflow) placementIssueLines.push(`남학생 ${status.target.maleCount - status.placed.maleCount}명 부족`);
    if (status.femaleUnderflow) placementIssueLines.push(`여학생 ${status.target.femaleCount - status.placed.femaleCount}명 부족`);

    if (placementIssueLines.length > 0 || status.totalOverflow || status.totalUnderflow) {
      alert(`현재 배치 상태에 문제가 있습니다:\n\n${placementIssueLines.join('\n')}\n\n배치를 시작하기 전에 위 인원 수를 맞춰주세요.`);
      return;
    }
    if (false && (status.totalOverflow || status.maleOverflow || status.femaleOverflow || status.totalUnderflow || status.maleUnderflow || status.femaleUnderflow)) {
      let message = "?꾩옱 諛곗튂 ?곹깭??臾몄젣媛 ?덉뒿?덈떎:\n\n";
      if (status.maleOverflow) message += `???⑦븰??${status.placed.maleCount - status.target.maleCount}紐?珥덇낵\n`;
      if (status.femaleOverflow) message += `???ы븰??${status.placed.femaleCount - status.target.femaleCount}紐?珥덇낵\n`;
      if (status.maleUnderflow) message += `???⑦븰??${status.target.maleCount - status.placed.maleCount}紐?遺議?n`;
      if (status.femaleUnderflow) message += `???ы븰??${status.target.femaleCount - status.placed.femaleCount}紐?遺議?n`;
      message += "\n諛곗튂瑜??섏젙?????ㅼ떆 ?쒕룄?댁＜?몄슂.";
      
      alert(message);
      return;
    }

    // const { pairingType } = settings; // ?ъ슜?섏? ?딅뒗 蹂???쒓굅
    const { togetherStudents, separateStudents, considerationStudents } = teacherNotes;

    // ?숈깮 ? 留뚮뱾湲? 湲곗〈 ?숈깮 ?곗씠?곌? ?덉쑝硫??ъ슜?섍퀬 ?놁쑝硫??덈줈 ?앹꽦
    let studentPool = students.length > 0 ? [...students] : [];
    if (studentPool.length === 0) {
      // ?숈깮 ?곗씠?곌? ?녿뒗 寃쎌슦 ?ㅼ젙???몄썝?섏뿉 留욊쾶 ?앹꽦
      for (let i = 1; i <= settings.maleCount; i++) {
        studentPool.push({ 
          number: `M${i}`, 
          legacyName: `?⑦븰??{i}`,
          gender: 'male',
          name: `남학생${i}`,
        });
      }
      for (let i = 1; i <= settings.femaleCount; i++) {
        studentPool.push({ 
          number: `F${i}`, 
          legacyName: `?ы븰??{i}`,
          gender: 'female',
          name: `여학생${i}`,
        });
      }
      studentPool = studentPool.map(student => ({
        ...student,
        name:
          student.gender === 'male'
            ? `남학생${student.number.replace(/^M/, '')}`
            : `여학생${student.number.replace(/^F/, '')}`,
      }));
    } else {
      // 湲곗〈 ?숈깮 ?곗씠?곌? ?덉쑝硫?gender ?띿꽦???쒕?濡??ㅼ젙?섏뼱 ?덈뒗吏 ?뺤씤
      studentPool = studentPool.map(student => {
        // ?깅퀎???녿뒗 寃쎌슦, ?숇쾲 泥?湲?먮줈 ?깅퀎 ?좎텛
        if (!student.gender) {
          if (student.number && student.number.startsWith('M')) {
            return { ...student, gender: 'male' };
          } else if (student.number && student.number.startsWith('F')) {
            return { ...student, gender: 'female' };
          } else {
            // ?먮떒?????녿뒗 寃쎌슦 湲곕낯媛?
            return { ...student, gender: 'male' };
          }
        }
        return student;
      });
    }

    const finalGrid = seatGrid.map(row =>
      row.map(seat => ({ ...seat, studentName: null, studentId: null, studentType: null }))
    );
    let allAvailableSeats = [];
    seatGrid.forEach((row, r) => row.forEach((seat, c) => {
      if (seat.occupied) allAvailableSeats.push({ r, c });
    }));

    const getTemplateSeat = (seat) => seatGrid[seat.r]?.[seat.c];
    const canPlaceStudentInSeat = (student, seat) => {
      const templateSeat = getTemplateSeat(seat);
      if (!templateSeat?.occupied) return false;
      return !templateSeat.studentType || templateSeat.studentType === student.gender;
    };

    const getValidPairAssignments = (student1, student2, seat1, seat2) => {
      const candidateAssignments = [
        [{ student: student1, seat: seat1 }, { student: student2, seat: seat2 }],
        [{ student: student1, seat: seat2 }, { student: student2, seat: seat1 }],
      ];

      return candidateAssignments.filter(([first, second]) =>
        canPlaceStudentInSeat(first.student, first.seat) &&
        canPlaceStudentInSeat(second.student, second.seat)
      );
    };

    // ?듬줈媛 ?덈뒗吏 ?뺤씤?섎뒗 ?⑥닔 (吏?諛곗튂瑜??꾪빐)
    const hasAisleBetween = (c1, c2) => {
      const minCol = Math.min(c1, c2);
      const maxCol = Math.max(c1, c2);
      for (let i = minCol; i < maxCol; i++) {
        if (verticalAisles.has(i)) return true;
      }
      return false;
    };

    // ?놁옄由?(吏? ?뺤씤 ?⑥닔 - ?듬줈瑜??섏? ?딅뒗 諛붾줈 ?놁옄由щ쭔 (?ъ슜?섏? ?딆쓬)
    // const isAdjacent = (r1, c1, r2, c2) => {
    //   return r1 === r2 && Math.abs(c1 - c2) === 1 && !hasAisleBetween(c1, c2);
    // };

    // 遺꾨━ ?뺤씤 ?⑥닔 - ?대쫫 ?먮뒗 ?숇쾲?쇰줈 鍮꾧탳
    const isSeparated = (identifier1, identifier2) => {
      return separateStudents.some(p => {
        const students = p.students;
        return students.includes(identifier1) && students.includes(identifier2);
      });
    };

    // ?⑥뼱?⑤┫ ?숈깮 寃??- ?곹븯醫뚯슦 紐⑤뱺 諛⑺뼢
    const checkNeighborSeparation = (studentIdentifier, r, c) => {
        const constraints = separateStudents.filter(p => p.students.includes(studentIdentifier));
        if (constraints.length === 0) return true;
        
        // ?곹븯醫뚯슦 8諛⑺뼢 寃??
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const nr = r + dr, nc = c + dc;
                if (finalGrid[nr] && finalGrid[nr][nc] && finalGrid[nr][nc].studentName) {
                    const neighborIdentifier = finalGrid[nr][nc].studentName || finalGrid[nr][nc].studentId;
                    if (isSeparated(studentIdentifier, neighborIdentifier)) return false;
                }
            }
        }
        return true;
    };

    // ?숈깮 寃???⑥닔 - ?대쫫 ?먮뒗 ?숇쾲?쇰줈 寃??
    const findStudentByNameOrNumber = (searchValue) => {
      return studentPool.find(s => {
        // ?대쫫???덉쑝硫??대쫫?쇰줈 寃??
        if (s.name && s.name.trim() !== '' && s.name === searchValue) {
          return true;
        }
        // ?대쫫???녾굅??鍮꾩뼱?덉쑝硫??숇쾲?쇰줈 寃??
        if ((!s.name || s.name.trim() === '') && s.number === searchValue) {
          return true;
        }
        return false;
      });
    };

    const placeStudent = (student, seat) => {
        const templateSeat = getTemplateSeat(seat);
        finalGrid[seat.r][seat.c] = {
          ...templateSeat,
          occupied: true,
          studentName: student.name,
          studentId: student.number,
          studentType: student.gender
        };
        studentPool = studentPool.filter(s => s !== student);
        allAvailableSeats = allAvailableSeats.filter(s => s.r !== seat.r || s.c !== seat.c);
    };

    // 1. 癒쇱? '諛곕젮' ?숈깮 諛곗튂 (理쒖슦??
    considerationStudents.forEach(cs => {
        const student = findStudentByNameOrNumber(cs.student);
        if (!student) return;

        const studentIdentifier = student.name || student.number;
        let targetSeats = [];
        
        if (cs.position === 'front') {
            // 留??꾨옒 ??援먰긽怨?媛??媛源뚯슫 ????紐⑤뱺 ??
            const frontRow = gridSize.rows - 1;
            targetSeats = allAvailableSeats.filter(seat => seat.r === frontRow);
        } else if (cs.position === 'back') {
            // 留????됰뱾(援먯떎 ?ㅼそ) - ???먮━留??덉쓣 寃쎌슦 ?욎쨪???ы븿
            let backRows = [0]; // 留??룹쨪
            const backRowSeats = allAvailableSeats.filter(seat => seat.r === 0);
            
            // ?룹쨪???먮━媛 1媛??댄븯硫?洹??욎쨪???ы븿
            if (backRowSeats.length <= 1 && gridSize.rows > 1) {
                backRows.push(1);
            }
            
            targetSeats = allAvailableSeats.filter(seat => backRows.includes(seat.r));
        } else if (cs.position === 'left') {
            // ?쇱そ ?덈컲??紐⑤뱺 ?먮━
            const midCol = Math.floor(gridSize.cols / 2);
            targetSeats = allAvailableSeats.filter(seat => seat.c < midCol);
        } else if (cs.position === 'right') {
            // ?ㅻⅨ履??덈컲??紐⑤뱺 ?먮━
            const midCol = Math.floor(gridSize.cols / 2);
            targetSeats = allAvailableSeats.filter(seat => seat.c >= midCol);
        }

        // ?대떦 ?꾩튂?먯꽌 ?쒕뜡 ?좏깮
        if (targetSeats.length > 0) {
            const shuffledTargets = targetSeats
              .filter(seat => canPlaceStudentInSeat(student, seat))
              .sort(() => Math.random() - 0.5);
            for (const seat of shuffledTargets) {
                if (checkNeighborSeparation(studentIdentifier, seat.r, seat.c)) {
                    placeStudent(student, seat);
                    break;
                }
            }
        }
    });

    // 2. '遺숈뿬?됯린' ?숈깮 諛곗튂 - ?쒕뜡 ?꾩튂??吏앹쑝濡?諛곗튂
    togetherStudents.forEach(pair => {
        const s1 = findStudentByNameOrNumber(pair.students[0]);
        const s2 = findStudentByNameOrNumber(pair.students[1]);
        if (!s1 || !s2) return;

        // 媛?ν븳 吏앹옄由?李얘린
        let possibleAssignments = [];
        for (let r = 0; r < gridSize.rows; r++) {
            for (let c = 0; c < gridSize.cols - 1; c++) {
                const seat1 = { r, c };
                const seat2 = { r, c: c + 1 };
                const isSeat1Available = allAvailableSeats.some(s => s.r === seat1.r && s.c === seat1.c);
                const isSeat2Available = allAvailableSeats.some(s => s.r === seat2.r && s.c === seat2.c);

                if (isSeat1Available && isSeat2Available && !hasAisleBetween(c, c + 1)) {
                    const validAssignments = getValidPairAssignments(s1, s2, seat1, seat2);
                    validAssignments.forEach(([first, second]) => {
                        const firstIdentifier = first.student.name || first.student.number;
                        const secondIdentifier = second.student.name || second.student.number;
                        if (
                          checkNeighborSeparation(firstIdentifier, first.seat.r, first.seat.c) &&
                          checkNeighborSeparation(secondIdentifier, second.seat.r, second.seat.c)
                        ) {
                          possibleAssignments.push([first, second]);
                        }
                    });
                }
            }
        }

        // ?쒕뜡?섍쾶 吏앹옄由??좏깮
        if (possibleAssignments.length > 0) {
            const randomAssignment = possibleAssignments[Math.floor(Math.random() * possibleAssignments.length)];
            placeStudent(randomAssignment[0].student, randomAssignment[0].seat);
            placeStudent(randomAssignment[1].student, randomAssignment[1].seat);
        }
    });

    // 3. 吏?諛곗튂 諛??섎㉧吏 ?숈깮 臾댁옉??諛곗튂
    if (settings.seatArrangement === 'pair' && settings.pairingType !== 'single') {
        // ?깅퀎???곕씪 ?숈깮 遺꾨쪟
        const maleStudents = studentPool.filter(s => s.gender === 'male').sort(() => Math.random() - 0.5);
        const femaleStudents = studentPool.filter(s => s.gender === 'female').sort(() => Math.random() - 0.5);
        const takeStudentByGender = (gender) => {
            if (gender === 'male') return maleStudents.pop() || null;
            if (gender === 'female') return femaleStudents.pop() || null;
            return maleStudents.pop() || femaleStudents.pop() || null;
        };
        const restoreStudent = (student) => {
            if (!student) return;
            if (student.gender === 'female') {
                femaleStudents.push(student);
                return;
            }
            maleStudents.push(student);
        };
        
        // ?⑥? ?먮━ 以?吏앹쑝濡??됱쓣 ???덈뒗 ?먮━ 李얘린
        let possiblePairs = [];
        for (let r = 0; r < gridSize.rows; r++) {
            for (let c = 0; c < gridSize.cols - 1; c++) {
                const seat1 = { r, c };
                const seat2 = { r, c: c + 1 };
                
                const isSeat1Available = allAvailableSeats.some(s => s.r === seat1.r && s.c === seat1.c);
                const isSeat2Available = allAvailableSeats.some(s => s.r === seat2.r && s.c === seat2.c);
                
                if (isSeat1Available && isSeat2Available && !hasAisleBetween(c, c + 1)) {
                    possiblePairs.push([seat1, seat2]);
                }
            }
        }
        
        // 媛?ν븳 紐⑤뱺 吏앹옄由щ? ?쒕뜡?섍쾶 ?욊린
        const shuffledPairs = possiblePairs.sort(() => Math.random() - 0.5);
        
        // 吏??좏삎??留욊쾶 ?숈깮 諛곗튂
        for (const pair of shuffledPairs) {
            const [seat1, seat2] = pair;
            const seat1Template = getTemplateSeat(seat1);
            const seat2Template = getTemplateSeat(seat2);
            const student1 = takeStudentByGender(seat1Template?.studentType);
            const student2 = takeStudentByGender(seat2Template?.studentType);

            if (!student1 || !student2) {
                restoreStudent(student1);
                restoreStudent(student2);
                continue;
            }
            
            // 遺꾨━ ?붿껌???숈깮?몄? ?뺤씤
            const identifier1 = student1.name || student1.number;
            const identifier2 = student2.name || student2.number;
            
            // ???숈깮??遺꾨━ ??곸씠 ?꾨땲硫?諛곗튂
            if (!isSeparated(identifier1, identifier2) &&
                checkNeighborSeparation(identifier1, seat1.r, seat1.c) &&
                checkNeighborSeparation(identifier2, seat2.r, seat2.c)) {
                placeStudent(student1, seat1);
                placeStudent(student2, seat2);
            } else {
                restoreStudent(student1);
                restoreStudent(student2);
            }
        }
        
        // ?⑥? ?숈깮?ㅼ쓣 ?ㅼ떆 ????⑹튂湲?
        studentPool = [...maleStudents, ...femaleStudents];
    }
    
    // ?⑥? ?숈깮??臾댁옉??諛곗튂
    [...studentPool].forEach(student => {
        if (!studentPool.includes(student)) return;
        const shuffledSeats = [...allAvailableSeats]
          .filter(seat => canPlaceStudentInSeat(student, seat))
          .sort(() => Math.random() - 0.5);
        for (const seat of shuffledSeats) {
            if (checkNeighborSeparation(student.name || student.number, seat.r, seat.c)) {
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

  // UI ?뚮뜑留?肄붾뱶 (?댄븯 ?숈씪)
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
          <button className="control-btn auto" onClick={manualAutoArrange}>🎲 자동 배치</button>
          <button className="control-btn clear" onClick={clearAll}>🗑️ 전체 초기화</button>
          <div className="seat-counter">
            {(() => {
              const placed = getPlacedCountByGender();
              const target = { totalCount: settings?.studentCount || 0, maleCount: settings?.maleCount || 0, femaleCount: settings?.femaleCount || 0 };
              return (
                <div className="counter-details">
                  <div className="counter-total">전체: {placed.totalCount} / {target.totalCount}</div>
                  <div className="counter-gender">
                    <span className="counter-male">남 {placed.maleCount} / {target.maleCount}</span>
                    <span className="counter-female">여 {placed.femaleCount} / {target.femaleCount}</span>
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
            <div className="alert-icon">{status.totalOverflow || status.maleOverflow || status.femaleOverflow ? '⚠️' : 'ℹ️'}</div>
            <div className="alert-content">
              <div className="alert-title">
                {status.totalOverflow || status.maleOverflow || status.femaleOverflow ? '배치 인원 초과' : '배치 인원 부족'}
              </div>
              <div className="alert-details">
                {status.maleOverflow && <div className="alert-item">남학생 {status.placed.maleCount - status.target.maleCount}명 초과</div>}
                {status.femaleOverflow && <div className="alert-item">여학생 {status.placed.femaleCount - status.target.femaleCount}명 초과</div>}
                {status.maleUnderflow && <div className="alert-item">남학생 {status.target.maleCount - status.placed.maleCount}명 부족</div>}
                {status.femaleUnderflow && <div className="alert-item">여학생 {status.target.femaleCount - status.placed.femaleCount}명 부족</div>}
              </div>
            </div>
          </div>
        );
      })()}

      <div className="classroom-back"><span>🏫 교실 뒤</span></div>
      <div className="seating-area">
        <div className="grid-container">
          <div className="seating-grid-wrapper">
            <div className="left-column-control"><div className="add-column-btn left" onClick={addColumnLeft}>+</div></div>
            <div className="main-grid-area">
              <div className="add-row-btn top" onClick={addRowTop}>+ 위쪽 행 추가</div>
              <div className="vertical-aisle-controls">
                {Array.from({ length: Math.max(0, gridSize.cols - 1) }).map((_, index) => {
                  const seatWidth = 60;
                  const gap = 8;
                  const aisleWidth = 30;
                  const buttonWidth = 36;
                  const isActive = verticalAisles.has(index);
                  const controlLabel = isActive ? '통로 삭제' : '통로 추가';
                  let activeAislesBefore = 0;
                  for (let i = 0; i < index; i++) if (verticalAisles.has(i)) activeAislesBefore++;
                  const basePosition = seatWidth + (seatWidth + gap) * index + activeAislesBefore * aisleWidth;
                  const leftPosition = isActive
                    ? basePosition + (aisleWidth / 2) - (buttonWidth / 2)
                    : basePosition + (gap / 2) - (buttonWidth / 2);

                  return (
                    <button
                      key={`aisle-${index}`}
                      type="button"
                      className={`aisle-toggle-btn ${isActive ? 'active' : ''}`}
                      onClick={() => toggleVerticalAisle(index)}
                      title={controlLabel}
                      aria-label={controlLabel}
                      aria-pressed={isActive}
                      style={{ left: `${leftPosition}px`, top: 0 }}
                    >
                      <span className="aisle-toggle-icon">{isActive ? '-' : '+'}</span>
                    </button>
                  );
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
        <div className="random-arrangement-header"><h3>🎲 랜덤 자리 배치</h3><p>현재 설정과 좌석 템플릿을 기준으로 랜덤하게 자리를 배치하고 출력 페이지로 이동합니다.</p></div>
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
                onResetArrangement(); // 湲곗〈 諛곗튂 ?곗씠??珥덇린??
                handleRandomArrangement(); // ?덈줈???쒕뜡 諛곗튂 ?ㅽ뻾
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
            <p style={{ display: showTeacherNotes ? 'block' : 'none' }}>자리 배치 시 고려할 학생들의 특이사항을 입력하세요.</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <small style={{ display: showTeacherNotes ? 'block' : 'none', color: '#666' }}>학생들에게 공개하고 싶지 않다면 토글 버튼으로 접어둘 수 있습니다.</small>
              <button
                className="toggle-button"
                onClick={handleToggleNotes}
                title={showTeacherNotes ? '접기' : '펼치기'}
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
                            placeholder="학생 이름 1"
                            value={item.students[0]}
                            onChange={(e) => updateTogetherStudent(item.id, 0, e.target.value)}
                            className="note-input"
                          />
                          <input
                            type="text"
                            placeholder="학생 이름 2"
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
                            placeholder="학생 이름 1"
                            value={item.students[0]}
                            onChange={(e) => updateSeparateStudent(item.id, 0, e.target.value)}
                            className="note-input"
                          />
                          <input
                            type="text"
                            placeholder="학생 이름 2"
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
                            <option value="front">앞쪽</option>
                            <option value="back">뒤쪽</option>
                            <option value="left">왼쪽</option>
                            <option value="right">오른쪽</option>
                          </select>
                        </div>
                        {item.student && (
                          <div className="note-display">
                            <span className="student-tag">{item.student}</span>
                            <span className="connector-text">을</span>
                            <span className="position-tag">
                              {item.position === 'front'
                                ? '앞쪽'
                                : item.position === 'back'
                                ? '뒤쪽'
                                : item.position === 'left'
                                ? '왼쪽'
                                : '오른쪽'}
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
