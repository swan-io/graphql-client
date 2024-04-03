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

const CompleteUserInfo = graphql(
  `
    fragment CompleteUserInfo on User {
      id
      firstName
      lastName
      birthDate
      mobilePhoneNumber
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

export const otherAppQuery = graphql(
  `
    query App($id: ID!) {
      accountMembership(id: $id) {
        id
        user {
          id
          ...CompleteUserInfo
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
  [CompleteUserInfo],
);

export const appQueryWithExtraArrayInfo = graphql(
  `
    query App($id: ID!) {
      accountMembership(id: $id) {
        id
        user {
          id
          ...CompleteUserInfo
        }
      }
      accountMemberships(first: 2) {
        edges {
          node {
            id
            createdAt
            account {
              name
              bankDetails
            }
            membershipUser: user {
              id
              lastName
              firstName
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
  [CompleteUserInfo],
);

export const getAppQueryResponse = ({
  user2LastName,
  user1IdentificationLevels,
}: {
  user2LastName: string;
  user1IdentificationLevels: {
    __typename: "IdentificationLevels";
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

export const OnboardingInfo = graphql(
  `
    query GetOnboarding($id: ID!, $language: String!) {
      __typename
      onboardingInfo(id: $id) {
        __typename
        ...OnboardingData
      }
    }
    fragment SupportingDocument on SupportingDocument {
      __typename
      id
      supportingDocumentPurpose
      supportingDocumentType
      updatedAt
      statusInfo {
        __typename
        status
        ... on SupportingDocumentUploadedStatusInfo {
          __typename
          downloadUrl
          filename
        }
        ... on SupportingDocumentValidatedStatusInfo {
          __typename
          downloadUrl
          filename
        }
        ... on SupportingDocumentRefusedStatusInfo {
          __typename
          downloadUrl
          reason
          filename
        }
      }
    }
    fragment IndividualAccountHolder on OnboardingIndividualAccountHolderInfo {
      __typename
      residencyAddress {
        __typename
        addressLine1
        addressLine2
        city
        country
        postalCode
        state
      }
      taxIdentificationNumber
      employmentStatus
      monthlyIncome
    }
    fragment UBO on IndividualUltimateBeneficialOwner {
      __typename
      firstName
      lastName
      birthDate
      birthCountryCode
      birthCity
      birthCityPostalCode
      info {
        __typename
        type
        ... on IndividualUltimateBeneficialOwnerTypeHasCapital {
          __typename
          indirect
          direct
          totalCapitalPercentage
        }
      }
      taxIdentificationNumber
      residencyAddress {
        __typename
        addressLine1
        addressLine2
        city
        country
        postalCode
        state
      }
    }
    fragment CompanyAccountHolder on OnboardingCompanyAccountHolderInfo {
      __typename
      taxIdentificationNumber
      residencyAddress {
        __typename
        addressLine1
        addressLine2
        city
        country
        postalCode
        state
      }
      legalRepresentativePersonalAddress {
        __typename
        addressLine1
        addressLine2
        city
        country
        postalCode
        state
      }
      businessActivity
      businessActivityDescription
      companyType
      isRegistered
      monthlyPaymentVolume
      name
      typeOfRepresentation
      registrationNumber
      vatNumber
      individualUltimateBeneficialOwners {
        __typename
        ...UBO
      }
    }
    fragment OnboardingInvalidInfo on OnboardingStatusInfo {
      __typename
      ... on OnboardingInvalidStatusInfo {
        __typename
        errors {
          __typename
          field
          errors
        }
      }
      ... on OnboardingFinalizedStatusInfo {
        __typename
      }
      ... on OnboardingValidStatusInfo {
        __typename
      }
    }
    fragment OnboardingData on OnboardingInfo {
      __typename
      id
      accountCountry
      email
      language
      redirectUrl
      tcuUrl
      legalRepresentativeRecommendedIdentificationLevel
      oAuthRedirectParameters {
        __typename
        redirectUrl
      }
      onboardingState
      projectInfo {
        __typename
        id
        accentColor
        name
        logoUri
        tcuDocumentUri(language: $language)
      }
      supportingDocumentCollection {
        __typename
        id
        requiredSupportingDocumentPurposes {
          __typename
          name
        }
        statusInfo {
          __typename
          status
        }
        supportingDocuments {
          __typename
          ...SupportingDocument
        }
      }
      info {
        __typename
        ... on OnboardingIndividualAccountHolderInfo {
          __typename
          ...IndividualAccountHolder
        }
        ... on OnboardingCompanyAccountHolderInfo {
          __typename
          ...CompanyAccountHolder
        }
      }
      statusInfo {
        __typename
        ...OnboardingInvalidInfo
      }
    }
  `,
  [IdentificationLevels],
);

export const onboardingInfoResponse = {
  __typename: "Query",
  onboardingInfo: {
    __typename: "OnboardingInfo",
    id: "d26ed1ed-5f70-4096-9d8e-27ef258e26fa",
    accountCountry: "FRA",
    email: null,
    language: null,
    redirectUrl: "",
    tcuUrl:
      "https://document-factory.sandbox.master.oina.ws/swanTCU/7649fada-a1c8-4537-bd3c-d539664a841c.pdf?Expires=1712229767&Key-Pair-Id=KTRMJ5W6BT4MH&Signature=eRpFq3ChqRx7KUVM5bhzPoX7uIxaCyJycw~wTAPDKslc-oq4OwKCrB1mm8efx~wdwuauT0b80EoPidCsoMEdYKvT7LE-H12HKizLYaHXxVNevmWZMR2zqN1v9bi77oIhVEQZmV9uGCluDypvWQn9eu3ICOMJr8k0dn7f4K0jQyAMju1AqBg3~jeeAbOD1Y0hA0T2zeJ~OLDahJB54kFDt~UbdwEylgjh1V-tg5GvXs1w268aax98DpHrORttnaSTLvB7PlMIJJbgQIy712OO2~zg6dggMSlWHk0J3243xsd65eWhLPeLVt8jlnYBMvc0Iscd4k12iVWKWRozckglNQ__",
    legalRepresentativeRecommendedIdentificationLevel: "PVID",
    oAuthRedirectParameters: null,
    onboardingState: "Ongoing",
    projectInfo: {
      __typename: "ProjectInfo",
      id: "64060573-f0ec-4204-ad49-a3983497ada4",
      accentColor: "#38945D",
      name: "bloodyowl",
      logoUri:
        "https://s3.eu-west-1.amazonaws.com/data.master.oina.ws/64060573-f0ec-4204-ad49-a3983497ada4/SANDBOX/logo-5733f69e-8223-4b7e-92c7-0fed9eaaca33.png",
      tcuDocumentUri:
        "https://s3.eu-west-1.amazonaws.com/data.master.oina.ws/64060573-f0ec-4204-ad49-a3983497ada4/SANDBOX/tcu/bb87c4f2-de5f-4df7-b617-91f2c0eb03f4/en.pdf",
    },
    supportingDocumentCollection: {
      __typename: "SupportingDocumentCollection",
      id: "55561d8f-6a90-41f2-be48-e14c82e3cc34",
      requiredSupportingDocumentPurposes: [],
      statusInfo: {
        __typename: "SupportingDocumentCollectionWaitingForDocumentStatusInfo",
        status: "WaitingForDocument",
      },
      supportingDocuments: [],
    },
    info: {
      __typename: "OnboardingIndividualAccountHolderInfo",
      residencyAddress: {
        __typename: "AddressInfo",
        addressLine1: null,
        addressLine2: null,
        city: null,
        country: null,
        postalCode: null,
        state: null,
      },
      taxIdentificationNumber: null,
      employmentStatus: null,
      monthlyIncome: null,
    },
    statusInfo: {
      __typename: "OnboardingInvalidStatusInfo",
      errors: [
        {
          __typename: "ValidationError",
          field: "email",
          errors: ["Missing"],
        },
        {
          __typename: "ValidationError",
          field: "employmentStatus",
          errors: ["Missing"],
        },
        {
          __typename: "ValidationError",
          field: "monthlyIncome",
          errors: ["Missing"],
        },
        {
          __typename: "ValidationError",
          field: "language",
          errors: ["Missing"],
        },
        {
          __typename: "ValidationError",
          field: "residencyAddress.addressLine1",
          errors: ["Missing"],
        },
        {
          __typename: "ValidationError",
          field: "residencyAddress.city",
          errors: ["Missing"],
        },
        {
          __typename: "ValidationError",
          field: "residencyAddress.country",
          errors: ["Missing"],
        },
        {
          __typename: "ValidationError",
          field: "residencyAddress.postalCode",
          errors: ["Missing"],
        },
      ],
    },
  },
};

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
          __typename: "IdentificationLevels",
          expert: true,
          PVID: true,
          QES: false,
        },
      },
    },
  },
};
