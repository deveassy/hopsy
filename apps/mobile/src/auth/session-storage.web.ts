// SecureStore is native-only. Never silently downgrade tokens to browser localStorage.
const unavailable = async (): Promise<never> => {
  throw new Error('Secure session storage requires iOS or Android.');
};
export const sessionStorage = { getItem: unavailable, setItem: unavailable, removeItem: unavailable };
