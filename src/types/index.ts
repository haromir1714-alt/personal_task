export type Frequency = "daily" | "weekly" | "monthly";
export type Priority = "high" | "normal" | "low";
export type Theme = "system" | "light" | "dark";
export interface Fields {
  title: string;
  notes: string;
  due: string | null;
  startDate: string | null;
  priority: Priority;
  categoryId: string | null;
}
export interface Task extends Fields {
  generation: string;
  id: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  order: number;
  version: number;
  groupId: string | null;
  sequence: number;
  nextId: string | null;
  successorCreated: boolean;
  groupRevision: number;
}
export interface Group {
  id: string;
  frequency: Frequency;
  anchor: string;
  active: boolean;
  revision: number;
  fields: Fields;
}
export interface Category {
  generation: string;
  id: string;
  name: string;
  color: string;
  version: number;
}
export interface Setting {
  id: "theme";
  value: Theme;
}
export interface Backup {
  formatVersion: 2;
  createdAt: string;
  tasks: Task[];
  categories: Category[];
  groups: Group[];
  settings: Setting[];
}
