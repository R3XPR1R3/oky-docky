import { useEffect } from 'react';
import { useLocation } from 'react-router';

type EventType = 'page_view' | 'click' | 'search' | 'form_start' | 'form_complete' | 'download';

interface AnalyticsPayload {
  template_id?: string;
  search_term?: string;
  element?: string;
  metadata?: Record<string, string | number | boolean>;
}

interface Attribution {
  source: string;
  medium: string;
  campaign: string;
  referrer_host: string;
}

const SESSION_KEY = 'oky_analytics_session';
const ATTRIBUTION_KEY = 'oky_analytics_attribution';

function sessionId() {
  let value = sessionStorage.getItem(SESSION_KEY);
  if (!value) {
    value = crypto.randomUUID().replace(/[^A-Za-z0-9_-]/g, '');
    sessionStorage.setItem(SESSION_KEY, value);
  }
  return value;
}

function detectAttribution(): Attribution {
  const stored = sessionStorage.getItem(ATTRIBUTION_KEY);
  if (stored) {
    try { return JSON.parse(stored); } catch { /* recreate invalid state */ }
  }

  const params = new URLSearchParams(window.location.search);
  const referrerHost = (() => {
    try { return document.referrer ? new URL(document.referrer).hostname.toLowerCase() : ''; }
    catch { return ''; }
  })();
  let source = params.get('utm_source') || '';
  let medium = params.get('utm_medium') || '';

  if (!source && params.get('ttclid')) [source, medium] = ['tiktok', 'paid_social'];
  if (!source && params.get('gclid')) [source, medium] = ['google', 'cpc'];
  if (!source && params.get('fbclid')) [source, medium] = ['facebook', 'paid_social'];
  if (!source && /(^|\.)google\./.test(referrerHost)) [source, medium] = ['google', 'organic'];
  if (!source && /(^|\.)bing\.com$/.test(referrerHost)) [source, medium] = ['bing', 'organic'];
  if (!source && /(^|\.)(duckduckgo|yahoo)\./.test(referrerHost)) [source, medium] = [referrerHost.split('.').slice(-2)[0], 'organic'];
  if (!source && /(^|\.)tiktok\.com$/.test(referrerHost)) [source, medium] = ['tiktok', 'social'];
  if (!source && referrerHost && referrerHost !== window.location.hostname) [source, medium] = [referrerHost, 'referral'];
  if (!source) [source, medium] = ['direct', 'none'];

  const attribution = {
    source,
    medium: medium || 'unknown',
    campaign: params.get('utm_campaign') || '',
    referrer_host: referrerHost,
  };
  sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution));
  return attribution;
}

export function trackEvent(eventType: EventType, payload: AnalyticsPayload = {}) {
  if (window.location.pathname.includes('/admin')) return;
  const attribution = detectAttribution();
  fetch('/api/analytics/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
    body: JSON.stringify({
      session_id: sessionId(),
      event_type: eventType,
      path: window.location.pathname,
      ...attribution,
      ...payload,
    }),
  }).catch(() => undefined);
}

export function AnalyticsTracker() {
  const location = useLocation();

  useEffect(() => {
    trackEvent('page_view');
  }, [location.pathname]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-analytics]') : null;
      if (target?.dataset.analytics) trackEvent('click', { element: target.dataset.analytics });
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  return null;
}
