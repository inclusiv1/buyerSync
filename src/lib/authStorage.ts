export const isTestMode = import.meta.env.VITE_APP_MODE === 'test';

export const authStorage: Storage = isTestMode ? sessionStorage : localStorage;