// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const lightCodeTheme = require('prism-react-renderer').themes.github;
const darkCodeTheme  = require('prism-react-renderer').themes.dracula;

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'pdf-signature',
  tagline: 'Legal PDF e-signatures in one line of code',
  favicon: 'img/favicon.ico',

  url: 'https://docs.pdf-signature.dev',
  baseUrl: '/',

  organizationName: 'pdf-signature',
  projectName: 'pdf-signature',

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: require.resolve('./sidebars.js'),
          editUrl: 'https://github.com/pdf-signature/pdf-signature/tree/main/apps/docs/',
          routeBasePath: '/',
          showLastUpdateAuthor: true,
          showLastUpdateTime: true,
        },
        blog: false,
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
        sitemap: {
          changefreq: 'weekly',
          priority: 0.5,
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      image: 'img/og-image.png',
      navbar: {
        title: 'pdf-signature',
        logo: {
          alt: 'pdf-signature Logo',
          src: 'img/logo.svg',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'docsSidebar',
            position: 'left',
            label: 'Docs',
          },
          {
            href: 'https://pdf-signature.dev/dashboard',
            label: 'Dashboard',
            position: 'right',
          },
          {
            href: 'https://github.com/pdf-signature/pdf-signature',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },

      footer: {
        style: 'dark',
        links: [
          {
            title: 'Docs',
            items: [
              { label: 'Getting Started',   to: '/getting-started' },
              { label: 'API Reference',      to: '/api-reference' },
              { label: 'Legal Compliance',   to: '/legal-compliance' },
            ],
          },
          {
            title: 'Examples',
            items: [
              { label: 'Next.js',    to: '/examples/nextjs' },
              { label: 'Express',    to: '/examples/express' },
              { label: 'Webhooks',   to: '/examples/webhooks' },
            ],
          },
          {
            title: 'Company',
            items: [
              { label: 'Dashboard', href: 'https://pdf-signature.dev/dashboard' },
              { label: 'Pricing',   href: 'https://pdf-signature.dev/pricing' },
              { label: 'GitHub',    href: 'https://github.com/pdf-signature/pdf-signature' },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} pdf-signature. Built with Docusaurus.`,
      },

      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
        additionalLanguages: ['typescript', 'bash', 'json', 'docker', 'yaml'],
      },

      colorMode: {
        defaultMode: 'light',
        disableSwitch: false,
        respectPrefersColorScheme: true,
      },

      algolia: {
        // Replace with real credentials when Algolia DocSearch is configured
        appId: 'YOUR_APP_ID',
        apiKey: 'YOUR_SEARCH_API_KEY',
        indexName: 'pdf-signature',
        contextualSearch: true,
      },
    }),

  plugins: [
    [
      '@docusaurus/plugin-ideal-image',
      { quality: 70, max: 1030, min: 640, steps: 2, disableInDev: false },
    ],
  ],
};

module.exports = config;
