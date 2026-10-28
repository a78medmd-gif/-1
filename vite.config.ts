import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// base './' lets the build work from any sub-path (e.g. GitHub Pages /repo-name/)
export default defineConfig({ base: './', plugins: [react()] });
