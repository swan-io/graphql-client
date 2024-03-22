import { graphql } from "gql.tada";

const IdentificationLevels = graphql(`
  fragment IdentificationLevels on IdentificationLevels {
    expert
    PVID
    QES
  }
`);

const UserInfo = graphql(
  `
    fragment UserInfo on User {
      id
      firstName
      lastName
      identificationLevels {
        ...IdentificationLevels
      }
    }
  `,
  [IdentificationLevels],
);

export const appQuery = graphql(
  `
    query App($id: ID!) {
      accountMembership(id: $id) {
        id
        user {
          id
          ...UserInfo
        }
      }
      accountMemberships(first: 2) {
        edges {
          node {
            id
            account {
              name
            }
            membershipUser: user {
              id
              lastName
            }
          }
        }
      }
      supportingDocumentCollection(id: "e8d38e87-9862-47ef-b749-212ed566b955") {
        __typename
        supportingDocuments {
          __typename
          id
          createdAt
        }
        id
      }
    }
  `,
  [UserInfo],
);

export const getAppQueryResponse = ({
  user2LastName,
  user1IdentificationLevels,
}: {
  user2LastName: string;
  user1IdentificationLevels: {
    expert: boolean;
    PVID: boolean;
    QES: boolean;
  } | null;
}) => ({
  __typename: "Query",
  accountMembership: {
    __typename: "AccountMembership",
    id: "account-membership-1",
    user: {
      __typename: "User",
      id: "user-1",
      firstName: "Matthias",
      lastName: "Le Brun",
      identificationLevels: user1IdentificationLevels,
    },
  },
  accountMemberships: {
    __typename: "AccountMembershipConnection",
    edges: [
      {
        __typename: "AccountMembershipEdge",
        node: {
          __typename: "AccountMembership",
          id: "account-membership-1",
          account: {
            __typename: "Account",
            name: "First",
          },
          membershipUser: {
            __typename: "User",
            id: "user-1",
            lastName: "Le Brun",
          },
        },
      },
      {
        __typename: "AccountMembershipEdge",
        node: {
          __typename: "AccountMembership",
          id: "account-membership-2",
          account: {
            __typename: "Account",
            name: "Second",
          },
          membershipUser: {
            __typename: "User",
            id: "user-2",
            lastName: user2LastName,
          },
        },
      },
    ],
  },
  supportingDocumentCollection: {
    __typename: "SupportingDocumentCollection",
    supportingDocuments: [
      {
        __typename: "SupportingDocument",
        id: "supporting-document-1",
        createdAt: "2024-03-14T12:06:10.857Z",
      },
    ],
    id: "supporting-document-collection-1",
  },
});

export const bindAccountMembershipMutation = graphql(
  `
    mutation BindAccountMembership($id: ID!) {
      bindAccountMembership(input: { accountMembershipId: $id }) {
        ... on BindAccountMembershipSuccessPayload {
          accountMembership {
            id
            user {
              ...UserInfo
            }
          }
        }
        ... on Rejection {
          message
        }
      }
    }
  `,
  [UserInfo],
);

export const bindMembershipMutationRejectionResponse = {
  __typename: "Mutation",
  bindAccountMembership: {
    __typename: "BadAccountStatusRejection",
    message: "Account is in invalid status",
  },
};

export const bindMembershipMutationSuccessResponse = {
  __typename: "Mutation",
  bindAccountMembership: {
    __typename: "BindAccountMembershipSuccessPayload",
    accountMembership: {
      __typename: "AccountMembership",
      id: "account-membership-2",
      user: {
        __typename: "User",
        id: "user-2",
        firstName: "Mathieu",
        lastName: "Acthernoene",
        identificationLevels: {
          expert: true,
          PVID: true,
          QES: false,
        },
      },
    },
  },
};
