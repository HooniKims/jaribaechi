import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from 'react';
import './ClassroomLayout.css';
import {
  buildCanonicalStudentPool,
  formatStudentOptionLabel,
  generateSeatingArrangement,
  getArrangementModeLabel,
  getEffectiveDeskLayout,
  isGenderFreeMode,
  matchStudentQuery,
  resolveTeacherNotes,
} from '../utils/seatingAlgorithm';

export const LAYOUT_STORAGE_KEY = 'jaribaechi-layout-state-v1';

const createEmptySeatGrid = (rows, cols) =>
  Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ occupied: false, studentType: null }))
  );

const cloneSeatGrid = (grid) => grid.map((row) => row.map((seat) => ({ ...seat })));

const getLayoutSignature = (settings) =>
  JSON.stringify({
    studentCount: Number(settings?.studentCount || 0),
    maleCount: isGenderFreeMode(settings) ? 0 : Number(settings?.maleCount || 0),
    femaleCount: isGenderFreeMode(settings) ? 0 : Number(settings?.femaleCount || 0),
    seatArrangement: settings?.seatArrangement || 'pair',
    pairingType: settings?.pairingType || 'mixed',
    deskLayout: settings?.deskLayout || 'pair',
  });

const loadPersistedLayoutState = () => {
  if (typeof window === 'undefined') return null;

  try {
    const rawLayout = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!rawLayout) return null;

    const parsedLayout = JSON.parse(rawLayout);
    return parsedLayout && typeof parsedLayout === 'object' ? parsedLayout : null;
  } catch (error) {
    console.error('저장된 좌석 레이아웃을 불러오지 못했습니다.', error);
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
    layout.seatGrid.every((row) => Array.isArray(row) && row.length === cols)
  );
};

export const loadCurrentLayoutForArrangement = (fallbackSeatData = null) => {
  const persisted = loadPersistedLayoutState();
  if (isValidPersistedLayout(persisted)) {
    return {
      seatGrid: cloneSeatGrid(persisted.seatGrid),
      verticalAisles: new Set(
        Array.isArray(persisted.verticalAisles) ? persisted.verticalAisles : []
      ),
    };
  }

  if (fallbackSeatData?.grid?.length) {
    return {
      seatGrid: fallbackSeatData.grid.map((row) =>
        row.map((seat) => ({
          occupied: Boolean(seat.occupied),
          studentType: seat.studentType || null,
        }))
      ),
      verticalAisles: new Set(
        Array.isArray(fallbackSeatData.verticalAisles) ? fallbackSeatData.verticalAisles : []
      ),
    };
  }

  return null;
};

const calculateOptimalGridDimensions = (studentCount, deskStyle) => {
  const count = Math.max(0, Number(studentCount) || 0);
  if (count === 0) return { rows: 5, cols: 6 };

  if (deskStyle === 'single') {
    const cols = Math.max(4, Math.min(8, Math.ceil(Math.sqrt(count * 1.15))));
    const rows = Math.max(4, Math.ceil(count / cols));
    return { rows, cols };
  }

  // 2열 짝 대형: 짝수 열 기본 (6열 = 3분단 기본, 인원 많으면 8열 = 4분단)
  let cols = count > 30 ? 8 : 6;
  if (count <= 16) cols = 4;
  const rows = Math.max(4, Math.ceil(count / cols));
  return { rows, cols };
};

const buildDefaultAisles = (cols, deskStyle) => {
  const aisles = new Set();
  if (deskStyle === 'pair') {
    for (let i = 1; i < cols - 1; i += 2) {
      aisles.add(i);
    }
  } else {
    for (let i = 0; i < cols - 1; i++) {
      aisles.add(i);
    }
  }
  return aisles;
};

