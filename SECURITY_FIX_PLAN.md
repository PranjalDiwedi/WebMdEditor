# Security Vulnerability Remediation Plan

## Implementation status (SPA-adapted — updated)

| Item | Status | Notes |
|------|--------|--------|
| 1. OAuth token encryption | Done | AES via crypto-js; sessionStorage; plaintext migration; no hardcoded prod key |
| 2. XSS / DOMPurify | Done | Editor + export + file load sanitization; data: URLs blocked |
| 3. CSRF / secure state | Done | Web Crypto state + TTL; PKCE deferred (GIS token client) |
| 4. CSP + security headers | Done | index.html meta + public/_headers for Netlify |
| 5. Filename validation | Done | validateFileName + path traversal / reserved names |
| 6. Token expiration | Done | GIS expiry + Drive silent token refresh |
| 7. Error sanitization | Done | toUserError / logSecurityEvent |
| 8. Rate limiting | Done | Client token-bucket on Drive API (60/min) |
| 9. Security headers | Done | Covered by _headers |
| 10. Dependency scanning | Done | npm run audit + .github/workflows/ci.yml |

**SPA note:** `VITE_ENCRYPTION_KEY` is visible in the client bundle. Encryption reduces casual token exposure; XSS can still read session memory. Keep CSP + sanitization strong.

**Deploy env (Netlify):** set `VITE_GOOGLE_CLIENT_ID`, optional `VITE_GOOGLE_API_KEY`, and `VITE_ENCRYPTION_KEY` (`openssl rand -base64 32`). Never set OAuth client secrets in frontend env.

---


## Overview
This document outlines the detailed plan to fix all identified security vulnerabilities in the Web MD Editor application, prioritized by severity level.

---

## 🔴 CRITICAL VULNERABILITIES

### 1. OAuth Token Storage Vulnerability (CRITICAL)

**Current Issue:**
- OAuth access tokens stored in localStorage (vulnerable to XSS)
- No encryption or protection for sensitive tokens
- Tokens persist indefinitely

**Fix Plan:**

#### Phase 1: Implement Token Encryption
- Install crypto library: `npm install crypto-js`
- Create `src/utils/tokenEncryption.ts`:
  ```typescript
  import CryptoJS from 'crypto-js';
  
  const SECRET_KEY = import.meta.env.VITE_ENCRYPTION_KEY || 'default-secret-key';
  
  export function encryptToken(token: string): string {
    return CryptoJS.AES.encrypt(token, SECRET_KEY).toString();
  }
  
  export function decryptToken(encryptedToken: string): string {
    const bytes = CryptoJS.AES.decrypt(encryptedToken, SECRET_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  }
  ```

#### Phase 2: Update Token Storage
- Modify `src/utils/oauthHelpers.ts`:
  ```typescript
  import { encryptToken, decryptToken } from './tokenEncryption';
  
  export function storeTokens(provider: string, tokens: any): void {
    const key = `md_editor_${provider}_tokens`;
    const encryptedTokens = {
      ...tokens,
      accessToken: encryptToken(tokens.accessToken)
    };
    localStorage.setItem(key, JSON.stringify(encryptedTokens));
  }
  
  export function getStoredTokens(provider: string): any | null {
    const key = `md_editor_${provider}_tokens`;
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    
    const tokens = JSON.parse(stored);
    return {
      ...tokens,
      accessToken: decryptToken(tokens.accessToken)
    };
  }
  ```

#### Phase 3: Add Token Expiration
- Implement token lifecycle management
- Add automatic token refresh where supported
- Set reasonable expiration times (1 hour)

#### Phase 4: Migration Strategy
- Clear existing localStorage tokens on next login
- Force re-authentication for all users
- Add migration notice in UI

**Timeline:** 2-3 days
**Dependencies:** crypto-js library
**Testing:** Verify token encryption/decryption, test token persistence

---

### 2. XSS Vulnerability in Rich Text Editor (CRITICAL)

**Current Issue:**
- TipTap editor stores raw HTML without sanitization
- Malicious HTML/JavaScript can be injected via markdown
- No validation of rendered content

**Fix Plan:**

#### Phase 1: Install Sanitization Library
- Install DOMPurify: `npm install dompurify @types/dompurify`

