export interface Business {
  name: string;
  website: string | null;
  domain?: string | null;
}

export interface EmailFinderResult {
  email: string | null;
  source: string;
}

export interface EmailFinder {
  findEmail(business: Business): Promise<EmailFinderResult>;
}

export type VerifyStatus = 'valid' | 'invalid' | 'unknown';

export interface EmailVerifierResult {
  status: VerifyStatus;
}

export interface EmailVerifier {
  verify(email: string): Promise<EmailVerifierResult>;
}
