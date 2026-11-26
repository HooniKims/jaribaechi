import {
  generateSeatingArrangement,
  isGenderFreeMode,
} from './utils/seatingAlgorithm';

const makePairGrid = (rows, cols, genderMode = 'mixed') =>
  Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => {
      if (genderMode === 'any') {
        return { occupied: true, studentType: 'any' };
      }
      return {
        occupied: true,
        studentType: (r + c) % 2 === 0 ? 'male' : 'female',
      };
    })
  );

const findStudentPosition = (grid, nameOrId) => {
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const cell = grid[r][c];
      if (cell.occupied && (cell.studentName === nameOrId || cell.studentId === nameOrId)) {
        return { r, c };
      }
    }
  }
  return null;
};

describe('seatingAlgorithm', () => {
  test('supports gender-free mixedRandom mode without requiring gender data', () => {
    const settings = {
      grade: 2,
      classNumber: 3,
      studentCount: 12,
      seatArrangement: 'mixedRandom',
      deskLayout: 'pair',
    };
    expect(isGenderFreeMode(settings)).toBe(true);

    const students = Array.from({ length: 12 }, (_, i) => ({
      number: i + 1,
      name: `학생${i + 1}`,
    }));

    const result = generateSeatingArrangement({
      seatGrid: makePairGrid(2, 6, 'any'),
      verticalAisles: new Set([1, 3]),
      settings,
      students,
      teacherNotes: {
        togetherStudents: [{ id: 1, students: ['학생1', '학생2'] }],
        separateStudents: [{ id: 2, students: ['학생3', '학생4'] }],
        considerationStudents: [{ id: 3, student: '5', position: 'front' }],
      },
    });

    const placedNames = result.grid
      .flat()
      .filter((s) => s.occupied && s.studentName)
      .map((s) => s.studentName);
    expect(placedNames).toHaveLength(12);
    expect(new Set(placedNames).size).toBe(12);

    const pos1 = findStudentPosition(result.grid, '학생1');
    const pos2 = findStudentPosition(result.grid, '학생2');
    expect(pos1.r).toBe(pos2.r);
    expect(Math.abs(pos1.c - pos2.c)).toBe(1);
    expect([1, 3]).not.toContain(Math.min(pos1.c, pos2.c));

    const pos3 = findStudentPosition(result.grid, '학생3');
    const pos4 = findStudentPosition(result.grid, '학생4');
    const chebyshev = Math.max(Math.abs(pos3.r - pos4.r), Math.abs(pos3.c - pos4.c));
    expect(chebyshev).toBeGreaterThan(1);

    // 학번 '5'로 지정한 학생5가 앞줄(row = 1)에 배치되었는지 검증
    const pos5 = findStudentPosition(result.grid, '학생5');
    expect(pos5.r).toBe(1);
  });

  test('honors togetherStudents + front consideration simultaneously even for same-gender pair in mixed mode', () => {
    const settings = {
      grade: 1,
      classNumber: 1,
      studentCount: 12,
      maleCount: 6,
      femaleCount: 6,
      seatArrangement: 'pair',
      pairingType: 'mixed',
    };

    const students = [
      { number: 1, name: '김철수', gender: 'male' },
      { number: 2, name: '박영수', gender: 'male' },
      { number: 3, name: '이민호', gender: 'male' },
      { number: 4, name: '정우성', gender: 'male' },
      { number: 5, name: '최강민', gender: 'male' },
      { number: 6, name: '강동원', gender: 'male' },
      { number: 7, name: '김영희', gender: 'female' },
      { number: 8, name: '이수진', gender: 'female' },
      { number: 9, name: '박지현', gender: 'female' },
      { number: 10, name: '최유리', gender: 'female' },
      { number: 11, name: '한소희', gender: 'female' },
      { number: 12, name: '송혜교', gender: 'female' },
    ];

    // 맨 아래 행(row=2)이 비어 있는 그리드에서도 실제 활성 앞줄(row=1)을 정확히 인식해야 함
    const gridWithEmptyBottomRow = [
      ...makePairGrid(2, 6, 'mixed'),
      Array.from({ length: 6 }, () => ({ occupied: false, studentType: null })),
    ];

    const result = generateSeatingArrangement({
      seatGrid: gridWithEmptyBottomRow,
      verticalAisles: new Set([1, 3]),
      settings,
      students,
      teacherNotes: {
        togetherStudents: [{ id: 1, students: [' 김철수 ', '박영수'] }],
        separateStudents: [{ id: 2, students: ['김철수', '김영희'] }],
        considerationStudents: [{ id: 3, student: '김철수', position: 'front' }],
      },
    });

    const placed = result.grid.flat().filter((s) => s.occupied && s.studentName);
    expect(placed).toHaveLength(12);

    const posA = findStudentPosition(result.grid, '김철수');
    const posB = findStudentPosition(result.grid, '박영수');
    expect(posA.r).toBe(1);
    expect(posB.r).toBe(1);
    expect(Math.abs(posA.c - posB.c)).toBe(1);
    expect([1, 3]).not.toContain(Math.min(posA.c, posB.c));

    const posEnemy = findStudentPosition(result.grid, '김영희');
    expect(
      Math.max(Math.abs(posA.r - posEnemy.r), Math.abs(posA.c - posEnemy.c))
    ).toBeGreaterThan(1);
  });
});
