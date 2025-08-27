import React, { useState, useEffect, useCallback } from 'react';
import './RandomArrangementPage.css';

const shuffleArray = (array) => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

const RandomArrangementPage = ({ settings, students: initialStudents, onComplete, onBack }) => {
  const [countdown, setCountdown] = useState(10);
  const [isAnimating, setIsAnimating] = useState(false);
  const [currentGrid, setCurrentGrid] = useState([]);
  const [finalGrid, setFinalGrid] = useState([]);
  const [gridSize, setGridSize] = useState({ rows: 6, cols: 6 });
  const [verticalAisles, setVerticalAisles] = useState(new Set());
  const [students, setStudents] = useState(initialStudents || []);

  // 초기 설정
  useEffect(() => {
    initializeArrangement();
  }, [settings]);

  // 카운트다운 및 애니메이션 시작
  useEffect(() => {
    if (!isAnimating) return;

    const duration = 10000; // 10초
    const startTime = Date.now();

    // (A) 좌석 이름을 계속 섞는 부분 — 0.1초마다 갱신
    const animationInterval = setInterval(() => {
      generateRandomFrame();
    }, 100);

    // (B) 카운트다운 숫자 표시 — 1초마다 남은 시간 갱신
    const countdownInterval = setInterval(() => {
      const elapsedTime = Date.now() - startTime;
      const remainingTime = Math.max(0, Math.ceil((duration - elapsedTime) / 1000));
      setCountdown(remainingTime);

      if (remainingTime <= 0) {
        clearInterval(animationInterval);
        clearInterval(countdownInterval);
        setIsAnimating(false);
        setCurrentGrid(finalGrid);
        setTimeout(() => {
          const seatData = {
            grid: finalGrid,
            gridSize: gridSize,
            verticalAisles: Array.from(verticalAisles),
            students: students,
            settings: settings
          };
          onComplete(seatData);
        }, 1000);
      }
    }, 1000);

    return () => {
      clearInterval(animationInterval);
      clearInterval(countdownInterval);
    };
  }, [isAnimating, finalGrid, students, gridSize, verticalAisles, settings, onComplete, generateRandomFrame]);

  const initializeArrangement = () => {
    const { studentCount, maleCount, femaleCount, seatArrangement } = settings;

    // 학생 목록이 없으면 생성
    let studentList = students;
    if (!studentList || studentList.length === 0) {
      studentList = [];
      for (let i = 1; i <= maleCount; i++) {
        studentList.push({ number: `M${i}`, name: `남학생${i}`, gender: 'male' });
      }
      for (let i = 1; i <= femaleCount; i++) {
        studentList.push({ number: `F${i}`, name: `여학생${i}`, gender: 'female' });
      }
      setStudents(studentList);
    }

    // 그리드 크기 계산
    let rows, cols;
    if (seatArrangement === 'single') {
      const maxStudentsPerCol = 6;
      const minCols = 3;
      cols = Math.max(minCols, Math.ceil(studentCount / maxStudentsPerCol));
      rows = Math.min(maxStudentsPerCol, Math.ceil(studentCount / cols));
    } else {
      rows = 6;
      cols = 6;
    }
    setGridSize({ rows, cols });

    // 통로 설정
    const newAisles = new Set();
    if (seatArrangement === 'pair') {
      for (let i = 1; i < cols - 1; i += 2) {
        newAisles.add(i);
      }
    } else {
      for (let i = 0; i < cols - 1; i++) {
        newAisles.add(i);
      }
    }
    setVerticalAisles(newAisles);

    // 최종 배치 생성
    const shuffledStudents = [...studentList].sort(() => Math.random() - 0.5);
    const grid = generateFinalGrid(rows, cols, shuffledStudents);
    setFinalGrid(grid);

    // 초기 그리드 (occupied seats)
    const initialOccupiedGrid = generateFinalGrid(rows, cols, studentList);
    setCurrentGrid(initialOccupiedGrid);
  };

  const generateFinalGrid = (rows, cols, shuffledStudents) => {
    const grid = [];
    let studentIndex = 0;

    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        if (studentIndex < shuffledStudents.length) {
          const student = shuffledStudents[studentIndex];
          row.push({
            occupied: true,
            studentType: student.gender,
            studentName: student.name,
            studentId: student.id
          });
          studentIndex++;
        } else {
          row.push({ occupied: false, studentType: null });
        }
      }
      grid.push(row);
    }
    return grid;
  };

  const generateRandomFrame = useCallback(() => {
    const studentNames = students.map(s => s.name);
    const shuffledNames = shuffleArray(studentNames);
    let nameIndex = 0;

    const tempGrid = currentGrid.map(row =>
      row.map(seat => {
        if (seat.occupied) {
          const randomName = shuffledNames[nameIndex % shuffledNames.length];
          nameIndex++;
          const student = students.find(s => s.name === randomName) || {};
          return { ...seat, studentName: randomName, studentType: student.gender, studentId: student.number };
        }
        return seat;
      })
    );
    setCurrentGrid(tempGrid);
  }, [currentGrid, students]);

  const startRandomArrangement = () => {
    setIsAnimating(true);
    setCountdown(10);
  };

  const handleSkip = () => {
    setIsAnimating(false);
    setCountdown(0);
    setCurrentGrid(finalGrid);
    setTimeout(() => {
      const seatData = {
        grid: finalGrid,
        gridSize: gridSize,
        verticalAisles: Array.from(verticalAisles),
        students: students,
        settings: settings
      };
      onComplete(seatData);
    }, 500);
  };

  return (
    <div className="random-arrangement-page">
      {/* 헤더 */}
      <div className="random-header">
        <button onClick={onBack} className="back-btn">
          ← 돌아가기
        </button>
        <div className="random-title">
          <h1>🎲 랜덤 자리 배치</h1>
          <p>{settings.grade}학년 {settings.classNumber}반 - 총 {settings.studentCount}명</p>
        </div>
      </div>

      {/* 카운트다운 및 컨트롤 */}
      <div className="countdown-section">
        {!isAnimating ? (
          <div className="start-section">
            <div className="countdown-display ready">
              <span className="countdown-number">🎯</span>
              <span className="countdown-text">준비 완료!</span>
            </div>
            <button onClick={startRandomArrangement} className="start-btn">
              <span className="btn-icon">🚀</span>
              랜덤 배치 시작
            </button>
          </div>
        ) : countdown > 0 ? (
          <div className="animating-section">
            <div className={`countdown-display ${isAnimating ? 'show' : ''}`}>
              <span className="countdown-number">{countdown}</span>
              <span className="countdown-text">초 후 배치 완료</span>
            </div>
            <div className="animation-status">
              <div className="status-text">🎲 자리를 랜덤하게 배치하는 중...</div>
              <button onClick={handleSkip} className="skip-btn">
                건너뛰기 →
              </button>
            </div>
          </div>
        ) : (
          <div className="complete-section">
            <div className="countdown-display complete">
              <span className="countdown-number">✅</span>
              <span className="countdown-text">배치 완료!</span>
            </div>
            <div className="complete-message">
              출력용 페이지로 이동합니다...
            </div>
          </div>
        )}
      </div>

      {/* 교실 레이아웃 미리보기 */}
      <div className="preview-classroom">
        <div className="preview-header">
          <h3>🏫 배치 미리보기</h3>
        </div>

        <div className="preview-back">교실 뒤</div>

        <div className="preview-seating-area">
          <div className="preview-seat-grid">
            {currentGrid.map((row, rowIndex) => (
              <div key={`row-${rowIndex}`} className="preview-seat-row">
                {row.map((seat, colIndex) => (
                  <React.Fragment key={`${rowIndex}-${colIndex}`}>
                    {/* 세로 통로 */}
                    {colIndex > 0 && verticalAisles.has(colIndex - 1) && (
                      <div className="preview-vertical-aisle"></div>
                    )}
                    
                    {/* 좌석 */}
                    <div
                      className={`preview-seat ${seat.occupied ? 'occupied' : 'empty'} ${
                        seat.studentType === 'male' ? 'male' : 
                        seat.studentType === 'female' ? 'female' : ''
                      } ${isAnimating && countdown > 0 ? 'animating' : ''}`}
                    >
                      {seat.occupied ? (
                        <div className="preview-student-info">
                          <div className="student-id">{seat.studentId}</div>
                          <div className="student-name">{seat.studentName}</div>
                        </div>
                      ) : (
                        <div className="empty-indicator">-</div>
                      )}
                    </div>
                  </React.Fragment>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="preview-front">교탁</div>
      </div>

      {/* 배치 정보 */}
      <div className="arrangement-summary">
        <div className="summary-item">
          <span className="summary-label">배치 방식:</span>
          <span className="summary-value">
            {settings.seatArrangement === 'pair' ? '짝' : '혼자 앉기'}
            {settings.seatArrangement === 'pair' && (
              <span className="sub-value">
                ({settings.pairingType === 'mixed' ? '남녀' :
                  settings.pairingType === 'samegender' ? '성별끼리' :
                  settings.pairingType === 'male' ? '남학교' : '여학교'})
              </span>
            )}
          </span>
        </div>
        <div className="summary-item">
          <span className="summary-label">학생 구성:</span>
          <span className="summary-value">
            남학생 {settings.maleCount}명, 여학생 {settings.femaleCount}명
          </span>
        </div>
      </div>
    </div>
  );
};

export default RandomArrangementPage;