#### Phase 2: Implement HTML Sanitization
- Create `src/utils/htmlSanitizer.ts`:
  ```typescript
  import DOMPurify from 'dompurify';
  
  // Configure DOMPurify for markdown content
  const purifyConfig = {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 's', 'code', 'pre',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'blockquote', 'a', 'hr',
      'table', 'thead', 'tbody', 'tr', 'th', 'td'
    ],
    ALLOWED_ATTR: ['href', 'title', 'class', 'target'],
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick']
  };
  
  export function sanitizeHTML(html: string): string {
    return DOMPurify.sanitize(html, purifyConfig);
  }
  
  export function sanitizeMarkdown(markdown: string): string {
    // First convert markdown to HTML, then sanitize
    const html = marked(markdown);
    return sanitizeHTML(html);
  }
  ```

#### Phase 3: Update Editor Integration
- Modify `src/editor/useEditor.ts`:
  ```typescript
  import { sanitizeHTML } from '../utils/htmlSanitizer';
  
  onUpdate: ({ editor }) => {
    const html = editor.getHTML();
    const sanitizedHtml = sanitizeHTML(html);
    onUpdate(sanitizedHtml);
  }
  ```

#### Phase 4: Add Content Validation
- Validate file content on upload
- Sanitize existing files on first open
- Add warning for suspicious content

#### Phase 5: Update Storage Providers
- Sanitize content before saving to storage providers
- Add validation in `writeFile` methods

**Timeline:** 2-3 days
**Dependencies:** dompurify, @types/dompurify
**Testing:** Test XSS payloads, verify sanitization, test markdown rendering

---

## 🟠 HIGH VULNERABILITIES

### 3. Weak CSRF Protection (HIGH)

**Current Issue:**
- OAuth state uses Math.random() (not cryptographically secure)
- Predictable state values
- Weak CSRF protection

**Fix Plan:**

#### Phase 1: Implement Secure Random Generation
- Create `src/utils/cryptoUtils.ts`:
  ```typescript
  export function generateSecureState(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }
  
  export function generateSecureToken(length: number = 32): string {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }
  ```

#### Phase 2: Update OAuth Helpers
- Modify `src/utils/oauthHelpers.ts`:
  ```typescript
  import { generateSecureState } from './cryptoUtils';
  
  export function generateState(): string {
    return generateSecureState();
  }
  ```

#### Phase 3: Add PKCE (Proof Key for Code Exchange)
- Implement PKCE for OAuth 2.0 flows
- Add code verifier and code challenge generation
- Update OAuth implementations

#### Phase 4: Add State Validation
- Implement strict state validation
- Add timestamp validation
- Implement replay attack prevention

**Timeline:** 1-2 days
**Dependencies:** Web Crypto API (built-in)
**Testing:** Test OAuth flows, verify state validation, test PKCE implementation

---

### 4. Implement Content Security Policy (HIGH)

**Current Issue:**
- No Content Security Policy headers
- Allows execution of inline scripts
- No restrictions on external resources

**Fix Plan:**

#### Phase 1: Create CSP Configuration
- Create `public/security-headers.html` or configure in build process
- Add CSP meta tag to `index.html`:
  ```html
  <meta http-equiv="Content-Security-Policy" 
        content="default-src 'self'; 
                 script-src 'self' 'nonce-{random}' https://apis.google.com https://accounts.google.com; 
                 style-src 'self' 'unsafe-inline'; 
                 img-src 'self' data: https:; 
                 connect-src 'self' https://www.googleapis.com https://www.dropbox.com https://graph.microsoft.com; 
                 font-src 'self'; 
                 object-src 'none'; 
                 base-uri 'self'; 
                 form-action 'self';">
  ```

#### Phase 2: Implement Nonce Generation
- Add nonce generation for inline scripts
- Update script loading to use nonces
- Configure Vite to handle CSP

#### Phase 3: Server-Side Headers (if deployed)
- Configure server CSP headers
- Add report-only mode for testing
- Implement CSP violation reporting

#### Phase 4: Update External Resources
- Review and whitelist all external domains
- Remove unnecessary external dependencies
- Implement Subresource Integrity (SRI) for external scripts

**Timeline:** 1-2 days
**Dependencies:** None (browser built-in)
**Testing:** Test CSP compliance, verify external resource loading, test violation reporting

---

