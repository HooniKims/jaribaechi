import React, { useEffect, useRef, useState } from 'react';
import './App.css';
import ControlPanel from './components/ControlPanel';
import ClassroomLayout from './components/ClassroomLayout';
import PrintLayout from './components/PrintLayout';

const APP_STORAGE_KEY = 'jaribaechi-app-state-v1';

const DEFAULT_CLASS_SETTINGS = {
  grade: 1,
  classNumber: 1,
  studentCount: 24,
  maleCount: 12,
  femaleCount: 12,
  pairingType: 'mixed',
  seatArrangement: 'pair'
};

const DEFAULT_TEACHER_NOTES = {
  togetherStudents: [],
  separateStudents: [],
  considerationStudents: [],
};

const normalizeTeacherNotes = (teacherNotes = {}) => ({
  togetherStudents: Array.isArray(teacherNotes.togetherStudents) ? teacherNotes.togetherStudents : [],
  separateStudents: Array.isArray(teacherNotes.separateStudents) ? teacherNotes.separateStudents : [],
  considerationStudents: Array.isArray(teacherNotes.considerationStudents) ? teacherNotes.considerationStudents : [],
});

const loadPersistedAppState = () => {
  if (typeof window === 'undefined') return null;

  try {
    const rawState = window.localStorage.getItem(APP_STORAGE_KEY);
    if (!rawState) return null;

    const parsedState = JSON.parse(rawState);
    return parsedState && typeof parsedState === 'object' ? parsedState : null;
  } catch (error) {
    console.error('저장된 앱 상태를 불러오지 못했습니다.', error);
    return null;
  }
};

const getInitialAppState = () => {
  const persistedState = loadPersistedAppState();

  return {
    classSettings: { ...DEFAULT_CLASS_SETTINGS, ...(persistedState?.classSettings || {}) },
    students: Array.isArray(persistedState?.students) ? persistedState.students : [],
    currentPage: persistedState?.currentPage === 'print' ? 'print' : 'main',
    seatData: persistedState?.seatData?.grid ? persistedState.seatData : null,
    teacherNotes: normalizeTeacherNotes(persistedState?.teacherNotes),
  };
};

function App() {
  const initialAppStateRef = useRef(getInitialAppState());
  const [classSettings, setClassSettings] = useState(initialAppStateRef.current.classSettings);
  const [students, setStudents] = useState(initialAppStateRef.current.students);
  const [currentPage, setCurrentPage] = useState(initialAppStateRef.current.currentPage);
  const [seatData, setSeatData] = useState(initialAppStateRef.current.seatData);
  const [teacherNotes, setTeacherNotes] = useState(initialAppStateRef.current.teacherNotes);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      window.localStorage.setItem(
        APP_STORAGE_KEY,
        JSON.stringify({
          classSettings,
          students,
          currentPage,
          seatData,
          teacherNotes,
        })
      );
    } catch (error) {
      console.error('앱 상태를 저장하지 못했습니다.', error);
    }
  }, [classSettings, students, currentPage, seatData, teacherNotes]);

  const handleSettingsChange = (newSettings) => {
    if (newSettings.students) {
      setStudents(newSettings.students);
      setSeatData(null);
      setTeacherNotes(DEFAULT_TEACHER_NOTES);
      const { students, ...restSettings } = newSettings;
      setClassSettings(prev => ({ ...prev, ...restSettings }));
    } else {
      setClassSettings(prev => ({ ...prev, ...newSettings }));
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
    if (!seatData) return;

    if (isViewOnly) {
      setSeatData({ ...seatData, skipAnimation: true });
      setCurrentPage('print');
      return;
    }

    setSeatData(null);
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
