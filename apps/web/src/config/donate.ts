/**
 * Donationer via PayPal. Länken är antingen en PayPal.me-länk
 * (https://www.paypal.com/paypalme/<namn>) eller en donationsknapp skapad i
 * PayPal (https://www.paypal.com/donate/?hosted_button_id=<id>). Ingen
 * e-postadress behövs i appen. Tom sträng = donationsknappen visas inte.
 */
export const DONATE_URL: string = import.meta.env.VITE_DONATE_URL || '';
