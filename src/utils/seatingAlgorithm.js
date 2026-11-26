// 교실 자리배치 핵심 알고리즘 및 유틸리티

export const shuffleArray = (array = []) => {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

export const isGenderFreeMode = (settings = {}) => {
  if (settings.seatArrangement === 'mixedRandom') return true;
  if (settings.seatArrangement === 'pair' && settings.pairingType === 'any') return true;
  return false;
};

export const getEffectiveDeskLayout = (settings = {}) => {
  if (settings.seatArrangement === 'single') return 'single';
  if (settings.seatArrangement === 'mixedRandom') {
    return settings.deskLayout === 'single' ? 'single' : 'pair';
  }
  return 'pair';
};

export const getArrangementModeLabel = (settings = {}) => {
  if (settings.seatArrangement === 'mixedRandom') {
    const deskLabel = settings.deskLayout === 'single' ? '1열 단독형' : '2열 짝형';
    return `남녀 통합 랜덤 (${deskLabel})`;
  }
  if (settings.seatArrangement === 'single') {
    return '혼자 앉기';
  }
  const pairingLabels = {
    mixed: '남녀 짝',
    samegender: '동성 짝',
    any: '성별 무관',
    male: '남학교',
    female: '여학교',
  };
  const sub = pairingLabels[settings.pairingType] || '남녀 짝';
  return `짝 앉기 · ${sub}`;
};

export const buildCanonicalStudentPool = (settings = {}, students = []) => {
  const genderFree = isGenderFreeMode(settings);
  const rawList = Array.isArray(students) ? students : [];

  if (genderFree) {
    const targetCount = Math.max(0, Number(settings.studentCount) || rawList.length || 0);
    const pool = [];
    for (let i = 0; i < targetCount; i++) {
      const src = rawList[i];
      const numberStr =
        src && src.number !== undefined && String(src.number).trim() !== ''
          ? String(src.number).trim()
          : String(i + 1);
      const rawName = src && src.name ? String(src.name).trim() : '';
      const displayName = rawName || `${numberStr}번`;
      pool.push({
        uid: `stu-${i}`,
        index: i,
        number: numberStr,
        rawName,
        name: displayName,
        gender: 'any',
      });
    }
    return pool;
  }

  // 성별 구분이 필요한 모드
  const totalTarget = Math.max(0, Number(settings.studentCount) || 0);
  let maleTarget = Math.max(0, Number(settings.maleCount) || 0);
  let femaleTarget = Math.max(0, Number(settings.femaleCount) || 0);

  if (settings.seatArrangement === 'pair' && settings.pairingType === 'male') {
    maleTarget = totalTarget;
    femaleTarget = 0;
  } else if (settings.seatArrangement === 'pair' && settings.pairingType === 'female') {
    maleTarget = 0;
    femaleTarget = totalTarget;
  } else if (maleTarget + femaleTarget !== totalTarget && totalTarget > 0) {
    maleTarget = Math.ceil(totalTarget / 2);
    femaleTarget = totalTarget - maleTarget;
  }

  if (rawList.length === 0) {
    const pool = [];
    for (let i = 1; i <= maleTarget; i++) {
      pool.push({
        uid: `stu-m-${i}`,
        index: pool.length,
        number: `남${i}`,
        rawName: `남학생 ${i}`,
        name: `남학생 ${i}`,
        gender: 'male',
      });
    }
    for (let i = 1; i <= femaleTarget; i++) {
      pool.push({
        uid: `stu-f-${i}`,
        index: pool.length,
        number: `여${i}`,
        rawName: `여학생 ${i}`,
        name: `여학생 ${i}`,
        gender: 'female',
      });
    }
    return pool;
  }

  // 학생 명단이 있는 경우: 이름이 입력된 학생 성별은 그대로 존중하고, 빈 행/부족분은 목표 성별 인원에 맞춤
  const sliced = rawList.slice(0, totalTarget || rawList.length);
  const normalized = sliced.map((s, idx) => {
    const numberStr =
      s && s.number !== undefined && String(s.number).trim() !== ''
        ? String(s.number).trim()
        : String(idx + 1);
    const rawName = s && s.name ? String(s.name).trim() : '';
    let gender = s?.gender === 'female' ? 'female' : s?.gender === 'male' ? 'male' : null;
    if (!gender) {
      if (numberStr.startsWith('F') || numberStr.startsWith('여')) gender = 'female';
      else gender = 'male';
    }
    return {
      uid: `stu-${idx}`,
      index: idx,
      number: numberStr,
      rawName,
      name: rawName || `${numberStr}번`,
      gender,
      isPlaceholder: rawName === '',
    };
  });

  while (normalized.length < totalTarget) {
    const idx = normalized.length;
    const numberStr = String(idx + 1);
    normalized.push({
      uid: `stu-${idx}`,
      index: idx,
      number: numberStr,
      rawName: '',
      name: `${numberStr}번`,
      gender: 'male',
      isPlaceholder: true,
    });
  }

  // 이름 없는 placeholder 행들의 성별을 조정하여 maleTarget / femaleTarget 비율과 일치시킴
  let currentMale = normalized.filter((s) => s.gender === 'male').length;
  if (currentMale > maleTarget) {
    let needFlip = currentMale - maleTarget;
    for (let i = normalized.length - 1; i >= 0 && needFlip > 0; i--) {
      if (normalized[i].isPlaceholder && normalized[i].gender === 'male') {
        normalized[i].gender = 'female';
        needFlip--;
      }
    }
  } else if (currentMale < maleTarget) {
    let needFlip = maleTarget - currentMale;
    for (let i = 0; i < normalized.length && needFlip > 0; i++) {
      if (normalized[i].isPlaceholder && normalized[i].gender === 'female') {
        normalized[i].gender = 'male';
        needFlip--;
      }
    }
  }

  return normalized;
};

export const formatStudentOptionLabel = (student) => {
  if (!student) return '';
  if (student.rawName && student.rawName !== `${student.number}번`) {
    return `${student.number}번 ${student.rawName}`;
  }
  return student.name;
};

export const matchStudentQuery = (query, pool = [], excludeUid = null) => {
  const q = String(query || '').trim();
  if (!q) return null;
  const qLower = q.toLowerCase();
  const qCompact = qLower.replace(/\s+/g, '');

  const candidates = excludeUid ? pool.filter((s) => s.uid !== excludeUid) : pool;

  // 1. uid 직접 일치
  let found = candidates.find((s) => s.uid === q);
  if (found) return found;

  // 2. "학번번 이름" / "학번 이름" / "이름(학번)" 일치
  found = candidates.find((s) => {
    if (!s.rawName) return false;
    const forms = [
      `${s.number}번 ${s.rawName}`,
      `${s.number} ${s.rawName}`,
      `${s.rawName}(${s.number})`,
      `${s.rawName} (${s.number})`,
      `${s.rawName}(${s.number}번)`,
    ].map((f) => f.toLowerCase());
    return forms.includes(qLower) || forms.some((f) => f.replace(/\s+/g, '') === qCompact);
  });
  if (found) return found;

  // 3. 이름 정확히 일치
  found = candidates.find(
    (s) =>
      (s.rawName && s.rawName.toLowerCase() === qLower) ||
      (s.name && s.name.toLowerCase() === qLower)
  );
  if (found) return found;

  // 4. 공백 제거 이름 일치
  found = candidates.find(
    (s) =>
      (s.rawName && s.rawName.toLowerCase().replace(/\s+/g, '') === qCompact) ||
      (s.name && s.name.toLowerCase().replace(/\s+/g, '') === qCompact)
  );
  if (found) return found;

  // 5. 학번 일치 ("3" 또는 "3번")
  const strippedNum = qLower.endsWith('번') ? qLower.slice(0, -1).trim() : qLower;
  found = candidates.find((s) => String(s.number).trim().toLowerCase() === strippedNum);
  if (found) return found;

  return null;
};

export const resolveTeacherNotes = (teacherNotes = {}, pool = []) => {
  const warnings = [];
  const togetherPairs = [];
  const separatePairs = [];
  const considerationsByUid = new Map();

  (teacherNotes.togetherStudents || []).forEach((item) => {
    const q1 = String(item?.students?.[0] || '').trim();
    const q2 = String(item?.students?.[1] || '').trim();
    if (!q1 && !q2) return;
    if (!q1 || !q2) {
      warnings.push(`붙여 앉을 학생 항목에 두 학생을 모두 입력해주세요. (${q1 || q2})`);
      return;
    }
    const s1 = matchStudentQuery(q1, pool);
    const s2 = matchStudentQuery(q2, pool, s1?.uid);
    if (!s1) {
      warnings.push(`붙여 앉을 학생 '${q1}'을(를) 명단에서 찾을 수 없습니다.`);
      return;
    }
    if (!s2) {
      warnings.push(`붙여 앉을 학생 '${q2}'을(를) 명단에서 찾을 수 없습니다.`);
      return;
    }
    if (s1.uid === s2.uid) {
      warnings.push(`붙여 앉을 학생에 동일한 학생(${s1.name})이 중복 지정되었습니다.`);
      return;
    }
    const exists = togetherPairs.some(
      (p) =>
        (p[0] === s1.uid && p[1] === s2.uid) || (p[0] === s2.uid && p[1] === s1.uid)
    );
    if (!exists) {
      togetherPairs.push([s1.uid, s2.uid]);
    }
  });

  (teacherNotes.separateStudents || []).forEach((item) => {
    const q1 = String(item?.students?.[0] || '').trim();
    const q2 = String(item?.students?.[1] || '').trim();
    if (!q1 && !q2) return;
    if (!q1 || !q2) {
      warnings.push(`떨어뜨릴 학생 항목에 두 학생을 모두 입력해주세요. (${q1 || q2})`);
      return;
    }
    const s1 = matchStudentQuery(q1, pool);
    const s2 = matchStudentQuery(q2, pool, s1?.uid);
    if (!s1) {
      warnings.push(`떨어뜨릴 학생 '${q1}'을(를) 명단에서 찾을 수 없습니다.`);
      return;
    }
    if (!s2) {
      warnings.push(`떨어뜨릴 학생 '${q2}'을(를) 명단에서 찾을 수 없습니다.`);
      return;
    }
    if (s1.uid === s2.uid) return;

    const conflictsWithTogether = togetherPairs.some(
      (p) =>
        (p[0] === s1.uid && p[1] === s2.uid) || (p[0] === s2.uid && p[1] === s1.uid)
    );
    if (conflictsWithTogether) {
      warnings.push(
        `${s1.name} 학생과 ${s2.name} 학생이 '붙여 앉기'와 '떨어뜨리기'에 동시에 지정되어 붙여 앉기를 우선 적용합니다.`
      );
      return;
    }

    const exists = separatePairs.some(
      (p) =>
        (p[0] === s1.uid && p[1] === s2.uid) || (p[0] === s2.uid && p[1] === s1.uid)
    );
    if (!exists) {
      separatePairs.push([s1.uid, s2.uid]);
    }
  });

  (teacherNotes.considerationStudents || []).forEach((item) => {
    const q = String(item?.student || '').trim();
    const pos = item?.position || 'front';
    if (!q) return;
    const s = matchStudentQuery(q, pool);
    if (!s) {
      warnings.push(`배려할 학생 '${q}'을(를) 명단에서 찾을 수 없습니다.`);
      return;
    }
    if (!considerationsByUid.has(s.uid)) {
      considerationsByUid.set(s.uid, new Set());
    }
    considerationsByUid.get(s.uid).add(pos);
  });

  return {
    togetherPairs,
    separatePairs,
    considerationsByUid,
    warnings,
  };
};

// 좌석 구역 판별 헬퍼 (실제 활성화된 좌석 기준)
const buildZoneTester = (availableSeats, considerationsByUid) => {
  const occupiedRows = Array.from(new Set(availableSeats.map((s) => s.r))).sort((a, b) => a - b);
  const occupiedCols = Array.from(new Set(availableSeats.map((s) => s.c))).sort((a, b) => a - b);

  // 각 구역에 배정되어야 하는 학생 수 파악하여 최소 필요 행/열 폭 계산
  let frontDemand = 0;
  let backDemand = 0;
  considerationsByUid.forEach((positions) => {
    if (positions.has('front')) frontDemand++;
    if (positions.has('back')) backDemand++;
  });

  // 교탁은 아래쪽(큰 row index), 교실 뒤는 위쪽(작은 row index)
  const rowsFromFront = [...occupiedRows].reverse();
  const rowsFromBack = [...occupiedRows];

  const countSeatsInRows = (rowSet) =>
    availableSeats.filter((s) => rowSet.has(s.r)).length;

  const frontStrictRows = new Set();
  for (const r of rowsFromFront) {
    frontStrictRows.add(r);
    if (countSeatsInRows(frontStrictRows) >= Math.max(1, frontDemand)) break;
  }
  // 맨 앞줄 좌석이 1개뿐이면 바로 뒷줄도 1차 후보에 포함 (붙여 앉기 등 대응)
  if (countSeatsInRows(frontStrictRows) <= 1 && rowsFromFront.length > 1) {
    frontStrictRows.add(rowsFromFront[1]);
  }

  const frontExpandedRows = new Set(frontStrictRows);
  if (rowsFromFront.length > frontStrictRows.size) {
    frontExpandedRows.add(rowsFromFront[frontStrictRows.size]);
  }

  const backStrictRows = new Set();
  for (const r of rowsFromBack) {
    backStrictRows.add(r);
    if (countSeatsInRows(backStrictRows) >= Math.max(1, backDemand)) break;
  }
  if (countSeatsInRows(backStrictRows) <= 1 && rowsFromBack.length > 1) {
    backStrictRows.add(rowsFromBack[1]);
  }

  const backExpandedRows = new Set(backStrictRows);
  if (rowsFromBack.length > backStrictRows.size) {
    backExpandedRows.add(rowsFromBack[backStrictRows.size]);
  }

  const colCount = occupiedCols.length;
  const leftStrictCount = Math.max(1, Math.floor(colCount / 2));
  const leftExpandedCount = Math.max(1, Math.ceil(colCount / 2));
  const leftStrictCols = new Set(occupiedCols.slice(0, leftStrictCount));
  const leftExpandedCols = new Set(occupiedCols.slice(0, leftExpandedCount));

  const rightStrictStart = Math.min(colCount - 1, Math.ceil(colCount / 2));
  const rightExpandedStart = Math.max(0, Math.floor(colCount / 2));
  const rightStrictCols = new Set(occupiedCols.slice(rightStrictStart));
  const rightExpandedCols = new Set(occupiedCols.slice(rightExpandedStart));

  const evaluatePosition = (seat, pos) => {
    if (pos === 'front') {
      if (frontStrictRows.has(seat.r)) return 2; // 1순위 정확 일치
      if (frontExpandedRows.has(seat.r)) return 1; // 2순위 인접 줄
      return 0;
    }
    if (pos === 'back') {
      if (backStrictRows.has(seat.r)) return 2;
      if (backExpandedRows.has(seat.r)) return 1;
      return 0;
    }
    if (pos === 'left') {
      if (leftStrictCols.has(seat.c)) return 2;
      if (leftExpandedCols.has(seat.c)) return 1;
      return 0;
    }
    if (pos === 'right') {
      if (rightStrictCols.has(seat.c)) return 2;
      if (rightExpandedCols.has(seat.c)) return 1;
      return 0;
    }
    return 2;
  };

  const scoreSeatForStudent = (uid, seat) => {
    const positions = considerationsByUid.get(uid);
    if (!positions || positions.size === 0) return { satisfied: true, tierScore: 0, missed: 0 };

    let tierScore = 0;
    let missed = 0;
    positions.forEach((pos) => {
      const level = evaluatePosition(seat, pos);
      if (level === 2) tierScore += 1000;
      else if (level === 1) tierScore += 720;
      else missed += 1;
    });

    return {
      satisfied: missed === 0,
      tierScore,
      missed,
    };
  };

  return { scoreSeatForStudent, evaluatePosition };
};

export const generateSeatingArrangement = ({
  seatGrid,
  verticalAisles,
  settings,
  students,
  teacherNotes,
}) => {
  const aisleSet =
    verticalAisles instanceof Set
      ? verticalAisles
      : new Set(Array.isArray(verticalAisles) ? verticalAisles : []);
  const genderFree = isGenderFreeMode(settings);
  const pool = buildCanonicalStudentPool(settings, students);
  const studentByUid = new Map(pool.map((s) => [s.uid, s]));

  const {
    togetherPairs,
    separatePairs,
    considerationsByUid,
    warnings,
  } = resolveTeacherNotes(teacherNotes, pool);

  const availableSeats = [];
  seatGrid.forEach((row, r) => {
    row.forEach((seat, c) => {
      if (seat.occupied) {
        availableSeats.push({
          r,
          c,
          templateType: genderFree ? 'any' : seat.studentType || 'any',
        });
      }
    });
  });

  const rows = seatGrid.length;
  const cols = seatGrid[0]?.length || 0;
  const { scoreSeatForStudent } = buildZoneTester(availableSeats, considerationsByUid);

  // 분리 대상 인접 리스트 생성
  const separateMap = new Map();
  separatePairs.forEach(([u1, u2]) => {
    if (!separateMap.has(u1)) separateMap.set(u1, new Set());
    if (!separateMap.has(u2)) separateMap.set(u2, new Set());
    separateMap.get(u1).add(u2);
    separateMap.get(u2).add(u1);
  });

  const areSeparated = (u1, u2) => separateMap.get(u1)?.has(u2) || false;

  const hasAisleBetween = (c1, c2) => {
    const minC = Math.min(c1, c2);
    const maxC = Math.max(c1, c2);
    for (let c = minC; c < maxC; c++) {
      if (aisleSet.has(c)) return true;
    }
    return false;
  };

  // 통로 없는 실제 짝 좌석 목록과 통로 포함 인접 좌석 목록
  const hasAnyAisleFreePair = availableSeats.some((s) =>
    availableSeats.some((o) => o.r === s.r && o.c === s.c + 1 && !hasAisleBetween(s.c, s.c + 1))
  );

  // 단일 시도 실행 함수
  const runSingleAttempt = () => {
    const placementGrid = Array.from({ length: rows }, () => Array(cols).fill(null));
    const seatByKey = new Map(availableSeats.map((s) => [`${s.r},${s.c}`, s]));
    const placedLocationByUid = new Map();
    const unplacedUids = new Set(pool.map((s) => s.uid));

    const assign = (uid, seat) => {
      placementGrid[seat.r][seat.c] = uid;
      seatByKey.delete(`${seat.r},${seat.c}`);
      placedLocationByUid.set(uid, { r: seat.r, c: seat.c });
      unplacedUids.delete(uid);
    };

    const isSeatFree = (r, c) => seatByKey.has(`${r},${c}`);
    const getFreeSeats = () => Array.from(seatByKey.values());

    const checkSeparationAt = (uid, r, c) => {
      const enemies = separateMap.get(uid);
      if (!enemies || enemies.size === 0) return { ok: true, minDist: 99 };

      let minDist = 99;
      for (const enemyUid of enemies) {
        const loc = placedLocationByUid.get(enemyUid);
        if (!loc) continue;
        const chebyshev = Math.max(Math.abs(loc.r - r), Math.abs(loc.c - c));
        if (chebyshev <= 1) {
          return { ok: false, minDist: chebyshev };
        }
        if (chebyshev < minDist) minDist = chebyshev;
      }
      return { ok: true, minDist };
    };

    const matchesGenderTemplate = (student, seat) => {
      if (genderFree) return true;
      if (!seat.templateType || seat.templateType === 'any') return true;
      return seat.templateType === student.gender;
    };

    // 1단계: 붙여 앉을 학생들 (최우선 반영 + 해당 학생의 배려 위치 및 분리 조건 동시 만족)
    // 연결된 그룹(체인 포함) 처리하되 무작위 순서로 섞어 매번 다양한 자리 생성
    const shuffledTogether = shuffleArray(togetherPairs);
    for (const [u1, u2] of shuffledTogether) {
      const s1 = studentByUid.get(u1);
      const s2 = studentByUid.get(u2);
      if (!s1 || !s2) continue;

      // 둘 다 아직 배치되지 않은 일반 쌍
      if (unplacedUids.has(u1) && unplacedUids.has(u2)) {
        const candidates = [];
        const freeList = getFreeSeats();

        for (const seatA of freeList) {
          // 오른쪽 인접 좌석 탐색
          const seatB = seatByKey.get(`${seatA.r},${seatA.c + 1}`);
          if (seatB) {
            const aisleBetween = hasAisleBetween(seatA.c, seatB.c);
            const orders = [
              [s1, seatA, s2, seatB],
              [s2, seatA, s1, seatB],
            ];
            for (const [stuLeft, stLeft, stuRight, stRight] of orders) {
              const sep1 = checkSeparationAt(stuLeft.uid, stLeft.r, stLeft.c);
              const sep2 = checkSeparationAt(stuRight.uid, stRight.r, stRight.c);
              if (!sep1.ok || !sep2.ok) continue;

              const z1 = scoreSeatForStudent(stuLeft.uid, stLeft);
              const z2 = scoreSeatForStudent(stuRight.uid, stRight);
              const genderBonus =
                (matchesGenderTemplate(stuLeft, stLeft) ? 45 : 0) +
                (matchesGenderTemplate(stuRight, stRight) ? 45 : 0);
              const aislePenalty = aisleBetween ? (hasAnyAisleFreePair ? -4000 : -100) : 500;
              const distBonus = Math.min(sep1.minDist, sep2.minDist, 4) * 8;

              candidates.push({
                stuLeft,
                stLeft,
                stuRight,
                stRight,
                score:
                  aislePenalty +
                  z1.tierScore +
                  z2.tierScore -
                  (z1.missed + z2.missed) * 2500 +
                  genderBonus +
                  distBonus +
                  Math.random() * 25,
              });
            }
          }

          // 통로 없는 가로 짝이 아예 없는 레이아웃(1열 시험 대형 등)일 때 앞뒤 인접도 후보로 추가
          if (!hasAnyAisleFreePair) {
            const seatBelow = seatByKey.get(`${seatA.r + 1},${seatA.c}`);
            if (seatBelow) {
              const orders = [
                [s1, seatA, s2, seatBelow],
                [s2, seatA, s1, seatBelow],
              ];
              for (const [stuTop, stTop, stuBot, stBot] of orders) {
                const sep1 = checkSeparationAt(stuTop.uid, stTop.r, stTop.c);
                const sep2 = checkSeparationAt(stuBot.uid, stBot.r, stBot.c);
                if (!sep1.ok || !sep2.ok) continue;
                const z1 = scoreSeatForStudent(stuTop.uid, stTop);
                const z2 = scoreSeatForStudent(stuBot.uid, stBot);
                candidates.push({
                  stuLeft: stuTop,
                  stLeft: stTop,
                  stuRight: stuBot,
                  stRight: stBot,
                  score:
                    -200 +
                    z1.tierScore +
                    z2.tierScore -
                    (z1.missed + z2.missed) * 2500 +
                    Math.random() * 25,
                });
              }
            }
          }
        }

        if (candidates.length > 0) {
          candidates.sort((a, b) => b.score - a.score);
          const best = candidates[0];
          assign(best.stuLeft.uid, best.stLeft);
          assign(best.stuRight.uid, best.stRight);
        }
      } else if (placedLocationByUid.has(u1) && unplacedUids.has(u2)) {
        // 체인 케이스: u1이 이미 배치된 경우 u1 바로 옆 빈자리에 u2 배치
        const loc1 = placedLocationByUid.get(u1);
        const adjOffsets = [
          [0, 1],
          [0, -1],
          [1, 0],
          [-1, 0],
        ];
        const adjCandidates = [];
        for (const [dr, dc] of adjOffsets) {
          const seat = seatByKey.get(`${loc1.r + dr},${loc1.c + dc}`);
          if (!seat) continue;
          const sep = checkSeparationAt(u2, seat.r, seat.c);
          if (!sep.ok) continue;
          const aisleBetween = dr === 0 && hasAisleBetween(loc1.c, seat.c);
          const z = scoreSeatForStudent(u2, seat);
          adjCandidates.push({
            seat,
            score:
              (dr === 0 && !aisleBetween ? 500 : dr === 0 ? 100 : 50) +
              z.tierScore -
              z.missed * 2500 +
              Math.random() * 20,
          });
        }
        if (adjCandidates.length > 0) {
          adjCandidates.sort((a, b) => b.score - a.score);
          assign(u2, adjCandidates[0].seat);
        }
      } else if (placedLocationByUid.has(u2) && unplacedUids.has(u1)) {
        const loc2 = placedLocationByUid.get(u2);
        const adjOffsets = [
          [0, 1],
          [0, -1],
          [1, 0],
          [-1, 0],
        ];
        const adjCandidates = [];
        for (const [dr, dc] of adjOffsets) {
          const seat = seatByKey.get(`${loc2.r + dr},${loc2.c + dc}`);
          if (!seat) continue;
          const sep = checkSeparationAt(u1, seat.r, seat.c);
          if (!sep.ok) continue;
          const aisleBetween = dr === 0 && hasAisleBetween(loc2.c, seat.c);
          const z = scoreSeatForStudent(u1, seat);
          adjCandidates.push({
            seat,
            score:
              (dr === 0 && !aisleBetween ? 500 : dr === 0 ? 100 : 50) +
              z.tierScore -
              z.missed * 2500 +
              Math.random() * 20,
          });
        }
        if (adjCandidates.length > 0) {
          adjCandidates.sort((a, b) => b.score - a.score);
          assign(u1, adjCandidates[0].seat);
        }
      }
    }

    // 2단계: 배려할 학생들 배치 (제약 조건이 많은 학생 우선)
    const remainingConsiderationUids = shuffleArray(
      Array.from(considerationsByUid.keys()).filter((uid) => unplacedUids.has(uid))
    ).sort((a, b) => {
      const sizeDiff = (considerationsByUid.get(b)?.size || 0) - (considerationsByUid.get(a)?.size || 0);
      if (sizeDiff !== 0) return sizeDiff;
      return (separateMap.get(b)?.size || 0) - (separateMap.get(a)?.size || 0);
    });

    for (const uid of remainingConsiderationUids) {
      const student = studentByUid.get(uid);
      if (!student || !unplacedUids.has(uid)) continue;

      const candidates = [];
      for (const seat of getFreeSeats()) {
        const sep = checkSeparationAt(uid, seat.r, seat.c);
        if (!sep.ok) continue;

        const z = scoreSeatForStudent(uid, seat);
        const genderBonus = matchesGenderTemplate(student, seat) ? 60 : 0;
        const distBonus = Math.min(sep.minDist, 4) * 8;

        candidates.push({
          seat,
          score: z.tierScore - z.missed * 3000 + genderBonus + distBonus + Math.random() * 25,
        });
      }

      if (candidates.length > 0) {
        candidates.sort((a, b) => b.score - a.score);
        assign(uid, candidates[0].seat);
      }
    }

    // 3단계: 떨어뜨릴 학생들 중 아직 배치되지 않은 학생을 우선 배치하여 구석에 몰리는 현상 방지
    const remainingSeparateUids = shuffleArray(
      Array.from(separateMap.keys()).filter((uid) => unplacedUids.has(uid))
    ).sort((a, b) => (separateMap.get(b)?.size || 0) - (separateMap.get(a)?.size || 0));

    for (const uid of remainingSeparateUids) {
      const student = studentByUid.get(uid);
      if (!student || !unplacedUids.has(uid)) continue;

      const candidates = [];
      for (const seat of getFreeSeats()) {
        const sep = checkSeparationAt(uid, seat.r, seat.c);
        if (!sep.ok) continue;

        // 짝 모드일 때 옆자리에 이미 앉은 학생과의 성별 짝 규칙 조화 점수 계산
        let pairHarmony = 0;
        if (!genderFree && settings.seatArrangement === 'pair') {
          const leftNeighborCol = !hasAisleBetween(seat.c - 1, seat.c) ? seat.c - 1 : null;
          const rightNeighborCol = !hasAisleBetween(seat.c, seat.c + 1) ? seat.c + 1 : null;
          const partnerCol = leftNeighborCol !== null && placementGrid[seat.r]?.[leftNeighborCol]
            ? leftNeighborCol
            : rightNeighborCol !== null && placementGrid[seat.r]?.[rightNeighborCol]
            ? rightNeighborCol
            : null;
          if (partnerCol !== null) {
            const partner = studentByUid.get(placementGrid[seat.r][partnerCol]);
            if (partner) {
              if (settings.pairingType === 'mixed' && partner.gender !== student.gender) pairHarmony = 70;
              if (settings.pairingType === 'samegender' && partner.gender === student.gender) pairHarmony = 70;
            }
          }
        }

        const genderBonus = matchesGenderTemplate(student, seat) ? 80 : 0;
        const distBonus = Math.min(sep.minDist, 5) * 15;
        candidates.push({
          seat,
          score: genderBonus + pairHarmony + distBonus + Math.random() * 30,
        });
      }

      if (candidates.length > 0) {
        candidates.sort((a, b) => b.score - a.score);
        assign(uid, candidates[0].seat);
      }
    }

    // 4단계: 남은 학생들 짝 규칙 및 랜덤 배치
    if (!genderFree && settings.seatArrangement === 'pair') {
      // 비어있는 짝 좌석들 먼저 처리
      const emptyPairs = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols - 1; c++) {
          if (isSeatFree(r, c) && isSeatFree(r, c + 1) && !hasAisleBetween(c, c + 1)) {
            emptyPairs.push([seatByKey.get(`${r},${c}`), seatByKey.get(`${r},${c + 1}`)]);
            c++; // 짝으로 묶었으므로 다음 열 건너뜀
          }
        }
      }

      for (const [seat1, seat2] of shuffleArray(emptyPairs)) {
        if (!isSeatFree(seat1.r, seat1.c) || !isSeatFree(seat2.r, seat2.c)) continue;
        const remainingStudents = shuffleArray(
          Array.from(unplacedUids).map((id) => studentByUid.get(id))
        );
        if (remainingStudents.length < 2) break;

        let bestPair = null;
        let bestPairScore = -Infinity;

        // 가능한 학생 2명 조합 중 템플릿 및 짝 구성 규칙에 가장 잘 맞는 쌍 선택
        const sampleLimit = Math.min(remainingStudents.length, 18);
        for (let i = 0; i < sampleLimit; i++) {
          for (let j = i + 1; j < sampleLimit; j++) {
            const stuA = remainingStudents[i];
            const stuB = remainingStudents[j];
            if (areSeparated(stuA.uid, stuB.uid)) continue;

            const orders = [
              [stuA, stuB],
              [stuB, stuA],
            ];
            for (const [first, second] of orders) {
              if (!checkSeparationAt(first.uid, seat1.r, seat1.c).ok) continue;
              if (!checkSeparationAt(second.uid, seat2.r, seat2.c).ok) continue;

              let score = Math.random() * 10;
              if (matchesGenderTemplate(first, seat1)) score += 60;
              if (matchesGenderTemplate(second, seat2)) score += 60;

              if (settings.pairingType === 'mixed') {
                score += first.gender !== second.gender ? 100 : 10;
              } else if (settings.pairingType === 'samegender') {
                score += first.gender === second.gender ? 100 : 5;
              }

              if (score > bestPairScore) {
                bestPairScore = score;
                bestPair = [first, second];
              }
            }
          }
        }

        if (bestPair) {
          assign(bestPair[0].uid, seat1);
          assign(bestPair[1].uid, seat2);
        }
      }
    }

    // 5단계: 남은 모든 학생들을 남은 좌석에 배치 (100% 전원 배치 보장)
    const restUids = shuffleArray(Array.from(unplacedUids));
    for (const uid of restUids) {
      const student = studentByUid.get(uid);
      const freeSeats = shuffleArray(getFreeSeats());
      if (freeSeats.length === 0) break;

      let chosenSeat = null;
      let chosenScore = -Infinity;

      for (const seat of freeSeats) {
        const sep = checkSeparationAt(uid, seat.r, seat.c);
        let score = Math.random() * 10;
        if (sep.ok) score += 5000;
        if (matchesGenderTemplate(student, seat)) score += 120;

        // 짝 좌석의 파트너가 이미 앉아 있는 경우 짝 구성 방식 점수 반영
        if (!genderFree && settings.seatArrangement === 'pair') {
          for (const dc of [-1, 1]) {
            const nc = seat.c + dc;
            if (nc >= 0 && nc < cols && !hasAisleBetween(seat.c, nc) && placementGrid[seat.r][nc]) {
              const partner = studentByUid.get(placementGrid[seat.r][nc]);
              if (partner) {
                if (settings.pairingType === 'mixed' && partner.gender !== student.gender) score += 90;
                if (settings.pairingType === 'samegender' && partner.gender === student.gender) score += 90;
              }
            }
          }
        }

        if (score > chosenScore) {
          chosenScore = score;
          chosenSeat = seat;
        }
      }

      if (chosenSeat) {
        assign(uid, chosenSeat);
      }
    }

    // 제약조건 위반 점수 평가 (0점이면 완벽 만족)
    let penalty = 0;

    // 미배치 학생 페널티
    penalty += unplacedUids.size * 50000;

    // 붙여 앉기 검사
    for (const [u1, u2] of togetherPairs) {
      const loc1 = placedLocationByUid.get(u1);
      const loc2 = placedLocationByUid.get(u2);
      if (!loc1 || !loc2) {
        penalty += 20000;
        continue;
      }
      const sameRowAdj = loc1.r === loc2.r && Math.abs(loc1.c - loc2.c) === 1;
      const sameColAdj = loc1.c === loc2.c && Math.abs(loc1.r - loc2.r) === 1;
      if (sameRowAdj) {
        if (hasAisleBetween(loc1.c, loc2.c) && hasAnyAisleFreePair) {
          penalty += 2000;
        }
      } else if (sameColAdj && !hasAnyAisleFreePair) {
        penalty += 50;
      } else {
        penalty += 15000;
      }
    }

    // 떨어뜨리기 검사 (8방향 인접 금지)
    for (const [u1, u2] of separatePairs) {
      const loc1 = placedLocationByUid.get(u1);
      const loc2 = placedLocationByUid.get(u2);
      if (!loc1 || !loc2) continue;
      const chebyshev = Math.max(Math.abs(loc1.r - loc2.r), Math.abs(loc1.c - loc2.c));
      if (chebyshev <= 1) {
        penalty += 15000;
      }
    }

    // 배려 위치 검사
    considerationsByUid.forEach((_, uid) => {
      const loc = placedLocationByUid.get(uid);
      if (!loc) {
        penalty += 10000;
        return;
      }
      const z = scoreSeatForStudent(uid, loc);
      if (!z.satisfied) {
        penalty += z.missed * 8000;
      } else if (z.tierScore < (considerationsByUid.get(uid)?.size || 1) * 1000) {
        penalty += 80; // 2순위 줄에 배치된 경우 미세 페널티 (1순위 줄을 선호하도록 유도)
      }
    });

    // 성별 짝 규칙 위반 미세 페널티
    if (!genderFree && settings.seatArrangement === 'pair') {
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols - 1; c++) {
          if (!hasAisleBetween(c, c + 1) && placementGrid[r][c] && placementGrid[r][c + 1]) {
            const sA = studentByUid.get(placementGrid[r][c]);
            const sB = studentByUid.get(placementGrid[r][c + 1]);
            if (sA && sB) {
              if (settings.pairingType === 'mixed' && sA.gender === sB.gender) penalty += 25;
              if (settings.pairingType === 'samegender' && sA.gender !== sB.gender) penalty += 40;
            }
            c++;
          }
        }
      }
    }

    return { placementGrid, placedLocationByUid, penalty };
  };

  let bestAttempt = null;
  const maxAttempts = 180;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = runSingleAttempt();
    if (!bestAttempt || res.penalty < bestAttempt.penalty) {
      bestAttempt = res;
      if (res.penalty === 0) break;
    }
  }

  // 최종 그리드 조립
  const finalGrid = seatGrid.map((row, r) =>
    row.map((seat, c) => {
      if (!seat.occupied) {
        return {
          ...seat,
          occupied: false,
          studentName: null,
          studentId: null,
          studentType: null,
        };
      }
      const uid = bestAttempt?.placementGrid?.[r]?.[c];
      const student = uid ? studentByUid.get(uid) : null;
      return {
        ...seat,
        occupied: true,
        studentUid: student?.uid || null,
        studentName: student ? student.name : null,
        studentRawName: student ? student.rawName : null,
        studentId: student ? student.number : null,
        studentType: genderFree ? 'any' : student?.gender || seat.studentType || 'any',
      };
    })
  );

  // 만약 물리적으로 만족 불가능한 조건이 있었다면 안내 추가
  const runtimeNotes = [...warnings];
  if (bestAttempt && bestAttempt.penalty >= 8000) {
    runtimeNotes.push(
      '지정된 좌석 수나 구역에 비해 제약 조건이 많아 일부 조건은 가장 가까운 대안 좌석으로 배치되었습니다.'
    );
  }

  return {
    grid: finalGrid,
    gridSize: { rows, cols },
    verticalAisles: Array.from(aisleSet),
    students: pool.map((s) => ({
      number: s.number,
      name: s.name,
      rawName: s.rawName,
      gender: s.gender,
    })),
    settings: { ...settings },
    warnings: runtimeNotes,
    arrangedAt: new Date().toISOString(),
  };
};
