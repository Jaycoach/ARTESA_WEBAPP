/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.tsx',
    './src/**/*.{js,jsx,ts,tsx,html}',
  ],
  darkMode: 'class', // Preparado para dark mode futuro
  theme: {
    extend: {
      // **ANIMACIONES MEJORADAS** para el sistema de productos
      animation: {
        fadeIn: 'fadeIn 0.3s ease-in-out',
        slideIn: 'slideIn 0.4s ease-out',
        slideUp: 'slideUp 0.3s ease-out',
        slideDown: 'slideDown 0.3s ease-out',
        scaleIn: 'scaleIn 0.2s ease-out',
        pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        bounce: 'bounce 1s infinite',
        spin: 'spin 1s linear infinite',
        wiggle: 'wiggle 1s ease-in-out infinite',
        float: 'float 3s ease-in-out infinite',
        glow: 'glow 2s ease-in-out infinite alternate',
        cardHover: 'cardHover 0.3s ease-out',
        modalIn: 'modalIn 0.3s ease-out',
        toastIn: 'toastIn 0.3s ease-out',
        shimmer: 'shimmer 1.5s ease-in-out infinite',
      },

      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(99, 102, 241, 0.5)' },
          '100%': { boxShadow: '0 0 20px rgba(99, 102, 241, 0.8)' },
        },
        cardHover: {
          '0%': { transform: 'translateY(0px) scale(1)' },
          '100%': { transform: 'translateY(-5px) scale(1.02)' },
        },
        modalIn: {
          '0%': {
            opacity: '0',
            transform: 'scale(0.95) translateY(-10px)'
          },
          '100%': {
            opacity: '1',
            transform: 'scale(1) translateY(0)'
          },
        },
        toastIn: {
          '0%': {
            transform: 'translateX(100%)',
            opacity: '0'
          },
          '100%': {
            transform: 'translateX(0)',
            opacity: '1'
          },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },

      // **COLORES EXTENDIDOS** para el sistema completo
      colors: {
        // Colores principales existentes
        primary: {
          DEFAULT: '#687e8d',
          50: '#f8f9fa',
          100: '#e9ecef',
          200: '#dee2e6',
          300: '#ced4da',
          400: '#adb5bd',
          500: '#687e8d',
          600: '#5a6c79',
          700: '#4d5a65',
          800: '#3f4751',
          900: '#32353d',
        },
        secondary: {
          DEFAULT: '#f6db8e',
          50: '#fefcf6',
          100: '#fdf8e7',
          200: '#fcf1d0',
          300: '#f9e8a9',
          400: '#f6db8e',
          500: '#f3cd6d',
          600: '#f0be4c',
          700: '#e6a833',
          800: '#cc9429',
          900: '#b3811f',
        },
        accent: {
          DEFAULT: '#f6754e',
          50: '#fef6f3',
          100: '#fdeae2',
          200: '#fbd4c5',
          300: '#f8b59e',
          400: '#f6754e',
          500: '#f4552e',
          600: '#e63e1e',
          700: '#c8301a',
          800: '#a32516',
          900: '#851e12',
        },

        // Colores para el sistema de productos
        success: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        error: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
        },
        info: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        artesa: {
          DEFAULT: '#478090',
          50: '#f0f9fb',
          100: '#e0f3f7',
          200: '#c1e7ef',
          300: '#a2dbe7',
          400: '#83cfdf',
          500: '#478090',  // Color principal de botones
          600: '#3d6c7a',
          700: '#335864',
          800: '#29444e',
          900: '#1f3038',
        },

        // Colores existentes mantenidos
        base: '#ffffff',
        footer: '#687e8d',
        homePrimary: '#7b8ac0',
        secondaryHome: '#bbc4a6',

        // Nuevos colores para estados
        indigo: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },

        // Grises personalizados
        cool: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
        },
      },

      // **TAMAÑOS DE FUENTE MEJORADOS**
      fontSize: {
        biggest: ['var(--biggestFontSize)', { lineHeight: '1.1' }],
        h1: ['var(--h1FontSize)', { lineHeight: '1.2' }],
        h2: ['var(--h2FontSize)', { lineHeight: '1.3' }],
        h3: ['var(--h3FontSize)', { lineHeight: '1.4' }],
        normal: ['var(--normalFontSize)', { lineHeight: '1.5' }],
        xs: ['0.75rem', { lineHeight: '1rem' }],
        sm: ['0.875rem', { lineHeight: '1.25rem' }],
        base: ['1rem', { lineHeight: '1.5rem' }],
        lg: ['1.125rem', { lineHeight: '1.75rem' }],
        xl: ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1' }],
        '6xl': ['3.75rem', { lineHeight: '1' }],
      },

      // **ESPACIADO PERSONALIZADO**
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
        '144': '36rem',
      },

      // **BORDES REDONDEADOS EXTENDIDOS**
      borderRadius: {
        xl: 'var(--border-radius-xl)',
        '2xl': 'var(--border-radius-2xl)',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },

      // **SOMBRAS PERSONALIZADAS**
      boxShadow: {
        'soft': '0 2px 8px 0 rgba(0, 0, 0, 0.08)',
        'medium': '0 4px 12px 0 rgba(0, 0, 0, 0.12)',
        'hard': '0 8px 24px 0 rgba(0, 0, 0, 0.16)',
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        'card-hover': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'modal': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        'product-card': '0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24)',
        'product-card-hover': '0 4px 8px rgba(0, 0, 0, 0.12), 0 2px 4px rgba(0, 0, 0, 0.08)',
        'inner-soft': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
      },

      // **GRADIENTES PERSONALIZADOS**
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'shimmer': 'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)',
        'product-overlay': 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.3) 100%)',
      },

      // **BREAKPOINTS PERSONALIZADOS**
      screens: {
        'xs': '475px',
        '3xl': '1600px',
        '4xl': '1920px',
      },

      // **Z-INDEX PERSONALIZADO**
      zIndex: {
        '60': '60',
        '70': '70',
        '80': '80',
        '90': '90',
        '100': '100',
      },

      // **TRANSICIONES PERSONALIZADAS**
      transitionProperty: {
        'height': 'height',
        'spacing': 'margin, padding',
        'colors-transform': 'color, background-color, border-color, text-decoration-color, fill, stroke, transform',
      },

      // **DURACIONES DE TRANSICIÓN**
      transitionDuration: {
        '350': '350ms',
        '400': '400ms',
        '600': '600ms',
        '800': '800ms',
        '1200': '1200ms',
      },

      // **FUNCIONES DE TIEMPO**
      transitionTimingFunction: {
        'bounce-in': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },

      // **BLUR PERSONALIZADO**
      blur: {
        xs: '2px',
      },

      // **BACKDROP BLUR**
      backdropBlur: {
        xs: '2px',
      },
    },
  },

  // **PLUGINS OPTIMIZADOS**
  plugins: [
    require('@tailwindcss/line-clamp', '@tailwindcss/forms'),

    // Plugin personalizado para utilidades adicionales
    function ({ addUtilities, addComponents, theme }) {
      // **UTILIDADES PERSONALIZADAS**
      addUtilities({
        // Utilidades para imágenes de productos
        '.image-cover': {
          'object-fit': 'cover',
          'object-position': 'center',
        },
        '.image-contain': {
          'object-fit': 'contain',
          'object-position': 'center',
        },

        // Utilidades para scroll personalizado
        '.scrollbar-thin': {
          'scrollbar-width': 'thin',
          'scrollbar-color': theme('colors.gray.400') + ' ' + theme('colors.gray.100'),
        },
        '.scrollbar-none': {
          'scrollbar-width': 'none',
          '-ms-overflow-style': 'none',
          '&::-webkit-scrollbar': {
            'display': 'none',
          },
        },

        // Utilidades para aspectos específicos
        '.aspect-product': {
          'aspect-ratio': '1 / 1',
        },
        '.aspect-card': {
          'aspect-ratio': '4 / 3',
        },

        // Utilidades para truncado avanzado
        '.truncate-2': {
          'display': '-webkit-box',
          '-webkit-line-clamp': '2',
          '-webkit-box-orient': 'vertical',
          'overflow': 'hidden',
        },
        '.truncate-3': {
          'display': '-webkit-box',
          '-webkit-line-clamp': '3',
          '-webkit-box-orient': 'vertical',
          'overflow': 'hidden',
        },

        // Utilidades para glassmorphism
        '.glass': {
          'background': 'rgba(255, 255, 255, 0.15)',
          'backdrop-filter': 'blur(10px)',
          'border': '1px solid rgba(255, 255, 255, 0.18)',
        },

        // Utilidades para estados de loading
        '.loading-shimmer': {
          'background': 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
          'background-size': '200% 100%',
          'animation': 'shimmer 1.5s infinite',
        },
      });

      // **COMPONENTES PERSONALIZADOS**
      addComponents({
        // Botón base
        '.btn': {
          'display': 'inline-flex',
          'align-items': 'center',
          'justify-content': 'center',
          'font-weight': theme('fontWeight.medium'),
          'text-decoration': 'none',
          'transition': 'all 0.2s ease-in-out',
          'border-radius': theme('borderRadius.md'),
          'cursor': 'pointer',
          'user-select': 'none',
          '&:disabled': {
            'opacity': '0.5',
            'cursor': 'not-allowed',
          },
        },

        // Variantes de botones
        '.btn-primary': {
          'background-color': theme('colors.indigo.600'),
          'color': theme('colors.white'),
          '&:hover:not(:disabled)': {
            'background-color': theme('colors.indigo.700'),
            'transform': 'translateY(-1px)',
          },
          '&:active': {
            'transform': 'translateY(0)',
          },
        },

        '.btn-secondary': {
          'background-color': theme('colors.gray.200'),
          'color': theme('colors.gray.800'),
          '&:hover:not(:disabled)': {
            'background-color': theme('colors.gray.300'),
          },
        },

        '.btn-outline': {
          'background-color': 'transparent',
          'border': `1px solid ${theme('colors.gray.300')}`,
          'color': theme('colors.gray.700'),
          '&:hover:not(:disabled)': {
            'background-color': theme('colors.gray.50'),
            'border-color': theme('colors.gray.400'),
          },
        },

        // Card base
        '.card': {
          'background-color': theme('colors.white'),
          'border-radius': theme('borderRadius.lg'),
          'box-shadow': theme('boxShadow.card'),
          'overflow': 'hidden',
          'transition': 'all 0.3s ease-in-out',
          '&:hover': {
            'box-shadow': theme('boxShadow.card-hover'),
          },
        },

        // Product card específico
        '.product-card': {
          'background-color': theme('colors.white'),
          'border-radius': theme('borderRadius.lg'),
          'box-shadow': theme('boxShadow.product-card'),
          'overflow': 'hidden',
          'transition': 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          'cursor': 'pointer',
          '&:hover': {
            'box-shadow': theme('boxShadow.product-card-hover'),
            'transform': 'translateY(-2px) scale(1.01)',
          },
        },

        // Modal base
        '.modal': {
          'position': 'fixed',
          'inset': '0',
          'z-index': theme('zIndex.50'),
          'display': 'flex',
          'align-items': 'center',
          'justify-content': 'center',
          'padding': theme('spacing.4'),
          'background-color': 'rgba(0, 0, 0, 0.5)',
          'backdrop-filter': 'blur(4px)',
        },

        '.modal-content': {
          'background-color': theme('colors.white'),
          'border-radius': theme('borderRadius.xl'),
          'box-shadow': theme('boxShadow.modal'),
          'max-height': '90vh',
          'overflow-y': 'auto',
          'animation': 'modalIn 0.3s ease-out',
        },

        // Input base
        '.input': {
          'width': '100%',
          'padding': `${theme('spacing.2')} ${theme('spacing.3')}`,
          'border': `1px solid ${theme('colors.gray.300')}`,
          'border-radius': theme('borderRadius.md'),
          'font-size': theme('fontSize.sm'),
          'transition': 'all 0.2s ease-in-out',
          '&:focus': {
            'outline': 'none',
            'border-color': theme('colors.indigo.500'),
            'box-shadow': `0 0 0 3px ${theme('colors.indigo.500')}20`,
          },
          '&:disabled': {
            'background-color': theme('colors.gray.100'),
            'cursor': 'not-allowed',
          },
        },

        // Badge/Tag base
        '.badge': {
          'display': 'inline-flex',
          'align-items': 'center',
          'padding': `${theme('spacing.1')} ${theme('spacing.2')}`,
          'font-size': theme('fontSize.xs'),
          'font-weight': theme('fontWeight.medium'),
          'border-radius': theme('borderRadius.full'),
          'white-space': 'nowrap',
        },

        // Estados de badge
        '.badge-success': {
          'background-color': theme('colors.success.100'),
          'color': theme('colors.success.800'),
        },

        '.badge-warning': {
          'background-color': theme('colors.warning.100'),
          'color': theme('colors.warning.800'),
        },

        '.badge-error': {
          'background-color': theme('colors.error.100'),
          'color': theme('colors.error.800'),
        },

        '.badge-info': {
          'background-color': theme('colors.info.100'),
          'color': theme('colors.info.800'),
        },
      });
    },
  ],

  // **CONFIGURACIÓN DE PURGE OPTIMIZADA**
  corePlugins: {
    // Habilitar todas las funcionalidades core
    preflight: true,
  },

  // **VARIABLES CSS PERSONALIZADAS** (se pueden usar con CSS variables)
  experimental: {
    optimizeUniversalDefaults: true,
  },
};