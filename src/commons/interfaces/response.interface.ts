export interface ResponseRequestInterface {
  success?: boolean;
  data: any;
  message?: string;
  error?: boolean;
}

export interface PaginationResponseInterface {
  data: any;
  totalPages?: number;
  totalItems: number;
}
