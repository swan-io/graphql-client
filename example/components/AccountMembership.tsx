import { FragmentOf, readFragment } from "gql.tada";
import { useState } from "react";
import { P, match } from "ts-pattern";
import { graphql } from "../graphql";
import { AccountMembershipDetail } from "./AccountMembershipDetail";

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

  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div className="AccountMembership" onClick={() => setIsOpen(true)}>
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
      {isOpen ? (
        <AccountMembershipDetail
          accountMembershipId={accountMembership.id}
          onPressClose={() => setIsOpen(false)}
        />
      ) : null}
    </>
  );
};
