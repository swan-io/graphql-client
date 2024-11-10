// @ts-check
// `@type` JSDoc annotations allow editor autocompletion and type checking
// (when paired with `@ts-check`).
// There are various equivalent ways to declare your Docusaurus config.
// See: https://docusaurus.io/docs/api/docusaurus-config

import { themes as prismThemes } from "prism-react-renderer";

const url = "https://swan-io.github.io/graphql-client";

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: "GraphQL Client",
  tagline: "A simple GraphQL client for React",
  favicon: "img/favicon.png",

  // Set the production url of your site here
  url: "https://swan-io.github.io",
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: "/graphql-client/",

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: "swan-io", // Usually your GitHub org/user name.
  projectName: "graphql-client", // Usually your repo name.

  onBrokenLinks: "throw",
  onBrokenMarkdownLinks: "warn",

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  presets: [
    [
      "classic",
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          routeBasePath: "/",
          sidebarPath: "./sidebars.js",
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl: "https://github.com/swan-io/graphql-client/edit/main/docs/",
        },
        theme: {
          customCss: "./src/css/custom.css",
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      navbar: {
        title: "GraphQL Client",
        logo: {
          alt: "GraphQL Client",
          src: "img/logo.svg",
        },
        items: [
          {
            href: "/getting-started",
            label: "Getting started",
            position: "left",
          },
          {
            href: "https://github.com/swan-io/graphql-client",
            label: "GitHub",
            position: "right",
          },
        ],
      },
      footer: {
        logo: {
          alt: "Swan Open Source",
          src: "img/swan-opensource.svg",
          href: "https://swan.io",
          width: 116,
          height: 43,
        },
        style: "dark",
        copyright: `Copyright © ${new Date().getFullYear()} Swan`,
      },
      metadata: [
        { name: "twitter:card", content: "summary_large_image" },
        { property: "og:image", content: `${url}/img/social.png` },
        { property: "og:image:width", content: `1280` },
        { property: "og:image:height", content: `640` },
        { name: "twitter:image", content: `${url}/img/social.png` },
      ],
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
      },
    }),
};

export default config;
