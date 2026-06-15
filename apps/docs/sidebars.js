/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  docsSidebar: [
    {
      type: 'category',
      label: 'Introduction',
      collapsed: false,
      items: [
        { type: 'doc', id: 'getting-started', label: 'Getting Started' },
      ],
    },
    {
      type: 'category',
      label: 'Reference',
      items: [
        { type: 'doc', id: 'api-reference',     label: 'API Reference' },
        { type: 'doc', id: 'legal-compliance',  label: 'Legal Compliance' },
      ],
    },
    {
      type: 'category',
      label: 'Examples',
      items: [
        { type: 'doc', id: 'examples/nextjs',    label: 'Next.js' },
        { type: 'doc', id: 'examples/express',   label: 'Express' },
        { type: 'doc', id: 'examples/webhooks',  label: 'Webhooks' },
        { type: 'doc', id: 'examples/multi-sign', label: 'Multi-signer' },
      ],
    },
  ],
};

module.exports = sidebars;
