
export interface Candidate {
  id: number;
  name: string;
  order_num: number;
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
