
export interface Candidate {
  id: number;
  names: string;
  order_num: number;
}

export interface AssignmentConfig {
  id: number;
  current_index: number;
}

export interface AssignmentResult {
  assignedNames: string[];
  startIndex: number;
  endIndex: number;
  previousIndex: number; // 취소를 위해 배정 전 인덱스 저장
}