### 5. Add Input Validation for File Names (HIGH)

**Current Issue:**
- No validation for file names
- Vulnerable to path traversal
- No length restrictions

**Fix Plan:**

#### Phase 1: Enhance File Validation
- Update `src/utils/fileValidation.ts`:
  ```typescript
  const MAX_FILENAME_LENGTH = 255;
  const INVALID_CHARS = /[<>:"/\\|?*\x00-\x1F]/g;
  const RESERVED_NAMES = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
  const PATH_TRAVERSAL = /\.\./;
  
  export function validateFileName(fileName: string): { valid: boolean; error?: string } {
    // Check length
    if (fileName.length === 0) {
      return { valid: false, error: 'File name cannot be empty' };
    }
    
    if (fileName.length > MAX_FILENAME_LENGTH) {
      return { valid: false, error: `File name must be less than ${MAX_FILENAME_LENGTH} characters` };
    }
    
    // Check for invalid characters
    if (INVALID_CHARS.test(fileName)) {
      return { valid: false, error: 'File name contains invalid characters' };
    }
    
    // Check for path traversal
    if (PATH_TRAVERSAL.test(fileName)) {
      return { valid: false, error: 'File name contains path traversal sequences' };
    }
    
    // Check for reserved names (Windows)
    if (RESERVED_NAMES.test(fileName)) {
      return { valid: false, error: 'File name is reserved' };
    }
    
    // Check for leading/trailing spaces and dots
    if (fileName.trim() !== fileName || fileName.startsWith('.') || fileName.endsWith('.')) {
      return { valid: false, error: 'File name cannot start or end with spaces or dots' };
    }
    
    return { valid: true };
  }
  
  export function sanitizeFileName(fileName: string): string {
    return fileName
      .replace(INVALID_CHARS, '_')
      .replace(PATH_TRAVERSAL, '')
      .trim()
      .substring(0, MAX_FILENAME_LENGTH);
  }
  ```

#### Phase 2: Update File Creation
- Add validation in file creation flow
- Update UI to show validation errors
- Add real-time validation feedback

#### Phase 3: Update Storage Providers
- Add validation in all storage provider `createFile` methods
- Sanitize file names before API calls
- Add consistent error handling

#### Phase 4: Add File Content Validation
- Validate file content type
- Check for malicious file signatures
- Implement file size limits

**Timeline:** 1-2 days
**Dependencies:** None
**Testing:** Test with various malicious inputs, test path traversal attempts, test validation error handling

---

## 🟡 MEDIUM VULNERABILITIES

### 6. Improve Token Expiration Handling (MEDIUM)

**Current Issue:**
- No token refresh mechanism
- Expired tokens might still be accepted
- No proactive token renewal

**Fix Plan:**

#### Phase 1: Implement Token Refresh Logic
- Create `src/utils/tokenManager.ts`:
  ```typescript
  export class TokenManager {
    private refreshThreshold = 5 * 60 * 1000; // 5 minutes before expiration
    
    shouldRefreshToken(expiresAt: number): boolean {
      return Date.now() >= (expiresAt - this.refreshThreshold);
    }
    
    async refreshToken(provider: string): Promise<string> {
      // Implement provider-specific refresh logic
      // For now, return current token
      return this.getCurrentToken(provider);
    }
    
    getCurrentToken(provider: string): string | null {
      const tokens = getStoredTokens(provider);
      if (!tokens || !this.isValidToken(tokens)) {
        return null;
      }
      return tokens.accessToken;
    }
    
    isValidToken(tokens: any): boolean {
      return tokens && tokens.expiresAt > Date.now();
    }
  }
  ```

#### Phase 2: Add Token Validation Middleware
- Create middleware to validate tokens before API calls
- Add automatic token refresh where supported
- Implement graceful degradation on token failure

#### Phase 3: Update OAuth Implementations
- Add refresh token support where available
- Implement token revocation on logout
- Add token cleanup on expiration

#### Phase 4: Add Token Monitoring
- Monitor token expiration
- Show warnings before token expiration
- Implement auto-refresh for active sessions

**Timeline:** 2-3 days
**Dependencies:** None
**Testing:** Test token expiration, test refresh logic, test error handling

---

### 7. Sanitize Error Messages (MEDIUM)

**Current Issue:**
- Error messages may expose sensitive information
- No generic error handling
- Information leakage possible

