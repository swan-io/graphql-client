import { FragmentOf, readFragment } from "gql.tada";
import { P, match } from "ts-pattern";
import { graphql } from "../graphql";

export const accountMembershipFragment = graphql(`
  fragment AccountMembership on AccountMembership {
    id
    user {
      id
      firstName
      lastName
    }
    statusInfo {
      __typename
      status
      ... on AccountMembershipBindingUserErrorStatusInfo {
        restrictedTo {
          firstName
          lastName
        }
      }
      ... on AccountMembershipInvitationSentStatusInfo {
        restrictedTo {
          firstName
          lastName
        }
      }
    }
  }
`);

type Props = {
  data: FragmentOf<typeof accountMembershipFragment>;
};

export const AccountMembership = ({ data }: Props) => {
  const accountMembership = readFragment(accountMembershipFragment, data);

  return (
    <div className="AccountMembership">
      <strong>{accountMembership.id}</strong>:
      {match(accountMembership)
        .with(
          { user: { firstName: P.string, lastName: P.string } },
          ({ user: { firstName, lastName } }) => `${firstName} ${lastName}`,
        )
        .with(
          {
            statusInfo: {
              restrictedTo: { firstName: P.string, lastName: P.string },
            },
          },
          ({
            statusInfo: {
              restrictedTo: { firstName, lastName },
            },
          }) => `${firstName} ${lastName} (restricted to)`,
        )
        .otherwise(() => "No user")}
    </div>
  );
};
