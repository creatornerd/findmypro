export const REFERRAL_KEY = 'findmypro_referral';

// Referral links point at the landing page (/?ref=CODE), but the visitor may
// sign up from /chat later. Stash the code on whichever route they arrive at,
// before any page renders, so it survives navigation and OAuth redirects.
export function captureReferralFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (!ref) return;
    localStorage.setItem(REFERRAL_KEY, ref.trim().toLowerCase());
    params.delete('ref');
    const rest = params.toString();
    window.history.replaceState(window.history.state, '', window.location.pathname + (rest ? `?${rest}` : '') + window.location.hash);
  } catch {
    // Storage blocked (private mode etc.) — referral just won't be credited.
  }
}
