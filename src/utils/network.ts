/**
 * Network environment diagnostics.
 *
 * Detects CSP restrictions, CORS issues, and API connectivity.
 * Results are surfaced to the user with actionable error messages.
 */
import { Logger } from './logger.js';
import { NETWORK_CHECK_TIMEOUT_MS } from './constants.js';
import { t } from './i18n/index.js';

export enum NetworkStatus {
  UNKNOWN = 'unknown',
  OK = 'ok',
  CSP_BLOCKED = 'csp_blocked',
  CORS_BLOCKED = 'cors_blocked',
  NETWORK_ERROR = 'network_error',
  API_AUTH_ERROR = 'api_auth_error',
  API_ERROR = 'api_error',
  TIMEOUT = 'timeout',
  NOT_CONFIGURED = 'not_configured',
}

export interface NetworkCheckResult {
  status: NetworkStatus;
  message: string;
  detail?: string;
}

/** Status-to-i18n-key mapping. */
const STATUS_KEYS: Record<NetworkStatus, string> = {
  [NetworkStatus.UNKNOWN]: 'status.unknown',
  [NetworkStatus.OK]: 'status.ok',
  [NetworkStatus.CSP_BLOCKED]: 'status.csp_blocked',
  [NetworkStatus.CORS_BLOCKED]: 'status.cors_blocked',
  [NetworkStatus.NETWORK_ERROR]: 'status.network_error',
  [NetworkStatus.API_AUTH_ERROR]: 'status.api_auth_error',
  [NetworkStatus.API_ERROR]: 'status.api_error',
  [NetworkStatus.TIMEOUT]: 'status.timeout',
  [NetworkStatus.NOT_CONFIGURED]: 'status.not_configured',
};

export function getStatusMessage(status: NetworkStatus): string {
  const key = STATUS_KEYS[status];
  return key ? t(key as any) : status;
}

const logger = new Logger('Network');

export class NetworkDiagnostics {
  private lastResult: NetworkCheckResult = {
    status: NetworkStatus.UNKNOWN,
    message: getStatusMessage(NetworkStatus.UNKNOWN),
  };

  /** Return the most recent check result. */
  getLastResult(): NetworkCheckResult {
    return this.lastResult;
  }

  /**
   * Run a full connectivity check against the given API endpoint.
   *
   * Strategy:
   *  1. Detect CSP by listening for `securitypolicyviolation` events during the request.
   *  2. Send a lightweight GET to `{apiUrl}/models` (standard OpenAI-compatible endpoint).
   *  3. Classify the response or error into a `NetworkStatus`.
   *
   * A 401 response is still a "reachable" signal — we report it as an auth error
   * but separate from connectivity problems.
   */
  async check(apiUrl: string, apiKey?: string): Promise<NetworkCheckResult> {
    if (!apiUrl) {
      this.lastResult = { status: NetworkStatus.NOT_CONFIGURED, message: getStatusMessage(NetworkStatus.NOT_CONFIGURED) };
      return this.lastResult;
    }

    // Normalise URL: strip trailing slash
    const baseUrl = apiUrl.replace(/\/+$/, '');
    const modelsUrl = baseUrl.endsWith('/models') ? baseUrl : `${baseUrl}/models`;

    // CSP detection
    let cspViolated = false;
    const cspHandler = () => { cspViolated = true; };
    document.addEventListener('securitypolicyviolation', cspHandler);

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), NETWORK_CHECK_TIMEOUT_MS);

      const headers: Record<string, string> = { 'Accept': 'application/json' };
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      const resp = await fetch(modelsUrl, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      clearTimeout(timer);
      document.removeEventListener('securitypolicyviolation', cspHandler);

      if (cspViolated) {
        this.lastResult = { status: NetworkStatus.CSP_BLOCKED, message: getStatusMessage(NetworkStatus.CSP_BLOCKED) };
        return this.lastResult;
      }

      if (resp.ok) {
        this.lastResult = { status: NetworkStatus.OK, message: getStatusMessage(NetworkStatus.OK) };
        return this.lastResult;
      }

      if (resp.status === 401 || resp.status === 403) {
        this.lastResult = {
          status: NetworkStatus.API_AUTH_ERROR,
          message: getStatusMessage(NetworkStatus.API_AUTH_ERROR),
          detail: `HTTP ${resp.status}`,
        };
        return this.lastResult;
      }

      // Any other server response means network is fine but API has issues
      const body = await resp.text().catch(() => '');
      this.lastResult = {
        status: NetworkStatus.API_ERROR,
        message: getStatusMessage(NetworkStatus.API_ERROR),
        detail: `HTTP ${resp.status}: ${body.slice(0, 200)}`,
      };
      return this.lastResult;

    } catch (err: unknown) {
      document.removeEventListener('securitypolicyviolation', cspHandler);

      if (cspViolated) {
        this.lastResult = { status: NetworkStatus.CSP_BLOCKED, message: getStatusMessage(NetworkStatus.CSP_BLOCKED) };
        return this.lastResult;
      }

      if (err instanceof DOMException && err.name === 'AbortError') {
        this.lastResult = { status: NetworkStatus.TIMEOUT, message: getStatusMessage(NetworkStatus.TIMEOUT) };
        return this.lastResult;
      }

      // TypeError from fetch usually means CORS or unreachable
      if (err instanceof TypeError) {
        this.lastResult = {
          status: NetworkStatus.CORS_BLOCKED,
          message: getStatusMessage(NetworkStatus.CORS_BLOCKED),
          detail: err.message,
        };
        return this.lastResult;
      }

      this.lastResult = {
        status: NetworkStatus.NETWORK_ERROR,
        message: getStatusMessage(NetworkStatus.NETWORK_ERROR),
        detail: (err as Error).message ?? String(err),
      };
      return this.lastResult;

    } finally {
      logger.info('Network check result:', this.lastResult.status, this.lastResult.message);
    }
  }
}
