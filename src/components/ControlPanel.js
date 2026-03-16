import React, { useRef, useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import './ControlPanel.css';

const ControlPanel = ({ settings, onSettingsChange, students }) => {
  const exampleImageSrc = process.env.PUBLIC_URL
    ? `${process.env.PUBLIC_URL}/example.png`
    : '/example.png';
  const fileInputRef = useRef(null);
  const [uploadStatus, setUploadStatus] = useState('');
  const [showExample, setShowExample] = useState(false);
  const [isStudentTableCollapsed, setIsStudentTableCollapsed] = useState(true);
  const [manualStudents, setManualStudents] = useState([]);

  useEffect(() => {
    setManualStudents(students || []);
  }, [students]);

  const handleInputChange = (field, value) => {
    onSettingsChange({ [field]: value });
  };

  const handleStudentDataChange = (updatedStudents) => {
    const maleCount = updatedStudents.filter(s => s.gender === 'male').length;
    const femaleCount = updatedStudents.filter(s => s.gender === 'female').length;
    onSettingsChange({
      students: updatedStudents,
      studentCount: updatedStudents.length,
      maleCount,
      femaleCount,
    });
  };

  const handleStudentRowChange = (index, field, value) => {
    const updatedStudents = [...manualStudents];
    updatedStudents[index] = { ...updatedStudents[index], [field]: value };
    setManualStudents(updatedStudents);
    handleStudentDataChange(updatedStudents);
  };

  const addNewStudentRow = () => {
    const newStudent = { number: manualStudents.length + 1, name: '', gender: 'male' };
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
    const updatedStudents = manualStudents.map(student => ({ ...student, gender }));
    setManualStudents(updatedStudents);
    handleStudentDataChange(updatedStudents);
  };

  const handleClearAllStudents = () => {
    if (window.confirm('모든 학생 정보를 삭제하시겠습니까?')) {
      setManualStudents([]);
      handleStudentDataChange([]);
      // 학생 수도 초기화
      onSettingsChange({
        studentCount: '',
        maleCount: '',
        femaleCount: '',
        students: []
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
    // 빈 문자열일 때는 그대로 유지 (최소값 강제 적용 안함)
    if (value === '') {
      onSettingsChange({ studentCount: '' });
      return;
    }
    
    const newCount = parseInt(value);
    
    if (isNaN(newCount) || newCount < 1) {
      // 유효하지 않은 값이면 빈 문자열로 설정
      onSettingsChange({ studentCount: '' });
      return;
    }
    
    const currentCount = manualStudents.length;
    let updatedStudents = [...manualStudents];

    if (newCount > currentCount) {
      for (let i = currentCount; i < newCount; i++) {
        updatedStudents.push({ number: i + 1, name: '', gender: 'male' });
      }
    } else if (newCount < currentCount) {
      updatedStudents = updatedStudents.slice(0, newCount);
    }

    setManualStudents(updatedStudents);
    handleStudentDataChange(updatedStudents);
    
    // 학생 수가 변경되면 남녀 반반으로 기본 설정
    const maleCount = Math.ceil(newCount / 2);
    const femaleCount = newCount - maleCount;
    onSettingsChange({
      studentCount: newCount,
      maleCount,
      femaleCount
    });
  };

  const handleGenderCountChange = (type, value) => {
    // 빈 문자열일 때는 0으로 처리하되, 입력 중일 때는 그대로 유지
    const newValue = value === '' ? 0 : parseInt(value);
    const totalCount = settings.studentCount;
    
    if (isNaN(newValue)) return; // 숫자가 아닌 경우 무시
    
    if (type === 'male') {
      const newMaleCount = Math.min(Math.max(0, newValue), totalCount);
      const newFemaleCount = totalCount - newMaleCount;
      onSettingsChange({
        maleCount: newMaleCount,
        femaleCount: newFemaleCount
      });
    } else {
      const newFemaleCount = Math.min(Math.max(0, newValue), totalCount);
      const newMaleCount = totalCount - newFemaleCount;
      onSettingsChange({
        maleCount: newMaleCount,
        femaleCount: newFemaleCount
      });
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setUploadStatus('파일을 읽는 중...');
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (jsonData.length < 2) {
          setUploadStatus('❌ 데이터가 부족합니다.');
          return;
        }

        const headers = jsonData[0].map(h => String(h).toLowerCase().trim());
        const gradeCol = findColumn(headers, ['학년', 'grade']);
        const classCol = findColumn(headers, ['반', 'class']);
        const studentNumberCol = findColumn(headers, ['학번', 'number', 'no', '번호']);
        const nameCol = findColumn(headers, ['성명', '이름', 'name', '학생명']);
        const genderCol = findColumn(headers, ['성별', 'gender', '남녀']);

        if (nameCol === -1) {
          setUploadStatus('❌ 이름 컬럼을 찾을 수 없습니다.');
          return;
        }

        let newGrade = settings.grade;
        let newClassNumber = settings.classNumber;
        const newStudents = [];

        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.length === 0 || !row[nameCol]) continue;

          if (i === 1) {
            if (gradeCol !== -1 && row[gradeCol]) newGrade = parseInt(row[gradeCol]) || settings.grade;
            if (classCol !== -1 && row[classCol]) newClassNumber = parseInt(row[classCol]) || settings.classNumber;
          }

          let gender = 'male'; // Default to male if not specified
          if (genderCol !== -1 && row[genderCol]) {
            const genderValue = String(row[genderCol]).toLowerCase().trim();
            if (genderValue.includes('여') || genderValue === 'f') gender = 'female';
          }
          newStudents.push({ number: studentNumberCol !== -1 ? row[studentNumberCol] : i, name: String(row[nameCol]).trim(), gender });
        }

        if (newStudents.length === 0) {
          setUploadStatus('❌ 유효한 학생 데이터를 찾을 수 없습니다.');
          return;
        }

        handleStudentDataChange(newStudents);
        onSettingsChange({ grade: newGrade, classNumber: newClassNumber });

        setUploadStatus(`✅ ${newStudents.length}명의 학생 정보를 불러왔습니다!`);
        setTimeout(() => setUploadStatus(''), 3000);

      } catch (error) {
        setUploadStatus('❌ 파일 처리 중 오류가 발생했습니다.');
      }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
  };

  const findColumn = (headers, keywords) => {
    for (let i = 0; i < headers.length; i++) {
      for (const keyword of keywords) {
        if (String(headers[i]).includes(keyword)) return i;
      }
    }
    return -1;
  };

  const handleUploadClick = () => fileInputRef.current?.click();

  return (
    <div className="control-panel">
      {showExample && (
        <div className="example-modal" onClick={() => setShowExample(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <span className="close-btn" onClick={() => setShowExample(false)}>&times;</span>
            <h4>엑셀 작성 예시</h4>
            <p>첫 행에 컬럼명을 입력하고, 그 아래로 학생 정보를 입력해주세요. (학년, 반, 학번, 성명, 성별)</p>
            <img src={exampleImageSrc} alt="Excel example" style={{ width: '100%', marginTop: '1rem' }} />
          </div>
        </div>
      )}

      <div className="panel-header">
        <h2>📋 교실 설정</h2>
        <p>학급 정보를 입력하고 자리배치 옵션을 선택하세요</p>
      </div>

      <div className="horizontal-layout">
        <div className="file-upload-wrapper">
          <div className="file-upload-section">
            <div className="upload-header">
              <h4>📁 학생 명단 업로드</h4>
              <p>엑셀 파일로 학생 정보를 한번에 입력하세요</p>
            </div>
            <div className="upload-area">
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileUpload} style={{ display: 'none' }} />
              <button className="upload-btn" onClick={handleUploadClick}>
                <span className="upload-icon">📤</span>
                엑셀 파일 선택
              </button>
              <div className="upload-info">
                <small>학년, 반, 학번, 성명(이름), 성별 컬럼이 포함된 엑셀 파일</small>
                <button className="example-btn" onClick={() => setShowExample(true)}>예시 보기</button>
              </div>
              {uploadStatus && <div className={`upload-status ${uploadStatus.includes('✅') ? 'success' : 'error'}`}>{uploadStatus}</div>}
            </div>
            
            <div className="or-divider">
              <span>또는 아래에 직접 입력하셔도 됩니다</span>
            </div>
          </div>
        </div>

        <div className="arrangement-section">
          <div className="form-group">
            <label>자리 배치 방식</label>
            <div className="radio-group horizontal">
              <label className="radio-option"><input type="radio" name="seatArrangement" value="pair" checked={settings.seatArrangement === 'pair'} onChange={(e) => handleInputChange('seatArrangement', e.target.value)} /><span className="radio-label"><span className="radio-icon">👥</span>짝</span></label>
              <label className="radio-option"><input type="radio" name="seatArrangement" value="single" checked={settings.seatArrangement === 'single'} onChange={(e) => handleInputChange('seatArrangement', e.target.value)} /><span className="radio-label"><span className="radio-icon">🧑‍🎓</span>혼자</span></label>
            </div>
          </div>
          {settings.seatArrangement === 'pair' && (
            <div className="form-group">
              <label>짝 구성 방식</label>
              <div className="radio-group horizontal">
                <label className="radio-option"><input type="radio" name="pairingType" value="mixed" checked={settings.pairingType === 'mixed'} onChange={(e) => handleInputChange('pairingType', e.target.value)} /><span className="radio-label"><span className="radio-icon">👫</span>남녀</span></label>
                <label className="radio-option"><input type="radio" name="pairingType" value="samegender" checked={settings.pairingType === 'samegender'} onChange={(e) => handleInputChange('pairingType', e.target.value)} /><span className="radio-label"><span className="radio-icon">👥</span>성별</span></label>
                <label className="radio-option"><input type="radio" name="pairingType" value="male" checked={settings.pairingType === 'male'} onChange={(e) => handleInputChange('pairingType', e.target.value)} /><span className="radio-label"><span className="radio-icon">🏫</span>남학교</span></label>
                <label className="radio-option"><input type="radio" name="pairingType" value="female" checked={settings.pairingType === 'female'} onChange={(e) => handleInputChange('pairingType', e.target.value)} /><span className="radio-label"><span className="radio-icon">🏫</span>여학교</span></label>
              </div>
            </div>
          )}
        </div>

        <div className="summary-section">
          <div className="summary-card">
            <h3>📊 설정 요약</h3>
            <div className="summary-content">
              <p><strong>{settings.grade}학년 {settings.classNumber}반</strong></p>
              <p>총 {settings.studentCount}명 (남 {settings.maleCount}명, 여 {settings.femaleCount}명)</p>
              <p>배치: {settings.seatArrangement === 'pair' ? '짝' : '혼자'}{settings.seatArrangement === 'pair' && ` - ${settings.pairingType === 'mixed' ? '남녀' : settings.pairingType === 'samegender' ? '성별' : settings.pairingType === 'male' ? '남학교' : '여학교'}`}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="divider"><span>직접 입력</span></div>

      <div className="direct-input-section">
        <div className="class-info-group">
            <div className="form-group compact">
              <label htmlFor="grade">학년</label>
              <select id="grade" value={settings.grade} onChange={(e) => handleInputChange('grade', parseInt(e.target.value))}>
                {[1, 2, 3, 4, 5, 6].map(grade => <option key={grade} value={grade}>{grade}학년</option>)}
              </select>
            </div>
            <div className="form-group compact">
              <label htmlFor="classNumber">반</label>
              <select id="classNumber" value={settings.classNumber} onChange={(e) => handleInputChange('classNumber', parseInt(e.target.value))}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => <option key={num} value={num}>{num}반</option>)}
              </select>
            </div>
            <div className="form-group compact">
              <label htmlFor="studentCount">학생 수</label>
              <input 
                type="number" 
                id="studentCount" 
                max="50" 
                value={settings.studentCount || ''} 
                onChange={(e) => handleStudentCountChange(e.target.value)} 
                placeholder="학생 수를 입력하세요"
              />
            </div>
            <div className="form-group compact">
              <label htmlFor="maleCount">남학생</label>
              <input 
                type="number" 
                id="maleCount" 
                max={settings.studentCount} 
                value={settings.maleCount || ''} 
                onChange={(e) => handleGenderCountChange('male', e.target.value)} 
                placeholder="남학생 수"
              />
            </div>
            <div className="form-group compact">
              <label htmlFor="femaleCount">여학생</label>
              <input 
                type="number" 
                id="femaleCount" 
                max={settings.studentCount} 
                value={settings.femaleCount || ''} 
                onChange={(e) => handleGenderCountChange('female', e.target.value)} 
                placeholder="여학생 수"
              />
            </div>
        </div>
      </div>

      <div className="manual-student-entry-section">
        <div className="manual-entry-header">
          <h4>✍️ 학생 명단 직접 입력</h4>
          <div className="manual-entry-controls">
            <button onClick={handleClearAllStudents} className="clear-all-btn" title="모든 학생 정보 삭제">
              🗑️ 전체 삭제
            </button>
            <button onClick={() => setIsStudentTableCollapsed(!isStudentTableCollapsed)} className="collapse-btn">
              {isStudentTableCollapsed ? '펴기' : '접기'}
            </button>
          </div>
        </div>
        {!isStudentTableCollapsed && (
          <div className="student-table">
            <div className="student-table-header">
              <div className="table-cell id">학번</div>
              <div className="table-cell name">이름</div>
              <div className="table-cell gender">
                성별
                <div className="bulk-gender-controls">
                  <button onClick={() => handleBulkGenderChange('male')} title="전체 남학생으로 설정">남</button>
                  <button onClick={() => handleBulkGenderChange('female')} title="전체 여학생으로 설정">여</button>
                </div>
              </div>
              <div className="table-cell action"></div>
            </div>
            <div className="student-table-body">
              {manualStudents.map((student, index) => (
                <div className="student-table-row" key={index}>
                  <div className="table-cell id">
                    <input type="text" value={student.number} onChange={(e) => handleStudentRowChange(index, 'number', e.target.value)} />
                  </div>
                  <div className="table-cell name">
                    <input type="text" value={student.name} onChange={(e) => handleStudentRowChange(index, 'name', e.target.value)} />
                  </div>
                  <div className="table-cell gender">
                    <select value={student.gender} onChange={(e) => handleStudentRowChange(index, 'gender', e.target.value)} onKeyDown={(e) => handleRowKeyDown(e, index)}>
                      <option value="male">남</option>
                      <option value="female">여</option>
                    </select>
                  </div>
                  <div className="table-cell action">
                    <button onClick={() => handleDeleteStudent(index)} className="delete-row-btn" title="행 삭제">×</button>
                  </div>
                </div>
              ))}
            </div>
             <button onClick={addNewStudentRow} className="add-row-btn">+ 새 학생 추가</button>
          </div>
        )}
      </div>

    </div>
  );
};

export default ControlPanel;
