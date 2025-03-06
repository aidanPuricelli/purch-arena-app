declare global {
    interface Window {
        process?: {
            type: string;
        };
    }
}

export const environment = {
    production: false,
    nodeEnv: 'development',
    apiUrl: typeof window !== 'undefined' && window.process?.type === 'renderer' 
        ? 'http://localhost:3000'  // When running in Electron
        : 'http://localhost:4200'  // When running in browser during development
};
