import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as htmlToImage from 'html-to-image';
import './PrintLayout.css';

// 배열을 랜덤하게 섞는 헬퍼 함수
const shuffleArray = (array) => {
  if (!array) return [];
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

// 분단 인덱스 계산 함수
const getSectionIndex = (colIndex, aisles) => {
  let section = 0;
  const sortedAisles = [...aisles].sort((a, b) => a - b);
  for (const aisleIndex of sortedAisles) {
    if (colIndex > aisleIndex) {
      section++;
    }
  }
  return section;
};

const PrintLayout = ({ settings, seatData, onBack }) => {
  const [isShuffling, setIsShuffling] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [currentGrid, setCurrentGrid] = useState(null);
  const [displayType, setDisplayType] = useState('nameAndId'); // 'nameAndId', 'nameOnly', 'idOnly'
  const [isFlipped, setIsFlipped] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  
  // 스케일 계산을 위한 useEffect
  useEffect(() => {
    if (!currentGrid || !printAreaRef.current) return;
    
    const calculateScale = () => {
      const maxCols = Math.max(...currentGrid.map(row => row.length));
      const seatWidth = 90; // CSS의 print-seat-final 너비
      const seatGap = 10; // CSS의 gap
      const gridWidth = maxCols * seatWidth + (maxCols - 1) * seatGap;
      
      // A4 사이즈에서 패딩을 제외한 사용 가능한 너비 (px 단위로 변환)
      const availableWidth = isLandscape 
        ? (297 - 30) * 3.7795275591 // 가로 모드: 297mm - 30mm padding
        : (210 - 30) * 3.7795275591; // 세로 모드: 210mm - 30mm padding
      
      const scale = Math.min(1, availableWidth / gridWidth);
      
      const gridElement = printAreaRef.current.querySelector('.print-seat-grid-final');
      if (gridElement) {
        gridElement.style.transform = `scale(${scale})`;
      }
    };
    
    // DOM이 업데이트된 후 계산
    const timeoutId = setTimeout(calculateScale, 100);
    return () => clearTimeout(timeoutId);
  }, [currentGrid, isLandscape]);

  const printAreaRef = useRef(null);
  const animationFrameRef = useRef(null);
  const countdownIntervalRef = useRef(null);

  useEffect(() => {
    if (!seatData?.grid) {
        setCurrentGrid([]);
        setIsShuffling(false);
        return;
    }

    if (!seatData.students || seatData.students.length === 0) {
      setIsShuffling(false);
      setCurrentGrid(seatData.grid);
      return;
    }

    // skipAnimation이 true면 애니메이션 없이 즉시 표시
    if (seatData.skipAnimation) {
      setIsShuffling(false);
      setCurrentGrid(seatData.grid);
      return;
    }

    const studentList = seatData.students;
    const duration = 10000;
    const startTime = Date.now();

    const animate = () => {
      const shuffledStudents = shuffleArray(studentList);
      let studentIndex = 0;
      const newGrid = seatData.grid.map(row =>
        row.map(seat => {
          if (seat.occupied) {
            const randomStudent = shuffledStudents[studentIndex % shuffledStudents.length];
            studentIndex++;
            return { ...seat, studentName: randomStudent.name, studentId: randomStudent.number };
          }
          return seat;
        })
      );
      setCurrentGrid(newGrid);
      animationFrameRef.current = setTimeout(animate, 150);
    };

    setCurrentGrid(seatData.grid);
    animationFrameRef.current = setTimeout(animate, 150);

    countdownIntervalRef.current = setInterval(() => {
      const elapsedTime = Date.now() - startTime;
      const remainingTime = Math.max(0, duration - elapsedTime);
      setCountdown(Math.ceil(remainingTime / 1000));
      if (remainingTime <= 0) {
        if (animationFrameRef.current) clearTimeout(animationFrameRef.current);
        clearInterval(countdownIntervalRef.current);
        setIsShuffling(false);
        setCurrentGrid(seatData.grid);
      }
    }, 1000);

    return () => {
      if (animationFrameRef.current) clearTimeout(animationFrameRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [seatData]);

  const handlePrint = () => {
    // 가로 모드일 때 인쇄 스타일 동적 추가
    if (isLandscape) {
      const style = document.createElement('style');
      style.textContent = `
        @media print {
          @page {
            size: A4 landscape;
            margin: 0;
          }
        }
      `;
      document.head.appendChild(style);
      
      // 인쇄 후 스타일 제거
      setTimeout(() => {
        document.head.removeChild(style);
      }, 1000);
    }
    
    window.print();
  };

  const handleSaveAsImage = useCallback(() => {
    const container = printAreaRef.current;
    if (container === null) return;

    // 실제 콘텐츠 영역만 캡처하기 위해 page-content-wrapper를 타겟으로 설정
    const contentWrapper = container.querySelector('.page-content-wrapper');
    if (!contentWrapper) return;

    setIsSaving(true);

    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateString = `${year}${month}${day}`;
    const orientation = isLandscape ? '가로' : '세로';
    const filename = `${settings.grade}학년 ${settings.classNumber}반 자리배치표(${dateString}_${orientation}).png`;

    // A4 비율에 맞게 여백을 추가한 크기 계산
    const mmToPx = (mm) => (mm / 25.4) * 96; // 96 DPI 기준
    
    // 가로/세로 모드에 따른 A4 크기 설정
    const A4_WIDTH_PX = isLandscape ? Math.round(mmToPx(297)) : Math.round(mmToPx(210)); // 가로: 1123px, 세로: 794px
    const A4_HEIGHT_PX = isLandscape ? Math.round(mmToPx(210)) : Math.round(mmToPx(297)); // 가로: 794px, 세로: 1123px
    const MARGIN_PX = Math.round(mmToPx(20)); // 20mm 여백

    // page-content-wrapper를 A4 크기에 맞게 캡처
    htmlToImage.toPng(contentWrapper, { 
      cacheBust: true, 
      backgroundColor: '#ffffff', 
      pixelRatio: 2,
      // A4 크기에 여백을 고려한 크기로 캡처
      width: A4_WIDTH_PX,
      height: A4_HEIGHT_PX,
      style: {
        padding: `${MARGIN_PX}px`,
        boxSizing: 'border-box',
        width: A4_WIDTH_PX + 'px',
        height: A4_HEIGHT_PX + 'px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'center'
      }
    })
      .then((dataUrl) => {
        const link = document.createElement('a');
        link.download = filename;
        link.href = dataUrl;
        link.click();
      })
      .catch((err) => { console.error('이미지 변환에 실패했습니다.', err); })
      .finally(() => {
        setIsSaving(false);
      });
  }, [printAreaRef, settings.grade, settings.classNumber, isLandscape]);

  if (!currentGrid) {
    return (
      <div className="print-layout-final">
        <div className="error-message"><h2>자리 배치 데이터를 준비 중입니다...</h2></div>
      </div>
    );
  }

  const displayGrid = isFlipped && currentGrid ? [...currentGrid].reverse().map(row => [...row].reverse()) : currentGrid;

  const seatingGrid = displayGrid ? (
    <div className="print-seating-area-final">
      <div className="print-seat-grid-final">
        {displayGrid.map((row, rowIndex) => (
          <div key={rowIndex} className="print-seat-row-final">
            {row.map((seat, colIndex) => {
              const sectionIndex = getSectionIndex(colIndex, seatData.verticalAisles);
              
              const nameStyle = {};
              let displayName = seat.studentName;
              const nameClasses = ['student-name-final'];

              if (displayType === 'nameOnly' && seat.studentName) {
                if (seat.studentName.length >= 4) {
                  nameStyle.fontSize = '0.8em';
                } else if (seat.studentName.length === 2) {
                  displayName = seat.studentName.split('').join('  ');
                  nameClasses.push('short-name-2');
                }
              }

              const infoStyle = {};
              if (displayType === 'nameOnly' && seat.studentName && seat.studentName.length >= 4) {
                  const horizontalPadding = Math.max(0, 5 - (seat.studentName.length - 3) * 1);
                  infoStyle['--name-padding-x'] = `${horizontalPadding}px`;
              }

              return (
                <React.Fragment key={colIndex}>
                  {colIndex > 0 && seatData.verticalAisles.includes(colIndex - 1) && (
                    <div className="print-vertical-aisle-final"></div>
                  )}
                  <div 
                    className={`print-seat-final ${seat.occupied ? 'occupied' : 'hidden'}`}
                    data-section-index={sectionIndex}
                  >
                    {seat.occupied && (
                      <div className={`print-student-info-final display-${displayType}`}
                           style={infoStyle}
                      >
                        {displayType !== 'idOnly' && <div className={nameClasses.join(' ')} style={nameStyle}>{displayName}</div>}
                        {displayType !== 'nameOnly' && <div className="student-id-final">{seat.studentId || seat.studentNumber || seat.number}</div>}
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
  ) : null;

  return (
    <div className={`print-layout-final ${isShuffling ? 'shuffling' : ''}`}>
      {isSaving && (
        <div className="saving-overlay">
          <div className="saving-message">조금만 기다리시면 다운로드가 시작됩니다.</div>
        </div>
      )}
      <div className={`countdown-overlay ${isShuffling ? 'show' : ''}`}>
        <div className="countdown-number">{countdown}</div>
      </div>

      <div className="print-controls-wrapper no-print">
        <div className="print-controls">
            <button onClick={onBack} className="back-btn">← 메인으로 돌아가기</button>
            <button onClick={handleSaveAsImage} className="save-btn" disabled={isSaving}>🖼️ 이미지로 저장</button>
            <button onClick={handlePrint} className="print-btn">🖨️ 출력하기</button>
        </div>
        <div className="display-options">
            <button className={`option-btn name-id-option ${displayType === 'nameAndId' ? 'active' : ''}`} onClick={() => setDisplayType('nameAndId')}>학번+이름</button>
            <button className={`option-btn name-only-option ${displayType === 'nameOnly' ? 'active' : ''}`} onClick={() => setDisplayType('nameOnly')}>이름만</button>
            <button className={`option-btn id-only-option ${displayType === 'idOnly' ? 'active' : ''}`} onClick={() => setDisplayType('idOnly')}>학번만</button>
            <button className="option-btn flip-btn" onClick={() => setIsFlipped(!isFlipped)}>🔄 상하 변경</button>
            <button className={`option-btn landscape-btn ${isLandscape ? 'active' : ''}`} onClick={() => setIsLandscape(!isLandscape)}>📄 가로/세로 보기</button>
        </div>
      </div>

      <div className={`a4-container-final ${isLandscape ? 'landscape' : ''}`} ref={printAreaRef}>
        <div className="page-content-wrapper">
          <header className="print-header-final">
            <h1>{settings.grade}학년 {settings.classNumber}반 자리배치표</h1>
            <p className="print-date-final">{new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </header>

          <main className="print-classroom-final">
            {isFlipped ? (
              <>
                <div className="classroom-label-bottom">교탁</div>
                {seatingGrid}
                <div className="classroom-label-top">교실 뒤</div>
              </>
            ) : (
              <>
                <div className="classroom-label-top">교실 뒤</div>
                {seatingGrid}
                <div className="classroom-label-bottom">교탁</div>
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default PrintLayout;