const ClassroomLayout = forwardRef(
  (
    {
      settings,
      students,
      onRandomArrangement,
      seatData,
      onViewResults,
      onResetArrangement,
      teacherNotes,
      onTeacherNotesChange,
    },
    ref
  ) => {
    const [seatGrid, setSeatGrid] = useState([]);
    const [gridSize, setGridSize] = useState({ rows: 5, cols: 6 });
    const [verticalAisles, setVerticalAisles] = useState(new Set());
    const [showTeacherNotes, setShowTeacherNotes] = useState(true);
    const [validationBanner, setValidationBanner] = useState(null);

    const genderFree = isGenderFreeMode(settings);
    const deskStyle = getEffectiveDeskLayout(settings);
    const layoutSignature = getLayoutSignature(settings);

    const canonicalPool = useMemo(
      () => buildCanonicalStudentPool(settings, students),
      [settings, students]
    );

    const resolvedNotesInfo = useMemo(
      () => resolveTeacherNotes(teacherNotes, canonicalPool),
      [teacherNotes, canonicalPool]
    );

    const buildAutoArrangedGrid = useCallback(
      (rows, cols, aislesToUse) => {
        const totalTarget = Math.max(0, Number(settings.studentCount) || 0);
        const newGrid = createEmptySeatGrid(rows, cols);
        if (totalTarget === 0) return newGrid;

        // 앞줄(교탁 쪽: rows - 1)부터 뒷줄(0) 순서로 좌석 목록 생성
        const seats = [];
        for (let r = rows - 1; r >= 0; r--) {
          for (let c = 0; c < cols; c++) {
            seats.push({ r, c });
          }
        }

        if (genderFree) {
          let placed = 0;
          for (const seat of seats) {
            if (placed >= totalTarget) break;
            newGrid[seat.r][seat.c] = { occupied: true, studentType: 'any' };
            placed++;
          }
          return newGrid;
        }

        let malesToPlace = Math.max(0, Number(settings.maleCount) || 0);
        let femalesToPlace = Math.max(0, Number(settings.femaleCount) || 0);
        if (settings.seatArrangement === 'pair' && settings.pairingType === 'male') {
          malesToPlace = totalTarget;
          femalesToPlace = 0;
        } else if (settings.seatArrangement === 'pair' && settings.pairingType === 'female') {
          malesToPlace = 0;
          femalesToPlace = totalTarget;
        }

        let placedStudents = 0;

        if (settings.seatArrangement === 'single') {
          for (const seat of seats) {
            if (placedStudents >= totalTarget) break;
            const preferMale = (seat.r + seat.c) % 2 === 0;
            if (preferMale && malesToPlace > 0) {
              newGrid[seat.r][seat.c] = { occupied: true, studentType: 'male' };
              malesToPlace--;
            } else if (!preferMale && femalesToPlace > 0) {
              newGrid[seat.r][seat.c] = { occupied: true, studentType: 'female' };
              femalesToPlace--;
            } else if (malesToPlace > 0) {
              newGrid[seat.r][seat.c] = { occupied: true, studentType: 'male' };
              malesToPlace--;
            } else if (femalesToPlace > 0) {
              newGrid[seat.r][seat.c] = { occupied: true, studentType: 'female' };
              femalesToPlace--;
            }
            placedStudents++;
          }
          return newGrid;
        }

        // 짝 배치 (pair)
        let seatIndex = 0;
        while (placedStudents < totalTarget && seatIndex < seats.length) {
          if (seatIndex >= seats.length - 1) {
            const last = seats[seatIndex];
            if (!newGrid[last.r][last.c].occupied) {
              const type = malesToPlace > 0 ? 'male' : 'female';
              newGrid[last.r][last.c] = { occupied: true, studentType: type };
              if (type === 'male') malesToPlace--;
              else femalesToPlace--;
              placedStudents++;
            }
            break;
          }

          const seat1 = seats[seatIndex];
          const seat2 = seats[seatIndex + 1];

          if (seat1.r !== seat2.r || aislesToUse.has(seat1.c)) {
            if (!newGrid[seat1.r][seat1.c].occupied) {
              const type = malesToPlace > 0 ? 'male' : 'female';
              newGrid[seat1.r][seat1.c] = { occupied: true, studentType: type };
              if (type === 'male') malesToPlace--;
              else femalesToPlace--;
              placedStudents++;
            }
            seatIndex++;
            continue;
          }

          let s1Type = null;
          let s2Type = null;
          if (settings.pairingType === 'mixed') {
            if (malesToPlace > 0 && femalesToPlace > 0) {
              // 행마다 좌우 성별 교차하여 균형감 부여
              if (seat1.r % 2 === 0) {
                s1Type = 'male';
                s2Type = 'female';
              } else {
                s1Type = 'female';
                s2Type = 'male';
              }
            } else if (malesToPlace >= 2) {
              s1Type = 'male';
              s2Type = 'male';
            } else if (femalesToPlace >= 2) {
              s1Type = 'female';
              s2Type = 'female';
            }
          } else if (settings.pairingType === 'samegender') {
            if (malesToPlace >= 2 && (femalesToPlace < 2 || (seat1.c + seat1.r) % 4 < 2)) {
              s1Type = 'male';
              s2Type = 'male';
            } else if (femalesToPlace >= 2) {
              s1Type = 'female';
              s2Type = 'female';
            } else if (malesToPlace >= 2) {
              s1Type = 'male';
              s2Type = 'male';
            } else if (malesToPlace > 0 && femalesToPlace > 0) {
              s1Type = 'male';
              s2Type = 'female';
            }
          } else if (settings.pairingType === 'male' && malesToPlace >= 2) {
            s1Type = 'male';
            s2Type = 'male';
          } else if (settings.pairingType === 'female' && femalesToPlace >= 2) {
            s1Type = 'female';
            s2Type = 'female';
          }

          if (s1Type && s2Type && placedStudents + 2 <= totalTarget) {
            newGrid[seat1.r][seat1.c] = { occupied: true, studentType: s1Type };
            newGrid[seat2.r][seat2.c] = { occupied: true, studentType: s2Type };
            malesToPlace -= (s1Type === 'male' ? 1 : 0) + (s2Type === 'male' ? 1 : 0);
            femalesToPlace -= (s1Type === 'female' ? 1 : 0) + (s2Type === 'female' ? 1 : 0);
            placedStudents += 2;
            seatIndex += 2;
          } else {
            if (!newGrid[seat1.r][seat1.c].occupied) {
              const type = malesToPlace > 0 ? 'male' : 'female';
              newGrid[seat1.r][seat1.c] = { occupied: true, studentType: type };
              if (type === 'male') malesToPlace--;
              else femalesToPlace--;
              placedStudents++;
            }
            seatIndex++;
          }
        }

        return newGrid;
      },
      [settings, genderFree]
    );

    useEffect(() => {
      const persistedLayout = loadPersistedLayoutState();
      if (
        persistedLayout?.signature === layoutSignature &&
        isValidPersistedLayout(persistedLayout)
      ) {
        setGridSize(persistedLayout.gridSize);
        setVerticalAisles(
          new Set(Array.isArray(persistedLayout.verticalAisles) ? persistedLayout.verticalAisles : [])
        );
        setSeatGrid(cloneSeatGrid(persistedLayout.seatGrid));
        setShowTeacherNotes(
          typeof persistedLayout.showTeacherNotes === 'boolean'
            ? persistedLayout.showTeacherNotes
            : true
        );
        return;
      }

      const { rows, cols } = calculateOptimalGridDimensions(settings.studentCount, deskStyle);
      const newAisles = buildDefaultAisles(cols, deskStyle);
      const arrangedGrid = buildAutoArrangedGrid(rows, cols, newAisles);

      setGridSize({ rows, cols });
      setVerticalAisles(newAisles);
      setSeatGrid(arrangedGrid);
      setValidationBanner(null);
    }, [layoutSignature, deskStyle, settings.studentCount, buildAutoArrangedGrid]);

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
        console.error('좌석 레이아웃을 저장하지 못했습니다.', error);
      }
    }, [layoutSignature, seatGrid, gridSize, verticalAisles, showTeacherNotes]);

    const getPlacementStatus = useCallback(() => {
      const allSeats = seatGrid.flat();
      const occupiedSeats = allSeats.filter((s) => s.occupied);

      if (genderFree) {
        const totalPlaced = occupiedSeats.length;
        const totalTarget = Math.max(0, Number(settings?.studentCount || 0));
        return {
          genderFree: true,
          hasIssue: totalPlaced !== totalTarget,
          totalOverflow: totalPlaced > totalTarget,
          totalUnderflow: totalPlaced < totalTarget,
          maleOverflow: false,
          femaleOverflow: false,
          maleUnderflow: false,
          femaleUnderflow: false,
          placed: { totalCount: totalPlaced, maleCount: 0, femaleCount: 0 },
          target: { totalCount: totalTarget, maleCount: 0, femaleCount: 0 },
        };
      }

      const malePlaced = occupiedSeats.filter((s) => s.studentType === 'male').length;
      const femalePlaced = occupiedSeats.filter((s) => s.studentType === 'female').length;
      const anyPlaced = occupiedSeats.length - malePlaced - femalePlaced;
      const totalPlaced = occupiedSeats.length;

      const totalTarget = Math.max(0, Number(settings?.studentCount || 0));
      let maleTarget = Math.max(0, Number(settings?.maleCount || 0));
      let femaleTarget = Math.max(0, Number(settings?.femaleCount || 0));

      if (settings.seatArrangement === 'pair' && settings.pairingType === 'male') {
        maleTarget = totalTarget;
        femaleTarget = 0;
      } else if (settings.seatArrangement === 'pair' && settings.pairingType === 'female') {
        maleTarget = 0;
        femaleTarget = totalTarget;
      }

      const maleOverflow = malePlaced > maleTarget;
      const femaleOverflow = femalePlaced > femaleTarget;
      const maleUnderflow = malePlaced + anyPlaced < maleTarget;
      const femaleUnderflow = femalePlaced + anyPlaced < femaleTarget;
      const totalOverflow = totalPlaced > totalTarget;
      const totalUnderflow = totalPlaced < totalTarget;

      return {
        genderFree: false,
        hasIssue:
          totalOverflow ||
          totalUnderflow ||
          maleOverflow ||
          femaleOverflow ||
          maleUnderflow ||
          femaleUnderflow,
        totalOverflow,
        totalUnderflow,
        maleOverflow,
        femaleOverflow,
        maleUnderflow,
        femaleUnderflow,
        placed: { totalCount: totalPlaced, maleCount: malePlaced, femaleCount: femalePlaced },
        target: { totalCount: totalTarget, maleCount: maleTarget, femaleCount: femaleTarget },
      };
    }, [seatGrid, genderFree, settings]);

    const handleRandomArrangement = useCallback(() => {
      if (!onRandomArrangement) return;

      const totalTarget = Math.max(0, Number(settings?.studentCount || 0));
      if (totalTarget < 1) {
        setValidationBanner('총 학생 수를 1명 이상 입력해주세요.');
        return;
      }

      const status = getPlacementStatus();
      if (status.hasIssue) {
        const lines = [];
        if (status.genderFree) {
          if (status.totalOverflow) {
            lines.push(
              `활성 좌석이 학생 수보다 ${status.placed.totalCount - status.target.totalCount}석 많습니다.`
            );
          }
          if (status.totalUnderflow) {
            lines.push(
              `활성 좌석이 학생 수보다 ${status.target.totalCount - status.placed.totalCount}석 부족합니다.`
            );
          }
        } else {
          if (status.maleOverflow) {
            lines.push(`남학생 좌석 ${status.placed.maleCount - status.target.maleCount}석 초과`);
          }
          if (status.femaleOverflow) {
            lines.push(
              `여학생 좌석 ${status.placed.femaleCount - status.target.femaleCount}석 초과`
            );
          }
          if (status.maleUnderflow) {
            lines.push(`남학생 좌석 ${status.target.maleCount - status.placed.maleCount}석 부족`);
          }
          if (status.femaleUnderflow) {
            lines.push(
              `여학생 좌석 ${status.target.femaleCount - status.placed.femaleCount}석 부족`
            );
          }
        }

        const msg = `${lines.join(' · ')} — 좌석을 클릭하거나 '좌석 자동 정렬'을 눌러 인원수를 맞춰주세요.`;
        setValidationBanner(msg);
        return;
      }

      setValidationBanner(null);

      const generated = generateSeatingArrangement({
        seatGrid,
        verticalAisles,
        settings,
        students,
        teacherNotes,
      });

      onRandomArrangement(generated);
    }, [
      onRandomArrangement,
      settings,
      getPlacementStatus,
      seatGrid,
      verticalAisles,
      students,
      teacherNotes,
    ]);

    useImperativeHandle(
      ref,
      () => ({
        runArrangement: handleRandomArrangement,
      }),
      [handleRandomArrangement]
    );

    const handleSeatClick = (row, col, e) => {
      e.preventDefault();
      e.stopPropagation();
      setValidationBanner(null);

      setSeatGrid((prev) => {
        const newGrid = cloneSeatGrid(prev);
        const seat = newGrid[row][col];

        if (genderFree) {
          newGrid[row][col] = seat.occupied
            ? { occupied: false, studentType: null }
            : { occupied: true, studentType: 'any' };
          return newGrid;
        }

        if (settings.seatArrangement === 'pair' && settings.pairingType === 'male') {
          newGrid[row][col] = seat.occupied
            ? { occupied: false, studentType: null }
            : { occupied: true, studentType: 'male' };
          return newGrid;
        }

        if (settings.seatArrangement === 'pair' && settings.pairingType === 'female') {
          newGrid[row][col] = seat.occupied
            ? { occupied: false, studentType: null }
            : { occupied: true, studentType: 'female' };
          return newGrid;
        }

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

    const toggleVerticalAisle = (colIndex) => {
      setVerticalAisles((prev) => {
        const next = new Set(prev);
        if (next.has(colIndex)) next.delete(colIndex);
        else next.add(colIndex);
        return next;
      });
    };

    const addRowTop = () => {
      const newRow = Array.from({ length: gridSize.cols }, () => ({
        occupied: false,
        studentType: null,
      }));
      setSeatGrid((prev) => [newRow, ...prev]);
      setGridSize((prev) => ({ ...prev, rows: prev.rows + 1 }));
    };

    const addRowBottom = () => {
      const newRow = Array.from({ length: gridSize.cols }, () => ({
        occupied: false,
        studentType: null,
      }));
      setSeatGrid((prev) => [...prev, newRow]);
      setGridSize((prev) => ({ ...prev, rows: prev.rows + 1 }));
    };

    const addColumnRight = () => {
      setSeatGrid((prev) => prev.map((row) => [...row, { occupied: false, studentType: null }]));
      setGridSize((prev) => ({ ...prev, cols: prev.cols + 1 }));
    };

    const addColumnLeft = () => {
      setSeatGrid((prev) => prev.map((row) => [{ occupied: false, studentType: null }, ...row]));
      setGridSize((prev) => ({ ...prev, cols: prev.cols + 1 }));
      setVerticalAisles((prev) => {
        const next = new Set();
        prev.forEach((index) => next.add(index + 1));
        return next;
      });
    };

    const removeRowTop = () => {
      if (gridSize.rows > 1) {
        setSeatGrid((prev) => prev.slice(1));
        setGridSize((prev) => ({ ...prev, rows: prev.rows - 1 }));
      }
    };

    const removeRowBottom = () => {
      if (gridSize.rows > 1) {
        setSeatGrid((prev) => prev.slice(0, -1));
        setGridSize((prev) => ({ ...prev, rows: prev.rows - 1 }));
      }
    };

    const removeColumnRight = () => {
      if (gridSize.cols > 1) {
        const nextCols = gridSize.cols - 1;
        setSeatGrid((prev) => prev.map((row) => row.slice(0, -1)));
        setGridSize((prev) => ({ ...prev, cols: nextCols }));
        setVerticalAisles((prev) => {
          const next = new Set();
          prev.forEach((index) => {
            if (index < nextCols - 1) next.add(index);
          });
          return next;
        });
      }
    };

    const removeColumnLeft = () => {
      if (gridSize.cols > 1) {
        setSeatGrid((prev) => prev.map((row) => row.slice(1)));
        setGridSize((prev) => ({ ...prev, cols: prev.cols - 1 }));
        setVerticalAisles((prev) => {
          const next = new Set();
          prev.forEach((index) => {
            if (index > 0) next.add(index - 1);
          });
          return next;
        });
      }
    };

    const manualAutoArrange = () => {
      const arranged = buildAutoArrangedGrid(gridSize.rows, gridSize.cols, verticalAisles);
      setSeatGrid(arranged);
      setValidationBanner(null);
    };

    const clearAllSeats = () => {
      setSeatGrid((prev) => prev.map((row) => row.map(() => ({ occupied: false, studentType: null }))));
    };

    // 교사 참고 사항 상태 핸들러
    const addTogetherStudent = () =>
      onTeacherNotesChange((prev) => ({
        ...prev,
        togetherStudents: [...prev.togetherStudents, { id: Date.now() + Math.random(), students: ['', ''] }],
      }));

    const addSeparateStudent = () =>
      onTeacherNotesChange((prev) => ({
        ...prev,
        separateStudents: [...prev.separateStudents, { id: Date.now() + Math.random(), students: ['', ''] }],
      }));

    const addConsiderationStudent = () =>
      onTeacherNotesChange((prev) => ({
        ...prev,
        considerationStudents: [
          ...prev.considerationStudents,
          { id: Date.now() + Math.random(), student: '', position: 'front' },
        ],
      }));

    const updateTogetherStudent = (id, index, value) =>
      onTeacherNotesChange((prev) => ({
        ...prev,
        togetherStudents: prev.togetherStudents.map((item) =>
          item.id === id
            ? { ...item, students: item.students.map((s, i) => (i === index ? value : s)) }
            : item
        ),
      }));

    const updateSeparateStudent = (id, index, value) =>
      onTeacherNotesChange((prev) => ({
        ...prev,
        separateStudents: prev.separateStudents.map((item) =>
          item.id === id
            ? { ...item, students: item.students.map((s, i) => (i === index ? value : s)) }
            : item
        ),
      }));

    const updateConsiderationStudent = (id, field, value) =>
      onTeacherNotesChange((prev) => ({
        ...prev,
        considerationStudents: prev.considerationStudents.map((item) =>
          item.id === id ? { ...item, [field]: value } : item
        ),
      }));

    const removeTogetherStudent = (id) =>
      onTeacherNotesChange((prev) => ({
        ...prev,
        togetherStudents: prev.togetherStudents.filter((item) => item.id !== id),
      }));

    const removeSeparateStudent = (id) =>
      onTeacherNotesChange((prev) => ({
        ...prev,
        separateStudents: prev.separateStudents.filter((item) => item.id !== id),
      }));

    const removeConsiderationStudent = (id) =>
      onTeacherNotesChange((prev) => ({
        ...prev,
        considerationStudents: prev.considerationStudents.filter((item) => item.id !== id),
      }));

    const placementStatus = getPlacementStatus();

    // 저장된 배치 결과(seatData)가 현재 그리드와 호환되는지 확인 (뒤로가기 후에도 배치된 학생 표시)
    const isArrangementOverlayCompatible =
      Boolean(seatData?.grid) &&
      seatData.grid.length === seatGrid.length &&
      seatData.grid[0]?.length === seatGrid[0]?.length;

    const renderStudentMatchBadge = (queryValue) => {
      const trimmed = String(queryValue || '').trim();
      if (!trimmed) return null;
      const matched = matchStudentQuery(trimmed, canonicalPool);
      if (matched) {
        return (
          <span className="resolved-chip">
            {formatStudentOptionLabel(matched)}
          </span>
        );
      }
      return <span className="unresolved-chip">명단 미일치: {trimmed}</span>;
    };

    const totalNoteCount =
      teacherNotes.togetherStudents.length +
      teacherNotes.separateStudents.length +
      teacherNotes.considerationStudents.length;

    return (
      <div className="classroom-workspace">
        <datalist id="classroom-student-datalist">
          {canonicalPool.map((stu) => (
            <option
              key={stu.uid}
              value={stu.rawName || stu.number}
              label={formatStudentOptionLabel(stu)}
            />
          ))}
        </datalist>

        {/* 섹션 02: 좌석 설계 */}
        <section id="section-classroom" className="classroom-section" aria-labelledby="classroom-heading">
          <div className="section-header-row">
            <div>
              <p className="section-eyebrow">02 · 교실 좌석 설계</p>
              <h2 id="classroom-heading">교실 구조 및 좌석 배치도</h2>
            </div>

            <div className="classroom-toolbar">
              <div className="seat-status-pill" aria-live="polite">
                {genderFree ? (
                  <span>
                    좌석 {placementStatus.placed.totalCount} / {placementStatus.target.totalCount}석
                  </span>
                ) : (
                  <>
                    <span>
                      전체 {placementStatus.placed.totalCount}/{placementStatus.target.totalCount}
                    </span>
                    <span className="meta-dot">·</span>
                    <span>
                      남 {placementStatus.placed.maleCount}/{placementStatus.target.maleCount}
                    </span>
                    <span className="meta-dot">·</span>
                    <span>
                      여 {placementStatus.placed.femaleCount}/{placementStatus.target.femaleCount}
                    </span>
                  </>
                )}
              </div>

              <button type="button" className="btn-pill" onClick={manualAutoArrange}>
                좌석 자동 정렬
              </button>
              <button type="button" className="btn-ghost muted" onClick={clearAllSeats}>
                전체 비우기
              </button>
            </div>
          </div>

          {(placementStatus.hasIssue || validationBanner) && (
            <div className="status-banner" role="alert">
              <span className="status-banner-title">좌석 수 확인 필요</span>
              <span className="status-banner-body">
                {validationBanner ||
                  (genderFree
                    ? placementStatus.totalOverflow
                      ? `현재 좌석이 학생 수보다 ${
                          placementStatus.placed.totalCount - placementStatus.target.totalCount
                        }석 더 활성화되어 있습니다.`
                      : `학생 수보다 좌석이 ${
                          placementStatus.target.totalCount - placementStatus.placed.totalCount
                        }석 부족합니다. 빈 칸(+)을 눌러 좌석을 추가하세요.`
                    : [
                        placementStatus.maleOverflow &&
                          `남학생 좌석 ${
                            placementStatus.placed.maleCount - placementStatus.target.maleCount
                          }석 초과`,
                        placementStatus.femaleOverflow &&
                          `여학생 좌석 ${
                            placementStatus.placed.femaleCount - placementStatus.target.femaleCount
                          }석 초과`,
                        placementStatus.maleUnderflow &&
                          `남학생 좌석 ${
                            placementStatus.target.maleCount - placementStatus.placed.maleCount
                          }석 부족`,
                        placementStatus.femaleUnderflow &&
                          `여학생 좌석 ${
                            placementStatus.target.femaleCount - placementStatus.placed.femaleCount
                          }석 부족`,
                      ]
                        .filter(Boolean)
                        .join(' · '))}
              </span>
            </div>
          )}

          {seatData && (
            <div className="saved-arrangement-bar">
              <div className="saved-arrangement-info">
                <span className="saved-dot" />
                <span>
                  {isArrangementOverlayCompatible
                    ? '최근 배치된 결과가 좌석 위에 유지되고 있습니다.'
                    : '저장된 이전 배치표가 있습니다. 현재 좌석 구성으로 새로 배치할 수 있습니다.'}
                </span>
              </div>
              <div className="saved-arrangement-actions">
                <button
                  type="button"
                  className="btn-pill"
                  onClick={() => onViewResults(true)}
                >
                  배치표 화면 열기
                </button>
                <button
                  type="button"
                  className="btn-pill"
                  onClick={handleRandomArrangement}
                >
                  다시 배치하기
                </button>
                <button
                  type="button"
                  className="btn-ghost muted"
                  onClick={onResetArrangement}
                >
                  배치 결과 지우기
                </button>
              </div>
            </div>
          )}

          <div className="classroom-canvas-card">
            <div className="zone-marker">교실 뒤</div>

            <div className="matrix-scroll-area">
              <div className="matrix-with-side-controls">
                <button
                  type="button"
                  className="edge-add-col"
                  onClick={addColumnLeft}
                  title="왼쪽에 새 열 추가"
                  aria-label="왼쪽 열 추가"
                >
                  + 열
                </button>

                <div className="matrix-core">
                  <button
                    type="button"
                    className="edge-add-row"
                    onClick={addRowTop}
                  >
                    + 뒷줄(행) 추가
                  </button>

                  {/* 열 사이 통로 토글 행 — 좌석 열과 정확히 1:1 정렬 */}
                  {gridSize.cols > 1 && (
                    <div className="aisle-header-row" aria-label="세로 통로 설정">
                      {Array.from({ length: gridSize.cols }).map((_, colIdx) => {
                        const hasAfter = colIdx < gridSize.cols - 1;
                        const isAisle = hasAfter && verticalAisles.has(colIdx);
                        return (
                          <React.Fragment key={`aisle-head-${colIdx}`}>
                            <div className="aisle-col-spacer" />
                            {hasAfter && (
                              <div className={`aisle-control-slot ${isAisle ? 'is-aisle' : ''}`}>
                                <button
                                  type="button"
                                  className={`aisle-pill-toggle ${isAisle ? 'active' : ''}`}
                                  onClick={() => toggleVerticalAisle(colIdx)}
                                  title={isAisle ? '통로 해제 (책상 붙이기)' : '세로 통로 만들기'}
                                  aria-label={
                                    isAisle
                                      ? `${colIdx + 1}열과 ${colIdx + 2}열 사이 통로 해제`
                                      : `${colIdx + 1}열과 ${colIdx + 2}열 사이 통로 추가`
                                  }
                                  aria-pressed={isAisle}
                                >
                                  {isAisle ? '−' : '+'}
                                </button>
                              </div>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  )}

                  {/* 실제 좌석 그리드 */}
                  <div className="seat-matrix">
                    {seatGrid.map((row, rowIndex) => (
                      <div key={`row-${rowIndex}`} className="seat-matrix-row">
                        {row.map((seat, colIndex) => {
                          const hasAfter = colIndex < row.length - 1;
                          const isAisle = hasAfter && verticalAisles.has(colIndex);
                          const arrangedSeat = isArrangementOverlayCompatible
                            ? seatData.grid?.[rowIndex]?.[colIndex]
                            : null;
                          const hasArrangedStudent =
                            seat.occupied &&
                            arrangedSeat?.occupied &&
                            Boolean(arrangedSeat.studentName);

                          const genderClass = genderFree
                            ? 'neutral'
                            : seat.studentType === 'female'
                            ? 'female'
                            : seat.studentType === 'male'
                            ? 'male'
                            : 'neutral';

                          return (
                            <React.Fragment key={`seat-${rowIndex}-${colIndex}`}>
                              <button
                                type="button"
                                className={`desk-cell ${
                                  seat.occupied ? `occupied ${genderClass}` : 'empty'
                                } ${hasArrangedStudent ? 'has-student' : ''}`}
                                onClick={(e) => handleSeatClick(rowIndex, colIndex, e)}
                                title={
                                  seat.occupied
                                    ? genderFree
                                      ? '클릭하여 빈 자리로 전환'
                                      : `현재 ${
                                          seat.studentType === 'female' ? '여학생' : '남학생'
                                        } 좌석 (클릭하여 전환)`
                                    : '클릭하여 좌석 활성화'
                                }
                              >
                                {seat.occupied ? (
                                  hasArrangedStudent ? (
                                    <div className="desk-arranged-content">
                                      <span className="desk-arranged-id">
                                        {arrangedSeat.studentId}
                                        {!genderFree &&
                                          (seat.studentType === 'female' ? ' · 여' : ' · 남')}
                                      </span>
                                      <span className="desk-arranged-name">
                                        {arrangedSeat.studentName}
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="desk-template-content">
                                      <span className="desk-type-tag">
                                        {genderFree
                                          ? '좌석'
                                          : seat.studentType === 'female'
                                          ? '여'
                                          : '남'}
                                      </span>
                                    </div>
                                  )
                                ) : (
                                  <span className="desk-empty-plus">+</span>
                                )}
                              </button>
                              {hasAfter && (
                                <div
                                  className={`aisle-gap-slot ${isAisle ? 'is-aisle' : ''}`}
                                  aria-hidden="true"
                                />
                              )}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    className="edge-add-row"
                    onClick={addRowBottom}
                  >
                    + 앞줄(행) 추가
                  </button>
                </div>

                <button
                  type="button"
                  className="edge-add-col"
                  onClick={addColumnRight}
                  title="오른쪽에 새 열 추가"
                  aria-label="오른쪽 열 추가"
                >
                  + 열
                </button>
              </div>
            </div>

            <div className="zone-marker podium-marker">교탁 (앞쪽)</div>

            <div className="canvas-footer-bar">
              <div className="seat-legend">
                {genderFree ? (
                  <span className="legend-entry">
                    <span className="swatch occupied-neutral" /> 활성 좌석 (클릭 시 빈 자리 전환)
                  </span>
                ) : (
                  <>
                    <span className="legend-entry">
                      <span className="swatch occupied-male" /> 남학생 좌석
                    </span>
                    <span className="legend-entry">
                      <span className="swatch occupied-female" /> 여학생 좌석
                    </span>
                  </>
                )}
                <span className="legend-entry">
                  <span className="swatch empty-swatch" /> 빈 자리
                </span>
                <span className="legend-entry">
                  <span className="swatch aisle-swatch" /> 상단 + / − 버튼으로 통로 조절
                </span>
              </div>

              <div className="grid-trim-buttons">
                <button
                  type="button"
                  className="btn-ghost muted"
                  onClick={removeColumnLeft}
                  disabled={gridSize.cols <= 1}
                >
                  좌측 열 삭제
                </button>
                <button
                  type="button"
                  className="btn-ghost muted"
                  onClick={removeRowTop}
                  disabled={gridSize.rows <= 1}
                >
                  뒷줄 삭제
                </button>
                <button
                  type="button"
                  className="btn-ghost muted"
                  onClick={removeRowBottom}
                  disabled={gridSize.rows <= 1}
                >
                  앞줄 삭제
                </button>
                <button
                  type="button"
                  className="btn-ghost muted"
                  onClick={removeColumnRight}
                  disabled={gridSize.cols <= 1}
                >
                  우측 열 삭제
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* 섹션 03: 배치 고려사항 (교사 참고 사항) */}
        <section id="section-notes" className="notes-section" aria-labelledby="notes-heading">
          <div className="section-header-row">
            <div>
              <p className="section-eyebrow">03 · 배치 고려사항</p>
              <h2 id="notes-heading">붙여 앉기 · 분리 · 좌석 배려 설정</h2>
            </div>
            <div className="notes-header-controls">
              <span className="notes-privacy-caption">
                {showTeacherNotes
                  ? '화면 공유 시 비공개가 필요하면 접어둘 수 있습니다 (접어도 조건은 정상 반영됩니다)'
                  : `고려사항 ${totalNoteCount}건 비공개 접힘 상태 (배치에 정상 반영됩니다)`}
              </span>
              <button
                type="button"
                className="btn-pill"
                onClick={() => setShowTeacherNotes((prev) => !prev)}
              >
                {showTeacherNotes ? '내용 숨기기' : '내용 펼치기'}
              </button>
            </div>
          </div>

          {showTeacherNotes && (
            <>
              {resolvedNotesInfo.warnings.length > 0 && (
                <div className="notes-warning-box" role="status">
                  {resolvedNotesInfo.warnings.map((w, idx) => (
                    <p key={`warn-${idx}`}>{w}</p>
                  ))}
                </div>
              )}

              <div className="notes-three-col">
                {/* 1. 붙여 앉을 학생들 */}
                <div className="editorial-card note-card">
                  <div className="note-card-top">
                    <div>
                      <h3>붙여 앉을 학생</h3>
                      <p>최우선으로 바로 옆 짝 자리에 나란히 배치합니다.</p>
                    </div>
                    <button type="button" className="btn-pill" onClick={addTogetherStudent}>
                      + 추가
                    </button>
                  </div>

                  <div className="note-items-stack">
                    {teacherNotes.togetherStudents.map((item) => (
                      <div key={item.id} className="note-entry">
                        <div className="note-entry-inputs">
                          <input
                            type="text"
                            list="classroom-student-datalist"
                            className="input-pill compact"
                            placeholder="이름 또는 학번 1"
                            value={item.students[0]}
                            onChange={(e) => updateTogetherStudent(item.id, 0, e.target.value)}
                          />
                          <input
                            type="text"
                            list="classroom-student-datalist"
                            className="input-pill compact"
                            placeholder="이름 또는 학번 2"
                            value={item.students[1]}
                            onChange={(e) => updateTogetherStudent(item.id, 1, e.target.value)}
                          />
                          <button
                            type="button"
                            className="btn-ghost muted note-remove-btn"
                            onClick={() => removeTogetherStudent(item.id)}
                          >
                            삭제
                          </button>
                        </div>
                        {(item.students[0] || item.students[1]) && (
                          <div className="note-resolved-row">
                            {renderStudentMatchBadge(item.students[0])}
                            {item.students[0] && item.students[1] && (
                              <span className="note-joiner">· 동석 ·</span>
                            )}
                            {renderStudentMatchBadge(item.students[1])}
                          </div>
                        )}
                      </div>
                    ))}
                    {teacherNotes.togetherStudents.length === 0 && (
                      <p className="note-empty-text">지정된 동석 학생 조합이 없습니다.</p>
                    )}
                  </div>
                </div>

                {/* 2. 떨어뜨릴 학생들 */}
                <div className="editorial-card note-card">
                  <div className="note-card-top">
                    <div>
                      <h3>떨어뜨릴 학생</h3>
                      <p>짝은 물론 앞·뒤·좌·우·대각선 인접석을 모두 피합니다.</p>
                    </div>
                    <button type="button" className="btn-pill" onClick={addSeparateStudent}>
                      + 추가
                    </button>
                  </div>

                  <div className="note-items-stack">
                    {teacherNotes.separateStudents.map((item) => (
                      <div key={item.id} className="note-entry">
                        <div className="note-entry-inputs">
                          <input
                            type="text"
                            list="classroom-student-datalist"
                            className="input-pill compact"
                            placeholder="이름 또는 학번 1"
                            value={item.students[0]}
                            onChange={(e) => updateSeparateStudent(item.id, 0, e.target.value)}
                          />
                          <input
                            type="text"
                            list="classroom-student-datalist"
                            className="input-pill compact"
                            placeholder="이름 또는 학번 2"
                            value={item.students[1]}
                            onChange={(e) => updateSeparateStudent(item.id, 1, e.target.value)}
                          />
                          <button
                            type="button"
                            className="btn-ghost muted note-remove-btn"
                            onClick={() => removeSeparateStudent(item.id)}
                          >
                            삭제
                          </button>
                        </div>
                        {(item.students[0] || item.students[1]) && (
                          <div className="note-resolved-row">
                            {renderStudentMatchBadge(item.students[0])}
                            {item.students[0] && item.students[1] && (
                              <span className="note-joiner">· 분리 ·</span>
                            )}
                            {renderStudentMatchBadge(item.students[1])}
                          </div>
                        )}
                      </div>
                    ))}
                    {teacherNotes.separateStudents.length === 0 && (
                      <p className="note-empty-text">지정된 분리 학생 조합이 없습니다.</p>
                    )}
                  </div>
                </div>

                {/* 3. 배려할 학생들 */}
                <div className="editorial-card note-card">
                  <div className="note-card-top">
                    <div>
                      <h3>배려할 학생</h3>
                      <p>시력·청력·집중도 등을 고려해 희망 구역에 배치합니다.</p>
                    </div>
                    <button type="button" className="btn-pill" onClick={addConsiderationStudent}>
                      + 추가
                    </button>
                  </div>

                  <div className="note-items-stack">
                    {teacherNotes.considerationStudents.map((item) => (
                      <div key={item.id} className="note-entry">
                        <div className="note-entry-inputs">
                          <input
                            type="text"
                            list="classroom-student-datalist"
                            className="input-pill compact"
                            placeholder="이름 또는 학번"
                            value={item.student}
                            onChange={(e) =>
                              updateConsiderationStudent(item.id, 'student', e.target.value)
                            }
                          />
                          <select
                            className="select-pill compact"
                            value={item.position}
                            onChange={(e) =>
                              updateConsiderationStudent(item.id, 'position', e.target.value)
                            }
                          >
                            <option value="front">앞쪽 (교탁 근처)</option>
                            <option value="back">뒤쪽 (교실 뒤편)</option>
                            <option value="left">왼쪽 열</option>
                            <option value="right">오른쪽 열</option>
                          </select>
                          <button
                            type="button"
                            className="btn-ghost muted note-remove-btn"
                            onClick={() => removeConsiderationStudent(item.id)}
                          >
                            삭제
                          </button>
                        </div>
                        {item.student && (
                          <div className="note-resolved-row">
                            {renderStudentMatchBadge(item.student)}
                            <span className="note-joiner">→</span>
                            <span className="resolved-chip">
                              {item.position === 'front'
                                ? '앞쪽'
                                : item.position === 'back'
                                ? '뒤쪽'
                                : item.position === 'left'
                                ? '왼쪽 열'
                                : '오른쪽 열'}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                    {teacherNotes.considerationStudents.length === 0 && (
                      <p className="note-empty-text">지정된 배려 좌석 학생이 없습니다.</p>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </section>

        {/* 하단 최종 실행 바 */}
        <section className="execute-bar-card" aria-label="자리 배치 실행">
          <div className="execute-summary">
            <h3>자리 배치 준비 완료</h3>
            <p>
              {settings.grade}학년 {settings.classNumber}반 · 총 {settings.studentCount || 0}명 ·{' '}
              {getArrangementModeLabel(settings)}
              {totalNoteCount > 0 ? ` · 고려사항 ${totalNoteCount}건 반영` : ''}
            </p>
          </div>

          <div className="execute-actions">
            {seatData ? (
              <>
                <button
                  type="button"
                  className="btn-pill"
                  onClick={() => onViewResults(true)}
                >
                  저장된 배치표 보기
                </button>
                <button
                  type="button"
                  className="btn-filled"
                  onClick={handleRandomArrangement}
                >
                  다시 배치하기
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn-filled"
                onClick={handleRandomArrangement}
              >
                자리 배치 및 인쇄 페이지 이동
              </button>
            )}
          </div>
        </section>
      </div>
    );
  }
);

export default ClassroomLayout;
