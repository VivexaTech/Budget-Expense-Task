export interface VercelRequest {
  method?: string;
  headers: Record<string, any>;
  body: any;
  query: Record<string, any>;
}

export interface VercelResponse {
  status: (statusCode: number) => VercelResponse;
  json: (body: any) => void;
  send?: (body: any) => void;
  end?: (body?: any) => void;
}
