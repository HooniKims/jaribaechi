import React, { useEffect, useRef, useState, useCallback } from 'react';
import './App.css';
import ControlPanel from './components/ControlPanel';
import ClassroomLayout, { loadCurrentLayoutForArrangement } from './components/ClassroomLayout';
import PrintLayout from './components/PrintLayout';
import {
  generateSeatingArrangement,
  getArrangementModeLabel,
  isGenderFreeMode,
} from './utils/seatingAlgorithm';

const APP_STORAGE_KEY = 'jaribaechi-app-state-v1';

const DEFAULT_CLASS_SETTINGS = {
  grade: 1,
  classNumber: 1,
  studentCount: 24,
  maleCount: 12,
  femaleCount: 12,
  pairingType: 'mixed',
  seatArrangement: 'pair',
  deskLayout: 'pair',
};

const DEFAULT_TEACHER_NOTES = {
  togetherStudents: [],
  separateStudents: [],
  considerationStudents: [],
};

const DEFAULT_PRINT_OPTIONS = {
  displayType: 'nameAndId',
  isFlipped: false,
  isLandscape: false,
};

const normalizeTeacherNotes = (teacherNotes = {}) => ({
  togetherStudents: Array.isArray(teacherNotes?.togetherStudents)
    ? teacherNotes.togetherStudents
    : [],
  separateStudents: Array.isArray(teacherNotes?.separateStudents)
    ? teacherNotes.separateStudents
    : [],
  considerationStudents: Array.isArray(teacherNotes?.considerationStudents)
    ? teacherNotes.considerationStudents
    : [],
});

