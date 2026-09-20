export const TASK_KEYS = ["chat", "today", "wall"] as const;

export type TaskKey = (typeof TASK_KEYS)[number];

export const TASK_LABELS: Record<TaskKey, string> = {
  chat: "CHAT",
  today: "TODAY",
  wall: "WALL",
};

export function isTaskKey(value: string): value is TaskKey {
  return (TASK_KEYS as readonly string[]).includes(value);
}
