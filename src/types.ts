export interface Submission {
  id: string;
  event_seq: number;
  qq_id: string;
  nickname: string;
  content: string;
  received_at: string;
  hidden_at: string | null;
}
export interface Snapshot {
  event: {
    id: string;
    name: string;
    accepting: boolean;
    starts_at: string | null;
    ends_at: string | null;
  };
  display: {
    mode: "auto" | "manual";
    paused: boolean;
    blanked: boolean;
    current_submission_id: string | null;
    interval_seconds: number;
    next_switch_at: number;
    revision: number;
  };
  current: Submission | null;
  counts: { visible: number; hidden?: number; total?: number };
  event_cursor: string;
}
export interface Session {
  role: "host" | "screen";
  event_id: string;
  csrf_token: string;
}