**Fix Plan:**

#### Phase 1: Create Error Handler
- Create `src/utils/errorHandler.ts`:
  ```typescript
  export class SecurityErrorHandler {
    private static sanitizeError(error: unknown): string {
      // Generic error messages for users
      const genericMessages = {
        'Authentication failed': 'Please sign in again',
        'Network error': 'Connection failed. Please check your internet.',
        'File not found': 'The requested file could not be found',
        'Permission denied': 'You do not have permission to perform this action',
        'Storage error': 'An error occurred while accessing storage',
        'Validation error': 'Invalid input provided',
        'Rate limit exceeded': 'Too many requests. Please try again later.',
        'default': 'An unexpected error occurred. Please try again.'
      };
      
      // Log detailed error for debugging
      console.error('Detailed error:', error);
      
      // Return generic message
      return genericMessages.default;
    }
    
    static getUserMessage(error: unknown): string {
      return this.sanitizeError(error);
    }
    
    static logDetailedError(error: unknown, context: string): void {
      // In production, send to logging service
      console.error(`[${context}]`, error);
    }
  }
  ```

#### Phase 2: Update Error Handling
- Replace all error messages with sanitized versions
- Update UI to show generic errors
- Add detailed logging for debugging

#### Phase 3: Add Error Classification
- Classify errors by severity
- Implement different handling for different error types
- Add user-friendly error recovery suggestions

#### Phase 4: Update Storage Providers
- Sanitize all error messages from storage providers
- Add consistent error handling
- Implement error recovery mechanisms

**Timeline:** 1-2 days
**Dependencies:** None
**Testing:** Test various error scenarios, verify message sanitization, test error logging

---

### 8. Implement Rate Limiting (MEDIUM)

**Current Issue:**
- No rate limiting on API calls
- Vulnerable to abuse and DoS
- No request throttling

**Fix Plan:**

#### Phase 1: Create Rate Limiter
- Create `src/utils/rateLimiter.ts`:
  ```typescript
  export class RateLimiter {
    private requests: Map<string, number[]> = new Map();
    private limits: Map<string, { maxRequests: number; windowMs: number }> = new Map();
    
    constructor() {
      // Default limits
      this.setLimit('api', { maxRequests: 100, windowMs: 60000 }); // 100 requests per minute
      this.setLimit('file', { maxRequests: 50, windowMs: 60000 }); // 50 file operations per minute
      this.setLimit('auth', { maxRequests: 5, windowMs: 60000 }); // 5 auth attempts per minute
    }
    
    setLimit(key: string, limit: { maxRequests: number; windowMs: number }): void {
      this.limits.set(key, limit);
    }
    
    checkLimit(key: string): boolean {
      const limit = this.limits.get(key);
      if (!limit) return true;
      
      const now = Date.now();
      const requests = this.requests.get(key) || [];
      
      // Remove old requests outside the time window
      const validRequests = requests.filter(time => now - time < limit.windowMs);
      
      if (validRequests.length >= limit.maxRequests) {
        return false; // Rate limit exceeded
      }
      
      validRequests.push(now);
      this.requests.set(key, validRequests);
      return true;
    }
    
    resetLimit(key: string): void {
      this.requests.delete(key);
    }
  }
  ```

#### Phase 2: Add Rate Limiting to API Calls
- Wrap all API calls with rate limiting
- Add rate limit checking before storage operations
- Implement backoff strategy for rate-limited requests

#### Phase 3: Add Request Queuing
- Implement request queue for file operations
- Add priority handling for important operations
- Implement request cancellation

#### Phase 4: Add Rate Limit UI Feedback
- Show rate limit warnings to users
- Add countdown timers for rate-limited operations
- Implement progressive delay for repeated violations

**Timeline:** 2-3 days
**Dependencies:** None
**Testing:** Test rate limiting, test queue behavior, test UI feedback

---

## 🟢 LOW VULNERABILITIES

### 9. Add Security Headers (LOW)

**Current Issue:**
- Missing important security headers
- No clickjacking protection
- No MIME type protection

**Fix Plan:**

