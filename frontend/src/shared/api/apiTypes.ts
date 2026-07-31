export interface ApiFieldError {
  field: string;
  message: string;
}

export interface ApiSuccess<T> {
  data: T;
  message: string;
  success: true;
}

export interface ApiFailure {
  code: string;
  errors: readonly ApiFieldError[];
  message: string;
  success: false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isApiFieldError(value: unknown): value is ApiFieldError {
  return (
    isRecord(value) &&
    typeof value.field === 'string' &&
    typeof value.message === 'string'
  );
}

export function isApiSuccess(value: unknown): value is ApiSuccess<unknown> {
  return (
    isRecord(value) &&
    value.success === true &&
    typeof value.message === 'string' &&
    Object.prototype.hasOwnProperty.call(value, 'data')
  );
}

export function isApiFailure(value: unknown): value is ApiFailure {
  return (
    isRecord(value) &&
    value.success === false &&
    typeof value.code === 'string' &&
    typeof value.message === 'string' &&
    Array.isArray(value.errors) &&
    value.errors.every(isApiFieldError) &&
    !Object.prototype.hasOwnProperty.call(value, 'data')
  );
}
