import { NextResponse } from "next/server";

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export function successResponse<T>(data: T, status = 200): NextResponse {
  const body: ApiSuccessResponse<T> = {
    success: true,
    data,
  };
  return NextResponse.json(body, { status });
}

export function errorResponse(
  code: string,
  message: string,
  status = 400,
  details?: unknown
): NextResponse {
  const body: ApiErrorResponse = {
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined && { details }),
    },
  };
  return NextResponse.json(body, { status });
}

export function paginatedResponse<T>(
  data: T[],
  page: number,
  pageSize: number,
  totalCount: number
): NextResponse {
  const totalPages = Math.ceil(totalCount / pageSize);
  const body: PaginatedResponse<T> = {
    success: true,
    data,
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages,
      hasMore: page < totalPages,
    },
  };
  return NextResponse.json(body, { status: 200 });
}
