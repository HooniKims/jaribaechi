import React, { useRef, useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import './ControlPanel.css';
import { getArrangementModeLabel, isGenderFreeMode } from '../utils/seatingAlgorithm';

const ControlPanel = ({ settings, onSettingsChange, students }) => {
  const fileInputRef = useRef(null);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [showExample, setShowExample] = useState(false);
  const [isStudentTableCollapsed, setIsStudentTableCollapsed] = useState(true);
  const [manualStudents, setManualStudents] = useState([]);

  const genderFree = isGenderFreeMode(settings);

  useEffect(() => {
    setManualStudents(students || []);
  }, [students]);

  const handleModeChange = (mode) => {
    if (mode === 'mixedRandom') {
      onSettingsChange({
        seatArrangement: 'mixedRandom',
        deskLayout: settings.deskLayout || 'pair',
      });
      return;
    }

    const total = Number(settings.studentCount) || manualStudents.length || 24;
    let maleCount = Number(settings.maleCount || 0);
    let femaleCount = Number(settings.femaleCount || 0);

    if (maleCount + femaleCount !== total) {
      if (manualStudents.length === total && manualStudents.length > 0) {
        maleCount = manualStudents.filter((s) => s.gender !== 'female').length;
        femaleCount = total - maleCount;
      } else {
        maleCount = Math.ceil(total / 2);
        femaleCount = total - maleCount;
      }
    }

    onSettingsChange({
      seatArrangement: mode,
      studentCount: total,
      maleCount,
      femaleCount,
    });
  };

  const handlePairingTypeChange = (pairingType) => {
    const total = Number(settings.studentCount) || manualStudents.length || 0;
    if (pairingType === 'male') {
      const updated = manualStudents.map((s) => ({ ...s, gender: 'male' }));
      setManualStudents(updated);
      onSettingsChange({
        pairingType,
        maleCount: total,
        femaleCount: 0,
        ...(manualStudents.length > 0 ? { students: updated } : {}),
      });
      return;
    }
    if (pairingType === 'female') {
      const updated = manualStudents.map((s) => ({ ...s, gender: 'female' }));
      setManualStudents(updated);
      onSettingsChange({
        pairingType,
        maleCount: 0,
        femaleCount: total,
        ...(manualStudents.length > 0 ? { students: updated } : {}),
      });
      return;
    }
    onSettingsChange({ pairingType });
  };

  const handleInputChange = (field, value) => {
    onSettingsChange({ [field]: value });
  };

  const handleStudentDataChange = (updatedStudents, extraSettings = {}) => {
    const maleCount = updatedStudents.filter((s) => s.gender !== 'female').length;
    const femaleCount = updatedStudents.length - maleCount;
    onSettingsChange({
      students: updatedStudents,
      studentCount: updatedStudents.length,
      maleCount,
      femaleCount,
      ...extraSettings,
    });
  };

  const handleStudentRowChange = (index, field, value) => {
    const updatedStudents = [...manualStudents];
    updatedStudents[index] = { ...updatedStudents[index], [field]: value };
    setManualStudents(updatedStudents);
    handleStudentDataChange(updatedStudents);
  };

  const addNewStudentRow = () => {
    const defaultGender =
      settings.pairingType === 'female' ? 'female' : 'male';
    const newStudent = {
      number: manualStudents.length + 1,
      name: '',
      gender: defaultGender,
    };
    const updatedStudents = [...manualStudents, newStudent];
    setManualStudents(updatedStudents);
    handleStudentDataChange(updatedStudents);
  };

  const handleDeleteStudent = (index) => {
    const updatedStudents = manualStudents.filter((_, i) => i !== index);
    setManualStudents(updatedStudents);
    handleStudentDataChange(updatedStudents);
  };

  const handleBulkGenderChange = (gender) => {
    const updatedStudents = manualStudents.map((student) => ({ ...student, gender }));
    setManualStudents(updatedStudents);
    handleStudentDataChange(updatedStudents);
  };

  const handleClearAllStudents = () => {
    if (window.confirm('입력된 모든 학생 명단과 설정된 고려사항을 초기화하시겠습니까?')) {
      setManualStudents([]);
      onSettingsChange({
        studentCount: 0,
        maleCount: 0,
        femaleCount: 0,
        students: [],
        clearTeacherNotes: true,
      });
    }
  };

  const handleRowKeyDown = (e, index) => {
    if (e.key === 'Tab' && !e.shiftKey && index === manualStudents.length - 1) {
      e.preventDefault();
      addNewStudentRow();
    }
  };

  const handleStudentCountChange = (value) => {
    if (value === '') {
      onSettingsChange({ studentCount: '' });
      return;
    }

    const parsed = parseInt(value, 10);
    if (isNaN(parsed) || parsed < 0) {
      onSettingsChange({ studentCount: '' });
      return;
    }

    const newCount = Math.min(60, parsed);
    let targetMale = Math.ceil(newCount / 2);
    let targetFemale = newCount - targetMale;

    if (settings.seatArrangement === 'pair' && settings.pairingType === 'male') {
      targetMale = newCount;
      targetFemale = 0;
    } else if (settings.seatArrangement === 'pair' && settings.pairingType === 'female') {
      targetMale = 0;
      targetFemale = newCount;
    }

    // 기존에 이름이 입력된 학생이 있으면 보존하고 나머지 행 수를 맞춤
    let updatedStudents = [...manualStudents];
    if (updatedStudents.length > 0) {
      if (newCount > updatedStudents.length) {
        for (let i = updatedStudents.length; i < newCount; i++) {
          updatedStudents.push({
            number: i + 1,
            name: '',
            gender: i < targetMale ? 'male' : 'female',
          });
        }
      } else if (newCount < updatedStudents.length) {
        updatedStudents = updatedStudents.slice(0, newCount);
      }

      // 이름 없는 행들의 성별을 조정하여 성별 비율 맞춤
      const namedStudents = updatedStudents.filter((s) => s.name && s.name.trim() !== '');
      if (namedStudents.length === 0) {
        updatedStudents = updatedStudents.map((s, idx) => ({
          ...s,
          gender: idx < targetMale ? 'male' : 'female',
        }));
      } else {
        targetMale = updatedStudents.filter((s) => s.gender !== 'female').length;
        targetFemale = newCount - targetMale;
      }
      setManualStudents(updatedStudents);
      onSettingsChange({
        students: updatedStudents,
        studentCount: newCount,
        maleCount: targetMale,
        femaleCount: targetFemale,
      });
    } else {
      onSettingsChange({
        studentCount: newCount,
        maleCount: targetMale,
        femaleCount: targetFemale,
      });
    }
  };

  const handleGenderCountChange = (type, value) => {
    const totalCount = Number(settings.studentCount) || 0;
    const parsed = value === '' ? 0 : parseInt(value, 10);
    if (isNaN(parsed)) return;

    const clamped = Math.min(Math.max(0, parsed), totalCount);
    const newMaleCount = type === 'male' ? clamped : totalCount - clamped;
    const newFemaleCount = totalCount - newMaleCount;

    if (manualStudents.length === totalCount && totalCount > 0) {
      // 이름이 비어 있는 placeholder 행들의 성별을 동기화
      const updated = [...manualStudents];
      let currentMale = updated.filter((s) => s.gender !== 'female').length;
      if (currentMale > newMaleCount) {
        let diff = currentMale - newMaleCount;
        for (let i = updated.length - 1; i >= 0 && diff > 0; i--) {
          if ((!updated[i].name || !updated[i].name.trim()) && updated[i].gender !== 'female') {
            updated[i] = { ...updated[i], gender: 'female' };
            diff--;
          }
        }
      } else if (currentMale < newMaleCount) {
        let diff = newMaleCount - currentMale;
        for (let i = 0; i < updated.length && diff > 0; i++) {
          if ((!updated[i].name || !updated[i].name.trim()) && updated[i].gender === 'female') {
            updated[i] = { ...updated[i], gender: 'male' };
            diff--;
          }
        }
      }
      setManualStudents(updated);
      onSettingsChange({
        students: updated,
        maleCount: newMaleCount,
        femaleCount: newFemaleCount,
      });
      return;
    }

    onSettingsChange({
      maleCount: newMaleCount,
      femaleCount: newFemaleCount,
    });
  };

  const findColumn = (headers, keywords) => {
    for (let i = 0; i < headers.length; i++) {
      for (const keyword of keywords) {
        if (String(headers[i] || '').includes(keyword)) return i;
      }
    }
    return -1;
  };

  const handleFileUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadStatus({ type: 'info', message: '엑셀 파일을 읽는 중입니다...' });
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (jsonData.length < 2) {
          setUploadStatus({ type: 'error', message: '유효한 행 데이터가 부족합니다.' });
          return;
        }

        const headers = (jsonData[0] || []).map((h) => String(h || '').toLowerCase().trim());
        const gradeCol = findColumn(headers, ['학년', 'grade']);
        const classCol = findColumn(headers, ['반', 'class']);
        const studentNumberCol = findColumn(headers, ['학번', '번호', 'number', 'no']);
        const nameCol = findColumn(headers, ['성명', '이름', 'name', '학생명', '학생']);
        const genderCol = findColumn(headers, ['성별', 'gender', '남녀']);

        if (nameCol === -1) {
          setUploadStatus({
            type: 'error',
            message: '첫 행에서 이름(성명) 컬럼을 찾을 수 없습니다.',
          });
          return;
        }

        let newGrade = settings.grade;
        let newClassNumber = settings.classNumber;
        const newStudents = [];

        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.length === 0 || row[nameCol] === undefined || String(row[nameCol]).trim() === '') {
            continue;
          }

          if (newStudents.length === 0) {
            if (gradeCol !== -1 && row[gradeCol]) {
              newGrade = parseInt(row[gradeCol], 10) || settings.grade;
            }
            if (classCol !== -1 && row[classCol]) {
              newClassNumber = parseInt(row[classCol], 10) || settings.classNumber;
            }
          }

          let gender = 'male';
          if (genderCol !== -1 && row[genderCol] !== undefined) {
            const genderValue = String(row[genderCol]).toLowerCase().trim();
            if (genderValue.includes('여') || genderValue === 'f' || genderValue === 'female') {
              gender = 'female';
            }
          }

          const rawNumber =
            studentNumberCol !== -1 && row[studentNumberCol] !== undefined && String(row[studentNumberCol]).trim() !== ''
              ? String(row[studentNumberCol]).trim()
              : String(newStudents.length + 1);

          newStudents.push({
            number: rawNumber,
            name: String(row[nameCol]).trim(),
            gender,
          });
        }

        if (newStudents.length === 0) {
          setUploadStatus({ type: 'error', message: '불러올 수 있는 학생 데이터가 없습니다.' });
          return;
        }

        // 성별 컬럼이 없는 파일인데 현재 성별 구분 모드라면 안내와 함께 반영
        const hasGenderColumn = genderCol !== -1;
        setManualStudents(newStudents);
        setIsStudentTableCollapsed(false);
        handleStudentDataChange(newStudents, {
          grade: newGrade,
          classNumber: newClassNumber,
        });

        setUploadStatus({
          type: 'success',
          message: hasGenderColumn
            ? `${newStudents.length}명의 학생 명단을 불러왔습니다.`
            : `${newStudents.length}명의 학생 명단을 불러왔습니다. (성별 컬럼 없음 — 통합 랜덤 또는 성별 직접 지정 가능)`,
        });
        setTimeout(() => setUploadStatus(null), 4500);
      } catch (error) {
        setUploadStatus({ type: 'error', message: '파일을 처리하는 중 오류가 발생했습니다.' });
      }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
  };

  const handleDownloadSampleExcel = () => {
    const sampleRows = genderFree
      ? [
          ['학년', '반', '학번', '이름'],
          [settings.grade, settings.classNumber, 1, '김민준'],
          ['', '', 2, '이서연'],
          ['', '', 3, '박지호'],
          ['', '', 4, '최하은'],
        ]
      : [
          ['학년', '반', '학번', '이름', '성별'],
          [settings.grade, settings.classNumber, 1, '김민준', '남'],
          ['', '', 2, '이서연', '여'],
          ['', '', 3, '박지호', '남'],
          ['', '', 4, '최하은', '여'],
        ];

    const worksheet = XLSX.utils.aoa_to_sheet(sampleRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '학생명단');
    XLSX.writeFile(workbook, '학급자리배치_명단양식.xlsx');
  };

  return (
    <section id="section-settings" className="control-panel" aria-labelledby="settings-heading">
      {showExample && (
        <div className="example-modal" onClick={() => setShowExample(false)} role="dialog" aria-modal="true">
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="section-eyebrow">엑셀 업로드 가이드</p>
                <h3>엑셀 파일 작성 예시</h3>
              </div>
              <button type="button" className="btn-ghost" onClick={() => setShowExample(false)}>
                닫기
              </button>
            </div>
            <p className="modal-desc">
              첫 번째 행에 컬럼 제목을 적고 두 번째 행부터 학생 명단을 입력합니다.
              {genderFree
                ? ' 남녀 통합 랜덤 방식에서는 성별 컬럼을 생략할 수 있습니다.'
                : ' 학년과 반은 첫 번째 학생 행에만 입력해도 자동 인식됩니다.'}
            </p>
            <div className="sample-sheet-preview">
              <table>
                <thead>
                  <tr>
                    <th>학년</th>
                    <th>반</th>
                    <th>학번</th>
                    <th>이름</th>
                    {!genderFree && <th>성별</th>}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>1</td>
                    <td>1</td>
                    <td>1</td>
                    <td>김민준</td>
                    {!genderFree && <td>남</td>}
                  </tr>
                  <tr>
                    <td></td>
                    <td></td>
                    <td>2</td>
                    <td>이서연</td>
                    {!genderFree && <td>여</td>}
                  </tr>
                  <tr>
                    <td></td>
                    <td></td>
                    <td>3</td>
                    <td>박지호</td>
                    {!genderFree && <td>남</td>}
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-pill" onClick={handleDownloadSampleExcel}>
                예시 엑셀 파일(.xlsx) 다운로드
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="section-header-row">
        <div>
          <p className="section-eyebrow">01 · 학급 설정</p>
          <h2 id="settings-heading">학급 정보 및 배치 방식</h2>
        </div>
        <div className="summary-inline-meta">
          <span>
            {settings.grade}학년 {settings.classNumber}반
          </span>
          <span className="meta-dot">·</span>
          <span>
            총 {settings.studentCount || 0}명
            {genderFree
              ? ' (남녀 구분 없음)'
              : ` (남 ${settings.maleCount || 0}명, 여 ${settings.femaleCount || 0}명)`}
          </span>
          <span className="meta-dot">·</span>
          <span>{getArrangementModeLabel(settings)}</span>
        </div>
      </div>

      <div className="settings-grid-two-col">
        {/* 좌측: 자리 배치 방식 선택 카드 */}
        <div className="editorial-card">
          <div className="card-block">
            <div className="field-header">
              <span className="field-label">자리 배치 방식</span>
              <span className="field-hint">
                {genderFree
                  ? '성별 구분 없이 모든 학생을 하나로 합쳐 무작위 배치합니다'
                  : '책상 구성과 성별 규칙을 선택하세요'}
              </span>
            </div>
            <div className="pill-selector-row" role="radiogroup" aria-label="자리 배치 방식">
              <button
                type="button"
                role="radio"
                aria-checked={settings.seatArrangement === 'pair'}
                className={`btn-pill ${settings.seatArrangement === 'pair' ? 'active' : ''}`}
                onClick={() => handleModeChange('pair')}
              >
                짝
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={settings.seatArrangement === 'single'}
                className={`btn-pill ${settings.seatArrangement === 'single' ? 'active' : ''}`}
                onClick={() => handleModeChange('single')}
              >
                혼자
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={settings.seatArrangement === 'mixedRandom'}
                className={`btn-pill ${settings.seatArrangement === 'mixedRandom' ? 'active' : ''}`}
                onClick={() => handleModeChange('mixedRandom')}
              >
                남녀 합쳐서 랜덤
              </button>
            </div>
          </div>

          {settings.seatArrangement === 'pair' && (
            <div className="card-block sub-block">
              <div className="field-header">
                <span className="field-label">짝 구성 방식</span>
                <span className="field-hint">두 명씩 앉을 때의 성별 조합 기준</span>
              </div>
              <div className="pill-selector-row" role="radiogroup" aria-label="짝 구성 방식">
                <button
                  type="button"
                  role="radio"
                  aria-checked={settings.pairingType === 'mixed'}
                  className={`btn-pill ${settings.pairingType === 'mixed' ? 'active' : ''}`}
                  onClick={() => handlePairingTypeChange('mixed')}
                >
                  남녀 짝
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={settings.pairingType === 'samegender'}
                  className={`btn-pill ${settings.pairingType === 'samegender' ? 'active' : ''}`}
                  onClick={() => handlePairingTypeChange('samegender')}
                >
                  동성 짝
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={settings.pairingType === 'any'}
                  className={`btn-pill ${settings.pairingType === 'any' ? 'active' : ''}`}
                  onClick={() => handlePairingTypeChange('any')}
                >
                  성별 무관
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={settings.pairingType === 'male'}
                  className={`btn-pill ${settings.pairingType === 'male' ? 'active' : ''}`}
                  onClick={() => handlePairingTypeChange('male')}
                >
                  남학교
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={settings.pairingType === 'female'}
                  className={`btn-pill ${settings.pairingType === 'female' ? 'active' : ''}`}
                  onClick={() => handlePairingTypeChange('female')}
                >
                  여학교
                </button>
              </div>
            </div>
          )}

          {settings.seatArrangement === 'mixedRandom' && (
            <div className="card-block sub-block">
              <div className="field-header">
                <span className="field-label">기본 책상 배열</span>
                <span className="field-hint">아래 좌석 설계도에서 통로를 자유롭게 수정할 수 있습니다</span>
              </div>
              <div className="pill-selector-row" role="radiogroup" aria-label="기본 책상 배열">
                <button
                  type="button"
                  role="radio"
                  aria-checked={(settings.deskLayout || 'pair') === 'pair'}
                  className={`btn-pill ${(settings.deskLayout || 'pair') === 'pair' ? 'active' : ''}`}
                  onClick={() => handleInputChange('deskLayout', 'pair')}
                >
                  2열 짝 책상
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={settings.deskLayout === 'single'}
                  className={`btn-pill ${settings.deskLayout === 'single' ? 'active' : ''}`}
                  onClick={() => handleInputChange('deskLayout', 'single')}
                >
                  1열 개인 책상
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 우측: 엑셀 명단 업로드 카드 */}
        <div className="editorial-card">
          <div className="field-header">
            <span className="field-label">학생 명단 엑셀 업로드</span>
            <span className="field-hint">
              {genderFree
                ? '학년, 반, 학번, 이름 컬럼 지원 (성별 생략 가능)'
                : '학년, 반, 학번, 이름(성명), 성별 컬럼 자동 인식'}
            </span>
          </div>

          <div className="upload-box">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
            <div className="upload-actions">
              <button
                type="button"
                className="btn-pill"
                onClick={() => fileInputRef.current?.click()}
              >
                엑셀 파일 선택
              </button>
              <button type="button" className="btn-ghost muted" onClick={handleDownloadSampleExcel}>
                양식 다운로드
              </button>
              <button type="button" className="btn-ghost muted" onClick={() => setShowExample(true)}>
                작성 예시 보기
              </button>
            </div>
            {uploadStatus && (
              <p className={`upload-feedback ${uploadStatus.type}`}>{uploadStatus.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* 학급 인원 및 기본 정보 직접 입력 바 */}
      <div className="editorial-card class-metrics-card">
        <div className={`metrics-fields ${genderFree ? 'three-cols' : 'five-cols'}`}>
          <div className="metric-field">
            <label htmlFor="grade">학년</label>
            <select
              id="grade"
              className="select-pill"
              value={settings.grade}
              onChange={(e) => handleInputChange('grade', parseInt(e.target.value, 10))}
            >
              {[1, 2, 3, 4, 5, 6].map((grade) => (
                <option key={grade} value={grade}>
                  {grade}학년
                </option>
              ))}
            </select>
          </div>

          <div className="metric-field">
            <label htmlFor="classNumber">반</label>
            <select
              id="classNumber"
              className="select-pill"
              value={settings.classNumber}
              onChange={(e) => handleInputChange('classNumber', parseInt(e.target.value, 10))}
            >
              {Array.from({ length: 20 }, (_, i) => i + 1).map((num) => (
                <option key={num} value={num}>
                  {num}반
                </option>
              ))}
            </select>
          </div>

          <div className="metric-field">
            <label htmlFor="studentCount">총 학생 수</label>
            <input
              type="number"
              id="studentCount"
              className="input-pill"
              min="1"
              max="60"
              value={settings.studentCount === '' ? '' : settings.studentCount}
              onChange={(e) => handleStudentCountChange(e.target.value)}
              placeholder="인원 입력"
            />
          </div>

          {!genderFree && (
            <>
              <div className="metric-field">
                <label htmlFor="maleCount">남학생 수</label>
                <input
                  type="number"
                  id="maleCount"
                  className="input-pill"
                  min="0"
                  max={settings.studentCount || 60}
                  value={settings.maleCount === '' ? '' : settings.maleCount}
                  onChange={(e) => handleGenderCountChange('male', e.target.value)}
                  placeholder="남학생"
                />
              </div>

              <div className="metric-field">
                <label htmlFor="femaleCount">여학생 수</label>
                <input
                  type="number"
                  id="femaleCount"
                  className="input-pill"
                  min="0"
                  max={settings.studentCount || 60}
                  value={settings.femaleCount === '' ? '' : settings.femaleCount}
                  onChange={(e) => handleGenderCountChange('female', e.target.value)}
                  placeholder="여학생"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* 학생 명단 직접 입력 아코디언 카드 */}
      <div className="editorial-card roster-card">
        <div className="roster-header">
          <div className="roster-title-group">
            <span className="field-label">학생 명단 직접 입력</span>
            <span className="roster-count-badge">
              {manualStudents.length > 0
                ? `${manualStudents.length}명 등록됨`
                : '명단 미입력 시 번호 기준으로 자동 생성됩니다'}
            </span>
          </div>
          <div className="roster-actions">
            {manualStudents.length > 0 && (
              <button
                type="button"
                onClick={handleClearAllStudents}
                className="btn-ghost muted"
              >
                명단 초기화
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsStudentTableCollapsed(!isStudentTableCollapsed)}
              className="btn-pill"
            >
              {isStudentTableCollapsed ? '명단 펼치기' : '명단 접기'}
            </button>
          </div>
        </div>

        {!isStudentTableCollapsed && (
          <div className="student-table-container">
            <div className={`student-table-head ${genderFree ? 'gender-free' : ''}`}>
              <div>학번</div>
              <div>이름</div>
              {!genderFree && (
                <div className="gender-col-header">
                  <span>성별</span>
                  <div className="bulk-gender-pills">
                    <button
                      type="button"
                      className="mini-chip"
                      onClick={() => handleBulkGenderChange('male')}
                    >
                      전체 남
                    </button>
                    <button
                      type="button"
                      className="mini-chip"
                      onClick={() => handleBulkGenderChange('female')}
                    >
                      전체 여
                    </button>
                  </div>
                </div>
              )}
              <div className="col-action-label">관리</div>
            </div>

            <div className="student-table-rows">
              {manualStudents.map((student, index) => (
                <div
                  className={`student-row ${genderFree ? 'gender-free' : ''}`}
                  key={`stu-row-${index}`}
                >
                  <div>
                    <input
                      type="text"
                      className="input-pill compact"
                      value={student.number}
                      onChange={(e) => handleStudentRowChange(index, 'number', e.target.value)}
                      placeholder="번호"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      className="input-pill compact"
                      value={student.name}
                      onChange={(e) => handleStudentRowChange(index, 'name', e.target.value)}
                      onKeyDown={(e) => (genderFree ? handleRowKeyDown(e, index) : undefined)}
                      placeholder={`학생 이름 (${index + 1}번)`}
                    />
                  </div>
                  {!genderFree && (
                    <div>
                      <select
                        className="select-pill compact"
                        value={student.gender}
                        onChange={(e) => handleStudentRowChange(index, 'gender', e.target.value)}
                        onKeyDown={(e) => handleRowKeyDown(e, index)}
                      >
                        <option value="male">남</option>
                        <option value="female">여</option>
                      </select>
                    </div>
                  )}
                  <div className="row-delete-cell">
                    <button
                      type="button"
                      onClick={() => handleDeleteStudent(index)}
                      className="btn-ghost muted row-delete-btn"
                      aria-label={`${index + 1}번째 학생 삭제`}
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))}
              {manualStudents.length === 0 && (
                <p className="empty-roster-notice">
                  등록된 개별 명단이 없습니다. 아래 버튼으로 학생을 추가하거나 총 학생 수만 입력해
                  바로 배치할 수 있습니다.
                </p>
              )}
            </div>

            <div className="roster-footer">
              <button type="button" onClick={addNewStudentRow} className="btn-pill">
                + 학생 행 추가
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default ControlPanel;