export interface AppError {
  message: string;
  code?: string;
  statusCode?: number;
  originalError?: any;
}

export class ErrorHandler {
  static parse(error: any): AppError {
    // Se já é um AppError, retornar como está
    if (error && typeof error === 'object' && 'message' in error && 'code' in error) {
      return error as AppError;
    }

    // Erro do Supabase
    if (error?.error?.message) {
      return {
        message: error.error.message,
        code: error.code || error.error.code,
        statusCode: error.status,
        originalError: error,
      };
    }

    // Erro de resposta HTTP
    if (error?.message && error?.status) {
      return {
        message: error.message,
        statusCode: error.status,
        originalError: error,
      };
    }

    // Erro padrão de JavaScript
    if (error instanceof Error) {
      return {
        message: error.message,
        code: 'UNKNOWN_ERROR',
        originalError: error,
      };
    }

    // String como erro
    if (typeof error === 'string') {
      return {
        message: error,
        code: 'UNKNOWN_ERROR',
      };
    }

    // Fallback
    return {
      message: 'Ocorreu um erro desconhecido',
      code: 'UNKNOWN_ERROR',
      originalError: error,
    };
  }

  static getErrorMessage(error: any): string {
    const appError = this.parse(error);
    return appError.message || 'Erro desconhecido. Tente novamente.';
  }

  static getErrorCode(error: any): string {
    const appError = this.parse(error);
    return appError.code || 'UNKNOWN_ERROR';
  }

  static isNetworkError(error: any): boolean {
    const appError = this.parse(error);
    return appError.statusCode === 0 || error?.message?.includes('network');
  }

  static isAuthError(error: any): boolean {
    const appError = this.parse(error);
    return appError.statusCode === 401 || appError.code === 'PGRST301';
  }

  static isNotFoundError(error: any): boolean {
    const appError = this.parse(error);
    return appError.statusCode === 404 || appError.code === 'PGRST116';
  }

  static isConflictError(error: any): boolean {
    const appError = this.parse(error);
    return appError.statusCode === 409 || appError.code === 'PGRST119';
  }

  static log(error: any, context?: string): void {
    const appError = this.parse(error);
    const logMessage = `[${context || 'ERROR'}] ${appError.message}`;
    
    if (import.meta.env.DEV) {
      console.error(logMessage, appError.originalError);
    }
    
    // Aqui você pode adicionar um serviço de logging remoto
    // Example: logToSentry(logMessage, appError);
  }
}

export function createErrorMessage(error: any): string {
  const appError = ErrorHandler.parse(error);
  
  if (ErrorHandler.isNetworkError(appError)) {
    return 'Erro de conexão. Verifique sua internet.';
  }
  
  if (ErrorHandler.isAuthError(appError)) {
    return 'Acesso negado. Faça login novamente.';
  }
  
  if (ErrorHandler.isNotFoundError(appError)) {
    return 'Recurso não encontrado.';
  }
  
  if (ErrorHandler.isConflictError(appError)) {
    return 'Conflito de dados. Recarregue e tente novamente.';
  }
  
  return appError.message || 'Ocorreu um erro. Tente novamente.';
}
