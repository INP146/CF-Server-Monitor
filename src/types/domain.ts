export type DataRecord = Record<string, unknown>;

export interface ServerRecord extends DataRecord {
  id: string;
  name: string;
  server_group?: string;
  region?: string;
  tags?: string;
  note?: string;
  price?: string;
  billing_cycle?: string;
  auto_renewal?: string | number | boolean;
  currency?: string;
  expire_date?: string;
  history_partition_id?: string | number | null;
  timestamp?: string | number | null;
  is_hidden?: string | number;
  offline_notify_disabled?: string | number;
}

export interface MetricRecord extends DataRecord {
  timestamp: number;
}

export interface MetricSample {
  ts: number;
  metrics: DataRecord;
}

export interface BroadcastSample {
  ts: number;
  payload: DataRecord;
}

export function isRecord(value: unknown): value is DataRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
