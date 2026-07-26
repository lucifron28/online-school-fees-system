export interface HealthApiResponse {
  status: 'ok' | 'error';
  service: string;
  timestamp?: string;
}
