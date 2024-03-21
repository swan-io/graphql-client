import { graphql } from "../graphql";
import { useQuery } from "../../src";
import { P, match } from "ts-pattern";
import { AsyncData, Result } from "@swan-io/boxed";
import { TransactionList, transactionListFragment } from "./TransactionList";
import { useState } from "react";

const transactionListQuery = graphql(
  `
    query App($accountMembershipId: ID!, $after: String) {
      accountMembership(id: $accountMembershipId) {
        account {
          transactions(first: 20, after: $after) {
            ...TransactionList
          }
        }
      }
    }
  `,
  [transactionListFragment]
);

export const App = () => {
  const [after, setAfter] = useState<string | null>(null);
  const [data] = useQuery(transactionListQuery, {
    accountMembershipId: "fa3a2485-43bc-461e-b38c-5a9bc3750c7d",
    after,
  });

  return (
    <div>
      {match(data)
        .with(AsyncData.P.NotAsked, () => "Nothing")
        .with(AsyncData.P.Loading, () => "Loading")
        .with(AsyncData.P.Done(Result.P.Error(P.select())), (error) => {
          console.error(error);
          return "Error";
        })
        .with(
          AsyncData.P.Done(Result.P.Ok(P.select())),
          ({ accountMembership }) => {
            if (accountMembership?.account == null) {
              return <div>No membership</div>;
            }

            if (accountMembership.account.transactions == null) {
              return <div>No transactions</div>;
            }
            return (
              <TransactionList
                data={accountMembership.account.transactions}
                onPressNextPage={setAfter}
              />
            );
          }
        )
        .exhaustive()}
    </div>
  );
};
