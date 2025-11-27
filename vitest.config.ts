export default {
    testEnvironment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    transformMode: {
      web: [/\.([cm]?[jt]sx?|json)$/],
    },
  }
