import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as htmlToImage from 'html-to-image';
import './PrintLayout.css';
import { getArrangementModeLabel, shuffleArray } from '../utils/seatingAlgorithm';

const SHUFFLE_DURATION_MS = 5000;

const PrintLayout = ({
  settings,
  seatData,
  onBack,
  onRearrange,
  onUpdateSeatData,
  printOptions,
  onPrintOptionsChange,
}) => {
  const displayType = printOptions?.displayType || 'nameAndId';
  const isFlipped = Boolean(printOptions?.isFlipped);
  const isLandscape = Boolean(printOptions?.isLandscape);

  const [isShuffling, setIsShuffling] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [currentGrid, setCurrentGrid] = useState(null);
  const [selectedSwapSeat, setSelectedSwapSeat] = useState(null);
  const [scaleFactor, setScaleFactor] = useState(1);

  const printAreaRef = useRef(null);
  const animationFrameRef = useRef(null);
  const countdownIntervalRef = useRef(null);

  const clearTimers = useCallback(() => {
    if (animationFrameRef.current) {
      clearTimeout(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  // 카운트다운 및 셔플 애니메이션 제어
  useEffect(() => {
    clearTimers();
    setSelectedSwapSeat(null);

    if (!seatData?.grid) {
      setCurrentGrid([]);
      setIsShuffling(false);
      return undefined;
    }

    const studentList = Array.isArray(seatData.students) ? seatData.students : [];
    if (studentList.length === 0 || seatData.skipAnimation) {
      setIsShuffling(false);
      setCurrentGrid(seatData.grid);
      return undefined;
    }

    setIsShuffling(true);
    setCountdown(Math.ceil(SHUFFLE_DURATION_MS / 1000));
    const startTime = Date.now();

    const animate = () => {
      const shuffledAll = shuffleArray(studentList);
      const shuffledMales = shuffledAll.filter((s) => s.gender === 'male');
      const shuffledFemales = shuffledAll.filter((s) => s.gender === 'female');
      let anyIdx = 0;
      let maleIdx = 0;
      let femaleIdx = 0;

      const frameGrid = seatData.grid.map((row) =>
        row.map((seat) => {
          if (!seat.occupied) return seat;
          let picked = null;
          if (seat.studentType === 'male' && shuffledMales.length > 0) {
            picked = shuffledMales[maleIdx % shuffledMales.length];
            maleIdx++;
          } else if (seat.studentType === 'female' && shuffledFemales.length > 0) {
            picked = shuffledFemales[femaleIdx % shuffledFemales.length];
            femaleIdx++;
          } else {
            picked = shuffledAll[anyIdx % shuffledAll.length];
          }
          anyIdx++;
          return {
            ...seat,
            studentName: picked?.name || seat.studentName,
            studentId: picked?.number || seat.studentId,
          };
        })
      );

      setCurrentGrid(frameGrid);
      animationFrameRef.current = setTimeout(animate, 110);
    };

    animate();

    countdownIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, SHUFFLE_DURATION_MS - elapsed);
      setCountdown(Math.ceil(remaining / 1000));

      if (remaining <= 0) {
        clearTimers();
        setIsShuffling(false);
        setCurrentGrid(seatData.grid);
      }
    }, 200);

    return () => clearTimers();
  }, [seatData, seatData?.arrangedAt, clearTimers]);

  const handleSkipAnimation = () => {
    clearTimers();
    setIsShuffling(false);
    if (seatData?.grid) {
      setCurrentGrid(seatData.grid);
    }
  };

  // 용지 크기에 맞춘 자동 배율 계산 (가로·세로 모두 안전하게 수납)
  useEffect(() => {
    if (!currentGrid || currentGrid.length === 0) return;

    const rows = currentGrid.length;
    const cols = currentGrid[0]?.length || 1;
    const aisleCount = Array.isArray(seatData?.verticalAisles)
      ? seatData.verticalAisles.filter((idx) => idx >= 0 && idx < cols - 1).length
      : 0;

    const seatW = 92;
    const seatH = 56;
    const gap = 8;
    const aisleExtra = 20;

    const naturalWidth = cols * seatW + Math.max(0, cols - 1) * gap + aisleCount * aisleExtra;
    const naturalHeight = rows * seatH + Math.max(0, rows - 1) * gap;

    const mmToPx = 3.7795275591;
    const availW = (isLandscape ? 297 - 44 : 210 - 36) * mmToPx;
    const availH = (isLandscape ? 210 - 95 : 297 - 115) * mmToPx;

    const nextScale = Math.min(1, availW / naturalWidth, availH / naturalHeight);
    setScaleFactor(Number(nextScale.toFixed(3)));
  }, [currentGrid, isLandscape, seatData?.verticalAisles]);

  const handlePrint = () => {
    let dynamicStyle = null;
    if (isLandscape) {
      dynamicStyle = document.createElement('style');
      dynamicStyle.textContent = `
        @media print {
          @page {
            size: A4 landscape;
            margin: 0;
          }
        }
      `;
      document.head.appendChild(dynamicStyle);
    }

    window.print();

    if (dynamicStyle) {
      setTimeout(() => {
        if (dynamicStyle.parentNode) {
          dynamicStyle.parentNode.removeChild(dynamicStyle);
        }
      }, 1000);
    }
  };

  const handleSaveAsImage = useCallback(() => {
    const container = printAreaRef.current;
    if (!container) return;

    const contentWrapper = container.querySelector('.page-content-wrapper');
    if (!contentWrapper) return;

    setSelectedSwapSeat(null);
    setIsSaving(true);

    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateString = `${year}${month}${day}`;
    const orientation = isLandscape ? '가로' : '세로';
    const filename = `${settings.grade}학년_${settings.classNumber}반_자리배치표_${dateString}_${orientation}.png`;

    const mmToPx = (mm) => (mm / 25.4) * 96;
    const A4_WIDTH_PX = isLandscape ? Math.round(mmToPx(297)) : Math.round(mmToPx(210));
    const A4_HEIGHT_PX = isLandscape ? Math.round(mmToPx(210)) : Math.round(mmToPx(297));
    const MARGIN_PX = Math.round(mmToPx(18));

    htmlToImage
      .toPng(contentWrapper, {
        cacheBust: true,
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        width: A4_WIDTH_PX,
        height: A4_HEIGHT_PX,
        style: {
          padding: `${MARGIN_PX}px`,
          boxSizing: 'border-box',
          width: `${A4_WIDTH_PX}px`,
          height: `${A4_HEIGHT_PX}px`,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          alignItems: 'center',
        },
      })
      .then((dataUrl) => {
        const link = document.createElement('a');
        link.download = filename;
        link.href = dataUrl;
        link.click();
      })
      .catch((err) => {
        console.error('이미지 변환에 실패했습니다.', err);
      })
      .finally(() => {
        setIsSaving(false);
      });
  }, [settings.grade, settings.classNumber, isLandscape]);

  // 결과 화면에서 좌석 두 개 클릭 시 자리 맞바꾸기 (미세 조정 후 뒤로가기 해도 유지)
  const handleDeskSwapClick = (displayRowIdx, displayColIdx) => {
    if (isShuffling || !seatData?.grid || !onUpdateSeatData) return;

    const totalRows = seatData.grid.length;
    const totalCols = seatData.grid[0]?.length || 0;
    const origR = isFlipped ? totalRows - 1 - displayRowIdx : displayRowIdx;
    const origC = isFlipped ? totalCols - 1 - displayColIdx : displayColIdx;

    const clickedSeat = seatData.grid[origR]?.[origC];
    if (!clickedSeat?.occupied) return;

    if (!selectedSwapSeat) {
      setSelectedSwapSeat({ r: origR, c: origC });
      return;
    }

    if (selectedSwapSeat.r === origR && selectedSwapSeat.c === origC) {
      setSelectedSwapSeat(null);
      return;
    }

    const nextGrid = seatData.grid.map((r) => r.map((cell) => ({ ...cell })));
    const firstSeat = nextGrid[selectedSwapSeat.r][selectedSwapSeat.c];
    const secondSeat = nextGrid[origR][origC];

    nextGrid[selectedSwapSeat.r][selectedSwapSeat.c] = {
      ...firstSeat,
      studentUid: secondSeat.studentUid,
      studentName: secondSeat.studentName,
      studentRawName: secondSeat.studentRawName,
      studentId: secondSeat.studentId,
      studentType: secondSeat.studentType,
    };

    nextGrid[origR][origC] = {
      ...secondSeat,
      studentUid: firstSeat.studentUid,
      studentName: firstSeat.studentName,
      studentRawName: firstSeat.studentRawName,
      studentId: firstSeat.studentId,
      studentType: firstSeat.studentType,
    };

    setSelectedSwapSeat(null);
    setCurrentGrid(nextGrid);
    onUpdateSeatData({
      ...seatData,
      grid: nextGrid,
    });
  };

  if (!currentGrid) {
    return (
      <div className="print-page-shell">
        <div className="loading-state-card">
          <p>자리 배치 데이터를 불러오는 중입니다...</p>
        </div>
      </div>
    );
  }

  const totalCols = currentGrid[0]?.length || 0;
  const totalRows = currentGrid.length;

  const displayGrid = isFlipped
    ? [...currentGrid].reverse().map((row) => [...row].reverse())
    : currentGrid;

  // 상하좌우 180도 반전 시 세로 통로 인덱스도 정확히 좌우 대칭 이동
  const rawAisles = Array.isArray(seatData?.verticalAisles) ? seatData.verticalAisles : [];
  const effectiveAisleSet = new Set(
    isFlipped ? rawAisles.map((idx) => totalCols - 2 - idx) : rawAisles
  );

  const updateOption = (key, value) => {
    if (onPrintOptionsChange) {
      onPrintOptionsChange({ [key]: value });
    }
  };

  return (
    <div className="print-page-shell">
      {/* 상단 네비게이션 및 액션 바 (인쇄 제외) */}
      <header className="print-top-nav no-print">
        <div className="print-top-nav-inner">
          <div className="print-nav-left">
            <button type="button" onClick={onBack} className="btn-ghost">
              ← 설정으로 돌아가기
            </button>
            <span className="nav-divider">|</span>
            <span className="print-nav-title">
              {settings.grade}학년 {settings.classNumber}반 자리배치표
            </span>
          </div>

          <div className="print-nav-right">
            <button
              type="button"
              className="btn-pill"
              onClick={() => onRearrange && onRearrange(false)}
              disabled={isSaving}
            >
              다시 배치하기
            </button>
            <button
              type="button"
              className="btn-pill"
              onClick={handleSaveAsImage}
              disabled={isSaving || isShuffling}
            >
              {isSaving ? '이미지 생성 중...' : '이미지로 저장'}
            </button>
            <button
              type="button"
              className="btn-filled"
              onClick={handlePrint}
              disabled={isShuffling}
            >
              출력하기
            </button>
          </div>
        </div>
      </header>

      {/* 표시 옵션 컨트롤 바 (인쇄 제외) */}
      <div className="print-subbar no-print">
        <div className="print-subbar-inner">
          <div className="option-pill-group" role="group" aria-label="표시 정보 선택">
            <button
              type="button"
              className={`btn-pill ${displayType === 'nameAndId' ? 'active' : ''}`}
              onClick={() => updateOption('displayType', 'nameAndId')}
            >
              학번 + 이름
            </button>
            <button
              type="button"
              className={`btn-pill ${displayType === 'nameOnly' ? 'active' : ''}`}
              onClick={() => updateOption('displayType', 'nameOnly')}
            >
              이름만
            </button>
            <button
              type="button"
              className={`btn-pill ${displayType === 'idOnly' ? 'active' : ''}`}
              onClick={() => updateOption('displayType', 'idOnly')}
            >
              학번만
            </button>
          </div>

          <div className="option-pill-group" role="group" aria-label="방향 및 용지 설정">
            <button
              type="button"
              className={`btn-pill ${isFlipped ? 'active' : ''}`}
              onClick={() => updateOption('isFlipped', !isFlipped)}
            >
              {isFlipped ? '교사 시점 (교탁 위)' : '학생 시점 (교탁 아래)'}
            </button>
            <button
              type="button"
              className={`btn-pill ${isLandscape ? 'active' : ''}`}
              onClick={() => updateOption('isLandscape', !isLandscape)}
            >
              {isLandscape ? 'A4 가로형' : 'A4 세로형'}
            </button>
          </div>
        </div>

        <div className="print-helper-row">
          <span>
            {selectedSwapSeat
              ? '맞바꿀 다른 좌석을 클릭하세요. (취소하려면 같은 좌석을 다시 클릭)'
              : '배치 완료 후 좌석 두 개를 차례로 클릭하면 두 학생의 자리를 맞바꿀 수 있습니다.'}
          </span>
          {onRearrange && !isShuffling && (
            <button
              type="button"
              className="btn-ghost muted"
              onClick={() => onRearrange(true)}
            >
              카운트다운 없이 즉시 재배치
            </button>
          )}
        </div>

        {Array.isArray(seatData?.warnings) && seatData.warnings.length > 0 && (
          <div className="print-warnings-bar" role="status">
            {seatData.warnings.map((msg, i) => (
              <p key={`pw-${i}`}>{msg}</p>
            ))}
          </div>
        )}
      </div>

      {/* 카운트다운 오버레이 (인쇄 제외) */}
      {isShuffling && (
        <div className="shuffle-banner-overlay no-print" role="status" aria-live="polite">
          <div className="shuffle-modal-card">
            <p className="section-eyebrow">자리 배치 진행 중</p>
            <div className="shuffle-countdown-digits">{String(countdown).padStart(2, '0')}</div>
            <p className="shuffle-desc">
              설정한 배치 방식과 학생별 고려사항을 반영하여 좌석을 배정하고 있습니다.
            </p>
            <button type="button" className="btn-filled" onClick={handleSkipAnimation}>
              건너뛰고 바로 결과 보기
            </button>
          </div>
        </div>
      )}

      {/* A4 인쇄 시트 프리뷰 */}
      <div className="sheet-stage">
        <div
          className={`a4-sheet ${isLandscape ? 'landscape' : 'portrait'} ${
            isShuffling ? 'is-shuffling' : ''
          }`}
          ref={printAreaRef}
        >
          <div className="page-content-wrapper">
            <header className="sheet-header">
              <div className="sheet-title-block">
                <h1>
                  {settings.grade}학년 {settings.classNumber}반 자리배치표
                </h1>
                <p className="sheet-subtitle">
                  {new Date(seatData?.arrangedAt || Date.now()).toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                  {' · '}
                  {getArrangementModeLabel(seatData?.settings || settings)}
                </p>
              </div>
            </header>

            <main className="sheet-body">
              <div className={`sheet-zone-bar ${isFlipped ? 'is-podium' : ''}`}>
                {isFlipped ? '교탁 (앞쪽)' : '교실 뒤'}
              </div>

              <div className="sheet-grid-viewport">
                <div
                  className="sheet-seat-grid"
                  style={{ transform: `scale(${scaleFactor})` }}
                >
                  {displayGrid.map((row, rIdx) => (
                    <div key={`p-row-${rIdx}`} className="sheet-seat-row">
                      {row.map((seat, cIdx) => {
                        const origR = isFlipped ? totalRows - 1 - rIdx : rIdx;
                        const origC = isFlipped ? totalCols - 1 - cIdx : cIdx;
                        const isSelectedForSwap =
                          selectedSwapSeat?.r === origR && selectedSwapSeat?.c === origC;

                        const rawId = seat.studentId || '';
                        const rawName = seat.studentName || '';
                        const isAutoNumberName = rawName === `${rawId}번`;

                        let primaryText = rawName;
                        let secondaryText = rawId;

                        if (displayType === 'nameOnly') {
                          primaryText = rawName;
                          secondaryText = '';
                        } else if (displayType === 'idOnly') {
                          primaryText = rawId;
                          secondaryText = '';
                        } else if (isAutoNumberName) {
                          primaryText = rawName;
                          secondaryText = '';
                        }

                        const isLongName = primaryText && primaryText.length >= 4;

                        return (
                          <React.Fragment key={`p-cell-${rIdx}-${cIdx}`}>
                            {cIdx > 0 && effectiveAisleSet.has(cIdx - 1) && (
                              <div className="sheet-aisle-spacer" aria-hidden="true" />
                            )}
                            <div
                              className={`sheet-seat-card ${
                                seat.occupied ? 'occupied' : 'vacant'
                              } ${isSelectedForSwap ? 'swap-selected' : ''}`}
                              onClick={() => seat.occupied && handleDeskSwapClick(rIdx, cIdx)}
                            >
                              {seat.occupied && (
                                <div className={`sheet-seat-inner mode-${displayType}`}>
                                  {secondaryText && (
                                    <span className="sheet-student-id">{secondaryText}</span>
                                  )}
                                  <span
                                    className={`sheet-student-name ${
                                      isLongName ? 'long-name' : ''
                                    }`}
                                  >
                                    {primaryText}
                                  </span>
                                </div>
                              )}
                            </div>
                          </React.Fragment>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              <div className={`sheet-zone-bar ${!isFlipped ? 'is-podium' : ''}`}>
                {isFlipped ? '교실 뒤' : '교탁 (앞쪽)'}
              </div>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrintLayout;
