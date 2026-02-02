import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        'crt-black': '#0a0a0a',
        'crt-dark': '#111111',
        'crt-panel': '#1a1a1a',
        'crt-border': '#333333',
        'titlebar': '#2a2a4a',
        'titlebar-active': '#000080',
        'neon-green': '#39ff14',
        'neon-red': '#ff1744',
        'neon-cyan': '#00e5ff',
        'neon-amber': '#ffab00',
        'neon-pink': '#ff4081',
        'terminal-green': '#4ade80',
        'terminal-red': '#f87171',
        'terminal-dim': '#666666',
        'win-gray': '#c0c0c0',
        'win-dark': '#808080',
        'win-light': '#dfdfdf',
      },
      fontFamily: {
        'mono': ['Share Tech Mono', 'VT323', 'Courier New', 'monospace'],
        'pixel': ['Press Start 2P', 'monospace'],
        'terminal': ['VT323', 'monospace'],
      },
      boxShadow: {
        'retro': '2px 2px 0px #000000',
        'retro-inset': 'inset 1px 1px 0px #444444, inset -1px -1px 0px #000000',
        'window': 'inset 1px 1px 0px #444, inset -1px -1px 0px #000, 2px 2px 0px #000',
        'window-content': 'inset 1px 1px 0px #000, inset -1px -1px 0px #333',
        'btn-raised': 'inset 1px 1px 0px #ffffff40, inset -1px -1px 0px #00000080, 1px 1px 0px #000',
        'btn-pressed': 'inset 1px 1px 0px #00000080, inset -1px -1px 0px #ffffff20',
        'neon-green': '0 0 5px #39ff14, 0 0 10px #39ff1444',
        'neon-cyan': '0 0 5px #00e5ff, 0 0 10px #00e5ff44',
        'neon-red': '0 0 5px #ff1744, 0 0 10px #ff174444',
      },
      animation: {
        'blink': 'blink 1s step-end infinite',
        'scanline': 'scanline 8s linear infinite',
        'flicker': 'flicker 0.15s infinite',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        flicker: {
          '0%': { opacity: '0.97' },
          '50%': { opacity: '1' },
          '100%': { opacity: '0.98' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
      },
      fontSize: {
        'xxs': '0.625rem',
      },
    },
  },
  plugins: [],
};
export default config;