#### Phase 1: Add Security Headers
- Update `index.html`:
  ```html
  <meta http-equiv="X-Content-Type-Options" content="nosniff">
  <meta http-equiv="X-Frame-Options" content="DENY">
  <meta http-equiv="X-XSS-Protection" content="1; mode=block">
  <meta http-equiv="Referrer-Policy" content="strict-origin-when-cross-origin">
  <meta name="description" content="Web MD Editor - A secure markdown editor">
  ```

#### Phase 2: Configure Build Process
- Add security headers to Vite config
- Configure production headers
- Add development vs production header differences

#### Phase 3: Server Configuration (if deployed)
- Configure server security headers
- Add HSTS header for HTTPS
- Configure server-side CSP

#### Phase 4: Add Security Best Practices
- Implement proper CORS configuration
- Add secure cookie attributes
- Configure proper MIME types

**Timeline:** 1 day
**Dependencies:** None
**Testing:** Verify header implementation, test security headers, test browser compatibility

---

### 10. Set Up Dependency Scanning (LOW)

**Current Issue:**
- No automated dependency scanning
- No security audit process
- Vulnerable dependencies might go unnoticed

**Fix Plan:**

#### Phase 1: Add npm Audit
- Run `npm audit` regularly
- Fix high-severity vulnerabilities
- Add audit to CI/CD pipeline

#### Phase 2: Add Snyk or Similar Tool
- Install Snyk: `npm install -g snyk`
- Initialize Snyk: `snyk auth`
- Add Snyk to package.json scripts:
  ```json
  {
    "scripts": {
      "snyk-test": "snyk test",
      "snyk-monitor": "snyk monitor"
    }
  }
  ```

#### Phase 3: Add Dependabot (if using GitHub)
- Enable Dependabot alerts
- Configure Dependabot updates
- Set up automated PRs for dependency updates

#### Phase 4: Implement Regular Updates
- Schedule regular dependency updates
- Monitor security advisories
- Implement testing for dependency updates

#### Phase 5: Add Security Documentation
- Document security update process
- Create incident response plan
- Add security checklist for deployments

**Timeline:** 1-2 days
**Dependencies:** snyk (or similar)
**Testing:** Test scanning tools, verify vulnerability detection, test update process

---

## IMPLEMENTATION TIMELINE

### Week 1: Critical Vulnerabilities
- Days 1-3: OAuth token storage fix
- Days 4-6: XSS vulnerability fix

### Week 2: High Vulnerabilities
- Days 1-2: CSRF protection fix
- Days 3-4: Content Security Policy
- Days 5-6: Input validation enhancement

### Week 3: Medium Vulnerabilities
- Days 1-3: Token expiration handling
- Days 4-5: Error message sanitization
- Days 6-7: Rate limiting implementation

### Week 4: Low Vulnerabilities & Testing
- Days 1-2: Security headers
- Days 3-4: Dependency scanning
- Days 5-7: Comprehensive security testing

---

## TESTING STRATEGY

### Security Testing
- **Penetration Testing**: Conduct before and after fixes
- **XSS Testing**: Test with various XSS payloads
- **OAuth Testing**: Test all OAuth flows thoroughly
- **Input Validation**: Test with malicious inputs
- **Rate Limiting**: Test abuse scenarios

### Automated Testing
- Add security-focused unit tests
- Implement integration tests for security features
- Add automated vulnerability scanning
- Set up continuous security monitoring

### Manual Testing
- Security audit by security professional
- User acceptance testing with security focus
- Performance testing with security features enabled

---

## ROLLBACK PLAN

### Emergency Rollback
- Maintain previous versions of critical files
- Document rollback procedures
- Test rollback process
- Plan for hotfix deployment

### Monitoring
- Monitor for security incidents
- Set up alerts for suspicious activity
- Implement logging for security events
- Create incident response procedures

---

## SUCCESS METRICS

### Security Metrics
- Vulnerability count reduction
- Security test pass rate
- Incident response time
- Vulnerability remediation time

### Performance Metrics
- Application performance impact
- User experience impact
- Load time changes
- Resource usage changes

---

## CONCLUSION

This comprehensive security remediation plan addresses all identified vulnerabilities in order of severity. Implementation should follow the timeline strictly, with thorough testing at each phase. Regular security audits should be conducted post-implementation to ensure ongoing security.

**Total Estimated Timeline:** 4 weeks
**Resources Required:** 2-3 developers
**Risk Level:** HIGH until critical vulnerabilities are fixed