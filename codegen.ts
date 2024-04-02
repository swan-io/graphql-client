import { type CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  schema: "https://swapi-graphql.netlify.app/.netlify/functions/index",
  documents: ["example/components/**/*.tsx"],
  generates: {
    "./example/gql/": {
      preset: "client",
    },
  },
  hooks: { afterAllFileWrite: ["prettier --write"] },
};

export default config;
