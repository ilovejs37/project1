
export interface Candidate {
  id: number;
  names: string; // 'name'에서 'names'로 변경 (DB 컬럼명 일치)
  created_index: number;
  department: string;
}

export interface AssignmentConfig {
  id: number;
  current_index: number;
}

export interface AssignmentResult {
  assignedNames: string[];
  startIndex: number;
  endIndex: number;
}
