export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    details?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const message = id
      ? `${resource} with id '${id}' not found`
      : `${resource} not found`;
    super(message, 404, "NOT_FOUND");
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, "VALIDATION_ERROR", details);
  }
}

export class AuthError extends AppError {
  constructor(message = "Authentication required") {
    super(message, 401, "UNAUTHORIZED");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Insufficient permissions") {
    super(message, 403, "FORBIDDEN");
  }
}

export class EmailNotVerifiedError extends AppError {
  constructor() {
    super(
      "You must verify your email address before performing this action. Check your inbox for the verification link.",
      403,
      "EMAIL_NOT_VERIFIED"
    );
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, "CONFLICT");
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfterMs?: number) {
    super("Rate limit exceeded", 429, "RATE_LIMIT_EXCEEDED", {
      retryAfterMs,
    });
  }
}

export class DisputeWindowClosedError extends AppError {
  constructor(message: string) {
    super(message, 409, "DISPUTE_WINDOW_CLOSED");
  }
}

/**
 * Funding-shortfall errors expose integrator-safe messages through AppError.
 * Sensitive cents-precision context stays off `details`, because standard API
 * handlers serialize `details` into HTTP responses when it is defined.
 */
export interface BudgetExhaustedContext {
  deficitCents: number;
  headroomCents: number;
  budgetCents: number;
}

export class BudgetExhaustedError extends AppError {
  public readonly fundingContext: BudgetExhaustedContext;

  constructor(context: BudgetExhaustedContext) {
    super("Campaign budget exhausted", 400, "CAMPAIGN_BUDGET_EXHAUSTED");
    this.fundingContext = context;
  }
}

export interface WalletShortfallContext {
  deficitCents: number;
  walletAvailableCents: number;
}

export class WalletShortfallError extends AppError {
  public readonly fundingContext: WalletShortfallContext;

  constructor(context: WalletShortfallContext) {
    super(
      "Insufficient advertiser wallet balance",
      400,
      "ADVERTISER_WALLET_INSUFFICIENT_BALANCE"
    );
    this.fundingContext = context;
  }
}