const normalizePrintOptions = (opts = {}) => ({
  displayType: ['nameAndId', 'nameOnly', 'idOnly'].includes(opts?.displayType)
    ? opts.displayType
    : DEFAULT_PRINT_OPTIONS.displayType,
  isFlipped: typeof opts?.isFlipped === 'boolean' ? opts.isFlipped : DEFAULT_PRINT_OPTIONS.isFlipped,
  isLandscape:
    typeof opts?.isLandscape === 'boolean' ? opts.isLandscape : DEFAULT_PRINT_OPTIONS.isLandscape,
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
  const initialSeatData = persistedState?.seatData?.grid ? persistedState.seatData : null;
  const initialPage =
    persistedState?.currentPage === 'print' && initialSeatData ? 'print' : 'main';

  return {
    classSettings: { ...DEFAULT_CLASS_SETTINGS, ...(persistedState?.classSettings || {}) },
    students: Array.isArray(persistedState?.students) ? persistedState.students : [],
    currentPage: initialPage,
    seatData: initialSeatData,
    teacherNotes: normalizeTeacherNotes(persistedState?.teacherNotes),
    printOptions: normalizePrintOptions(persistedState?.printOptions),
  };
};

function App() {
  const initialAppStateRef = useRef(getInitialAppState());
  const classroomActionRef = useRef(null);

  const [classSettings, setClassSettings] = useState(initialAppStateRef.current.classSettings);
  const [students, setStudents] = useState(initialAppStateRef.current.students);
  const [currentPage, setCurrentPage] = useState(initialAppStateRef.current.currentPage);
  const [seatData, setSeatData] = useState(initialAppStateRef.current.seatData);
  const [teacherNotes, setTeacherNotes] = useState(initialAppStateRef.current.teacherNotes);
  const [printOptions, setPrintOptions] = useState(initialAppStateRef.current.printOptions);

  // 브라우저 뒤로가기 / 앞으로가기(popstate) 연동 — 뒤로가기를 눌러도 배치된 데이터 완벽 유지
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const currentHistoryState = window.history.state;
    if (!currentHistoryState || !currentHistoryState.jaribaechiPage) {
      if (initialAppStateRef.current.currentPage === 'print') {
        window.history.replaceState({ jaribaechiPage: 'main' }, '');
        window.history.pushState({ jaribaechiPage: 'print' }, '');
      } else {
        window.history.replaceState({ jaribaechiPage: 'main' }, '');
      }
    }

    const handlePopState = (event) => {
      const targetPage = event.state?.jaribaechiPage;
      if (targetPage === 'print') {
        setSeatData((prev) => {
          if (!prev) {
            setCurrentPage('main');
            return null;
          }
          setCurrentPage('print');
          return { ...prev, skipAnimation: true };
        });
      } else {
        // 뒤로가기 시 seatData를 절대 삭제하지 않고 그대로 유지 (다시 보기 시 애니메이션 생략 표시)
        setSeatData((prev) => (prev ? { ...prev, skipAnimation: true } : null));
        setCurrentPage('main');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // 로컬 스토리지 자동 저장
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
          printOptions,
        })
      );
    } catch (error) {
      console.error('앱 상태를 저장하지 못했습니다.', error);
    }
  }, [classSettings, students, currentPage, seatData, teacherNotes, printOptions]);

  const navigateToPage = useCallback((nextPage) => {
    setCurrentPage((prevPage) => {
      if (prevPage !== nextPage && typeof window !== 'undefined') {
        window.history.pushState({ jaribaechiPage: nextPage }, '');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return nextPage;
    });
  }, []);

  const handleSettingsChange = useCallback((newSettings) => {
    const {
      students: nextStudents,
      clearTeacherNotes,
      preserveSeatData,
      ...restSettings
    } = newSettings;

    if (Array.isArray(nextStudents)) {
      setStudents(nextStudents);
    }

    if (clearTeacherNotes) {
      setTeacherNotes(DEFAULT_TEACHER_NOTES);
    }

    const settingKeys = Object.keys(restSettings);
    const isMetadataOnlyChange =
      !Array.isArray(nextStudents) &&
      settingKeys.length > 0 &&
      settingKeys.every((k) => k === 'grade' || k === 'classNumber');

    if (settingKeys.length > 0) {
      setClassSettings((prev) => {
        const merged = { ...prev, ...restSettings };
        // 남녀 구분이 필요한 모드로 복귀했을 때 남/여 인원 합계가 학생 수와 맞지 않으면 자동 보정
        if (!isGenderFreeMode(merged) && Number(merged.studentCount) > 0) {
          const total = Number(merged.studentCount);
          if (merged.seatArrangement === 'pair' && merged.pairingType === 'male') {
            merged.maleCount = total;
            merged.femaleCount = 0;
          } else if (merged.seatArrangement === 'pair' && merged.pairingType === 'female') {
            merged.maleCount = 0;
            merged.femaleCount = total;
          } else if (Number(merged.maleCount || 0) + Number(merged.femaleCount || 0) !== total) {
            const sourceStudents = Array.isArray(nextStudents) ? nextStudents : null;
            if (sourceStudents && sourceStudents.length === total) {
              merged.maleCount = sourceStudents.filter((s) => s.gender !== 'female').length;
              merged.femaleCount = total - merged.maleCount;
            } else {
              merged.maleCount = Math.ceil(total / 2);
              merged.femaleCount = total - merged.maleCount;
            }
          }
        }
        return merged;
      });
    }

    if (isMetadataOnlyChange || preserveSeatData) {
      setSeatData((prev) =>
        prev
          ? {
              ...prev,
              settings: { ...(prev.settings || {}), ...restSettings },
            }
          : null
      );
    } else if (clearTeacherNotes) {
      setSeatData(null);
    }
  }, []);

  const handleRandomArrangement = useCallback(
    (generatedSeatData) => {
      setSeatData({ ...generatedSeatData, skipAnimation: false });
      navigateToPage('print');
    },
    [navigateToPage]
  );

  const handleBackToMain = useCallback(() => {
    setSeatData((prev) => (prev ? { ...prev, skipAnimation: true } : null));
    navigateToPage('main');
  }, [navigateToPage]);

  const handleViewResults = useCallback(
    (isViewOnly = true) => {
      if (!seatData) return;

      if (isViewOnly) {
        setSeatData((prev) => (prev ? { ...prev, skipAnimation: true } : null));
        navigateToPage('print');
        return;
      }

      setSeatData(null);
    },
    [seatData, navigateToPage]
  );

  const handleResetArrangement = useCallback(() => {
    setSeatData(null);
  }, []);

  // 결과(인쇄) 페이지에서 바로 '다시 배치하기' 실행
  const handleRearrangeFromPrint = useCallback(
    (skipCountdown = false) => {
      const persistedLayout = loadCurrentLayoutForArrangement(seatData);
      if (!persistedLayout) return;

      const freshSeatData = generateSeatingArrangement({
        seatGrid: persistedLayout.seatGrid,
        verticalAisles: persistedLayout.verticalAisles,
        settings: classSettings,
        students,
        teacherNotes,
      });

      setSeatData({
        ...freshSeatData,
        skipAnimation: Boolean(skipCountdown),
      });
    },
    [seatData, classSettings, students, teacherNotes]
  );

  const handleUpdateSeatData = useCallback((updatedSeatData) => {
    setSeatData({ ...updatedSeatData, skipAnimation: true });
  }, []);

  const handlePrintOptionsChange = useCallback((partialOpts) => {
    setPrintOptions((prev) => ({ ...prev, ...partialOpts }));
  }, []);

  const triggerPrimaryArrangement = () => {
    if (classroomActionRef.current?.runArrangement) {
      classroomActionRef.current.runArrangement();
    }
  };

  if (currentPage === 'print' && seatData) {
    return (
      <PrintLayout
        settings={classSettings}
        seatData={seatData}
        onBack={handleBackToMain}
        onRearrange={handleRearrangeFromPrint}
        onUpdateSeatData={handleUpdateSeatData}
        printOptions={printOptions}
        onPrintOptionsChange={handlePrintOptionsChange}
      />
    );
  }

  const genderFree = isGenderFreeMode(classSettings);

  return (
    <div className="App">
      <header className="top-nav">
        <div className="top-nav-inner">
          <div className="top-nav-left">
            <a href="#top" className="brand-wordmark">
              학급 자리배치
            </a>
            <nav className="top-nav-links" aria-label="주요 섹션 이동">
              <a href="#section-settings" className="btn-ghost">
                학급 설정
              </a>
              <a href="#section-classroom" className="btn-ghost">
                좌석 설계
              </a>
              <a href="#section-notes" className="btn-ghost">
                배치 고려사항
              </a>
            </nav>
          </div>
          <div className="top-nav-right">
            {seatData && (
              <button
                type="button"
                className="btn-ghost"
                onClick={() => handleViewResults(true)}
              >
                저장된 배치표 보기
              </button>
            )}
            <button
              type="button"
              className="btn-filled"
              onClick={triggerPrimaryArrangement}
            >
              {seatData ? '다시 배치하기' : '자리 배치하기'}
            </button>
          </div>
        </div>
      </header>

      <main id="top" className="app-main">
        <section className="editorial-hero" aria-labelledby="hero-heading">
          <div className="hero-copy">
            <p className="section-eyebrow">교실 좌석 설계 노트</p>
            <h1 id="hero-heading">조용하고 정확한 교실 자리배치</h1>
            <p className="hero-description">
              짝 배치, 혼자 배치, 남녀 구분 없는 통합 랜덤 배치를 지원합니다. 붙여 앉을 학생과
              분리할 학생, 앞·뒤·좌·우 배려 좌석까지 정확하게 반영하여 인쇄용 배치표를
              완성하세요.
            </p>
            <div className="hero-chip-row" role="group" aria-label="빠른 자리 배치 방식 선택">
              <button
                type="button"
                className={`btn-pill ${classSettings.seatArrangement === 'pair' ? 'active' : ''}`}
                onClick={() => handleSettingsChange({ seatArrangement: 'pair' })}
              >
                짝 지어 앉기
              </button>
              <button
                type="button"
                className={`btn-pill ${classSettings.seatArrangement === 'single' ? 'active' : ''}`}
                onClick={() => handleSettingsChange({ seatArrangement: 'single' })}
              >
                혼자 앉기
              </button>
              <button
                type="button"
                className={`btn-pill ${
                  classSettings.seatArrangement === 'mixedRandom' ? 'active' : ''
                }`}
                onClick={() => handleSettingsChange({ seatArrangement: 'mixedRandom' })}
              >
                남녀 통합 랜덤
              </button>
            </div>
          </div>

          <div className="hero-media-card">
            <img
              src={`${process.env.PUBLIC_URL || '.'}/editorial-classroom.jpg`}
              alt="정오의 자연광이 비치는 정돈된 교실 책상 풍경"
              className="hero-image"
            />
            <div className="hero-media-meta">
              <span>
                {classSettings.grade}학년 {classSettings.classNumber}반 · 총{' '}
                {classSettings.studentCount || 0}명
                {!genderFree &&
                  ` (남 ${classSettings.maleCount || 0} · 여 ${classSettings.femaleCount || 0})`}
              </span>
              <span>{getArrangementModeLabel(classSettings)}</span>
            </div>
          </div>
        </section>

        <ControlPanel
          settings={classSettings}
          onSettingsChange={handleSettingsChange}
          students={students}
        />

        <ClassroomLayout
          ref={classroomActionRef}
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

      <footer className="site-footer">
        <div className="site-footer-inner">
          <div className="footer-col">
            <span className="footer-title">학급 자리배치 도우미</span>
            <p className="footer-caption">
              입력한 명단과 배치 결과는 현재 브라우저의 로컬 저장소에만 안전하게 보관됩니다.
            </p>
          </div>
          <div className="footer-col footer-links">
            <a href="#section-settings">학급 설정</a>
            <a href="#section-classroom">좌석 설계</a>
            <a href="#section-notes">배치 고려사항</a>
            <span className="footer-copyright">© HooniKim All rights reserved</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
