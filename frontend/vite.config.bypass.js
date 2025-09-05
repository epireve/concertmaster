import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Bypass mode Vite config - More permissive for quick deployment
export default defineConfig({
  plugins: [react()],
  css: {
    postcss: {
      plugins: [
        require('tailwindcss')('./tailwind.config.bypass.js'),
        require('autoprefixer'),
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/utils': path.resolve(__dirname, './src/utils'),
      '@/hooks': path.resolve(__dirname, './src/hooks'),
      '@/store': path.resolve(__dirname, './src/store'),
      '@/types': path.resolve(__dirname, './src/types'),
    },
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: false, // Disable minification for bypass mode
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
      onwarn(warning, warn) {
        // Suppress specific warnings in bypass mode
        if (warning.code === 'THIS_IS_UNDEFINED') return;
        if (warning.code === 'CIRCULAR_DEPENDENCY') return;
        warn(warning);
      },
    },
    // More permissive build settings
    chunkSizeWarningLimit: 2000,
    assetsInlineLimit: 8192,
  },
  esbuild: {
    // Ignore TypeScript errors during build
    logOverride: { 
      'this-is-undefined-in-esm': 'silent',
      'suspicious-rest-destructuring': 'silent' 
    },
  },
  define: {
    __DEV__: process.env.NODE_ENV !== 'production',
  },
})