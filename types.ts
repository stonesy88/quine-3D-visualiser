export interface GraphNode {
  id: string;
  x: number;
  y: number;
  z: number;
  val: number; // size
  group: number | string;
  color?: string;
}

export interface GraphLink {
  source: string;
  target: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export enum GestureState {
  IDLE = 'IDLE',
  DETECTING = 'DETECTING',
  ACTIVE = 'ACTIVE'
}

export interface ControlState {
  expansion: number; // 0 to 1
  tension: number;   // 0 to 1 (fist)
}