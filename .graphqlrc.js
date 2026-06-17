import {getSchema} from '@shopify/hydrogen-codegen';

/**
 * GraphQL Config
 * @see https://the-guild.dev/graphql/config/docs/user/usage
 * @type {IGraphQLConfig}
 */
const graphqlConfig = {
  projects: {
    default: {
      schema: getSchema('storefront'),
      documents: [
        './*.{ts,tsx,js,jsx}',
        './app/**/*.{ts,tsx,js,jsx}',
        '!./app/graphql/**/*.{ts,tsx,js,jsx}',
      ],
    },

    // Customer Account API is unused (quote-only store; custom auth handles
    // accounts). Add your own GraphQL projects here for CMS, Admin API, etc.
  },
};

export default graphqlConfig;

/** @typedef {import('graphql-config').IGraphQLConfig} IGraphQLConfig */
