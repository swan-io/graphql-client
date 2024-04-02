/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.

 Create as many sidebars as you want.
 */

// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  docs: [
    {
      type: "doc",
      id: "getting-started",
    },
    {
      type: "doc",
      id: "use-query",
    },
    {
      type: "doc",
      id: "use-deferred-query",
    },
    {
      type: "doc",
      id: "use-mutation",
    },
    {
      type: "doc",
      id: "client",
    },
    {
      type: "doc",
      id: "pagination",
    },
  ],
};

export default sidebars;
