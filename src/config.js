/*
 * Reown Project ID:
 * https://dashboard.reown.com
 *
 * Project ID is intended for client-side use; it is not a wallet private key.
 */
export const PROJECT_ID = 'a578856c46d402df65d8b71914106039'

/*
 * IMPORTANT:
 * Set this to the exact deployed origin, including the repository path
 * only when required by your Reown configuration.
 *
 * Example:
 * https://USERNAME.github.io/wallet-address-exporter
 */
export const APP_URL = window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, '')
