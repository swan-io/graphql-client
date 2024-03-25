import { AsyncData, Result } from "@swan-io/boxed";
import { useState } from "react";
import { P, match } from "ts-pattern";
import { ClientError, useQuery } from "../../src";
import { graphql } from "../graphql";
import { UserCard } from "./UserCard";

export const accountMembershipDetailQuery = graphql(`
  query AccountMembershipDetail($accountMembershipId: ID!) {
    accountMembership(id: $accountMembershipId) {
      id
      user {
        id
        firstName
        lastName
      }
    }
  }
`);

type Props = {
  accountMembershipId: string;
  onPressClose: () => void;
};

export const AccountMembershipDetail = ({
  accountMembershipId,
  onPressClose,
}: Props) => {
  const [data] = useQuery(
    accountMembershipDetailQuery,
    { accountMembershipId },
    { optimize: true },
  );

  const [showDetails, setShowDetails] = useState(false);

  return match(data)
    .with(AsyncData.P.NotAsked, () => "Nothing")
    .with(AsyncData.P.Loading, () => "Loading")
    .with(AsyncData.P.Done(Result.P.Error(P.select())), (error) => {
      ClientError.forEach(error, (error) => console.error(error));
      return "Error";
    })
    .with(
      AsyncData.P.Done(Result.P.Ok(P.select())),
      ({ accountMembership }) => {
        if (accountMembership == null) {
          return <div>No membership</div>;
        }
        return (
          <dialog open={true}>
            <button onClick={onPressClose}>Close</button>
            <div>
              <strong>Membership: {accountMembership.id}</strong>

              {showDetails ? (
                <UserCard accountMembershipId={accountMembership.id} />
              ) : (
                <button onClick={() => setShowDetails(true)}>
                  Show user info
                </button>
              )}
            </div>
          </dialog>
        );
      },
    )
    .exhaustive();
};
