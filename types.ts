
export interface Candidate {
  id: number;
  name: string;
}

export interface SelectionState {
  candidates: Candidate[];
  currentIndex: number;
}
