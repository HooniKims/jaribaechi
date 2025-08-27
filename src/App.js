import React, { useState } from 'react';
import './App.css';
import ControlPanel from './components/ControlPanel';
import ClassroomLayout from './components/ClassroomLayout';
import PrintLayout from './components/PrintLayout';

function App() {
  const [classSettings, setClassSettings] = useState({
    grade: 1,
    classNumber: 1,
    studentCount: 24,
    maleCount: 12,
    femaleCount: 12,
    pairingType: 'mixed', // 'mixed', 'male', 'female', 'single'
    seatArrangement: 'pair' // 'pair', 'single'
  });
  const [students, setStudents] = useState([]); // 학생 목록 상태 추가
  const [currentPage, setCurrentPage] = useState('main'); // 'main', 'print'
  const [seatData, setSeatData] = useState(null); // 자리 배치 데이터
  const [teacherNotes, setTeacherNotes] = useState({
    togetherStudents: [],
    separateStudents: [],
    considerationStudents: [],
  }); // 교사 참고사항 상태 추가

  const handleSettingsChange = (newSettings) => {
    if (newSettings.students) {
      setStudents(newSettings.students);
      // 학생 구성이 바뀌면 기존 배치 데이터와 교사 참고사항 초기화
      setSeatData(null);
      setTeacherNotes({
        togetherStudents: [],
        separateStudents: [],
        considerationStudents: [],
      });
      // students는 classSettings와 별도로 관리
      const { students, ...restSettings } = newSettings;
      setClassSettings(prev => ({ ...prev, ...restSettings }));
    } else {
      setClassSettings(prev => ({ ...prev, ...newSettings }));
      // 학급 설정이 바뀌어도 기존 배치 데이터 초기화
      setSeatData(null);
    }
  };

  const handleRandomArrangement = (generatedSeatData) => {
    setSeatData(generatedSeatData);
    setCurrentPage('print');
  };

  const handleBackToMain = () => {
    setCurrentPage('main');
  };

  const handleViewResults = (isViewOnly = false) => {
    if (seatData) {
      if (isViewOnly) {
        // 배치 다시보기: 즉시 결과 표시 (애니메이션 없음)
        setSeatData({ ...seatData, skipAnimation: true });
        setCurrentPage('print');
      } else {
        // 재배치하기: 기존 데이터 초기화 후 새로 배치 요청
        setSeatData(null); // 기존 배치 데이터 초기화
        // ClassroomLayout에서 새로운 배치 생성을 트리거하기 위해 페이지를 유지
      }
    }
  };

  const handleResetArrangement = () => {
    setSeatData(null);
  };

  if (currentPage === 'print') {
    return (
      <PrintLayout 
        settings={classSettings} 
        seatData={seatData}
        onBack={handleBackToMain}
        students={students}
      />
    );
  }

  return (
    <div className="App">
      <header className="app-header">
        <h1>🏫 학급 자리배치 도우미</h1>
        <p className="copyright">ⓒ HooniKim All rights reserved</p>
      </header>

      <main className="app-main">
        <ControlPanel settings={classSettings} onSettingsChange={handleSettingsChange} students={students} />
        <ClassroomLayout 
          settings={classSettings} 
          students={students}
          onRandomArrangement={handleRandomArrangement}
          seatData={seatData}
          onViewResults={handleViewResults}
          onResetArrangement={handleResetArrangement}
          teacherNotes={teacherNotes}
          onTeacherNotesChange={setTeacherNotes}
        />
      </main>
    </div>
  );
}

export default App;