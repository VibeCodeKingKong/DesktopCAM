/**
 * Feedback skickas via Web3Forms (https://web3forms.com). Mottagarens
 * e-postadress finns bara hos Web3Forms, kopplad till nyckeln nedan – den
 * står aldrig i appen eller i källkoden. Nyckeln får vara publik: den kan
 * bara användas för att skicka meddelanden till den kopplade adressen.
 *
 * Skapa nyckeln på web3forms.com med mottagarens adress och klistra in den
 * här (eller sätt VITE_WEB3FORMS_KEY vid bygget).
 */
export const FEEDBACK_ACCESS_KEY: string = import.meta.env.VITE_WEB3FORMS_KEY ?? '';

export const FEEDBACK_ENDPOINT = 'https://api.web3forms.com/submit';
