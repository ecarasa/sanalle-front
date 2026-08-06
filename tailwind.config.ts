import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#003087',
          50: '#E6EBF3',
          100: '#B3C1DB',
          200: '#8097C3',
          300: '#4D6DAB',
          400: '#264F9B',
          500: '#003087',
          600: '#002B7A',
          700: '#00236A',
          800: '#001B5A',
          900: '#001040',
        },
        secondary: {
          DEFAULT: '#E31837',
          50: '#FCE8EC',
          100: '#F5B8C3',
          200: '#EF889B',
          300: '#E85872',
          400: '#E63855',
          500: '#E31837',
          600: '#CC1632',
          700: '#A0112A',
          800: '#780D20',
          900: '#500814',
        },
        accent: {
          DEFAULT: '#00AEEF',
          50: '#E6F7FE',
          100: '#B3E6FC',
          200: '#80D5FA',
          300: '#4DC4F7',
          400: '#26B9F5',
          500: '#00AEEF',
          600: '#009DD7',
          700: '#0087BA',
          800: '#00719E',
          900: '#004D6B',
        },
        surface: '#F0F4F8',
        border: '#CBD5E1',
        text: '#1A1A2E',
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config
