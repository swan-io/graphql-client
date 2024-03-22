import { AsyncData, Result } from "@swan-io/boxed";
import { useCallback, useState } from "react";
import { P, match } from "ts-pattern";
import { ClientError, useQuery } from "../../src";
import { graphql } from "../graphql";
import {
  AccountMembershipList,
  accountMembershipListFragment,
} from "./AccountMembershipList";

const transactionListQuery = graphql(
  `
    query App($accountMembershipId: ID!, $after: String) {
      accountMembership(id: $accountMembershipId) {
        id
        account {
          memberships(first: 3, after: $after) {
            ...AccountMembershipList
          }
        }
      }
    }
  `,
  [accountMembershipListFragment],
);

export const App = () => {
  const [after, setAfter] = useState<string | null>(null);
  const [accountMembershipId, setAccountMembershipId] = useState(
    "fa3a2485-43bc-461e-b38c-5a9bc3750c7d",
  );
  const [suspense, setSuspense] = useState(false);
  const [optimize, setOptimize] = useState(false);

  const [data, { isLoading, reload, refresh }] = useQuery(
    transactionListQuery,
    {
      accountMembershipId,
      after,
    },
    { suspense, optimize },
  );

  const toggleAccountMembership = useCallback(() => {
    setAfter(null);
    setAccountMembershipId((currentAccountMembership) =>
      currentAccountMembership === "fa3a2485-43bc-461e-b38c-5a9bc3750c7d"
        ? "3c6cd099-02b5-4d05-86ae-364b72391070"
        : "fa3a2485-43bc-461e-b38c-5a9bc3750c7d",
    );
  }, []);

  return (
    <div>
      <header>
        <button onClick={toggleAccountMembership}>
          Toggle account membership
        </button>
        <button onClick={refresh}>Refresh</button>
        <button onClick={reload}>Reload</button>
        <label>
          <input
            type="checkbox"
            checked={suspense}
            onChange={() => setSuspense((x) => !x)}
          />
          Suspense
        </label>
        <label>
          <input
            type="checkbox"
            checked={optimize}
            onChange={() => setOptimize((x) => !x)}
          />
          Optimize
        </label>
      </header>

      {match(data)
        .with(AsyncData.P.NotAsked, () => "Nothing")
        .with(AsyncData.P.Loading, () => "Loading")
        .with(AsyncData.P.Done(Result.P.Error(P.select())), (error) => {
          ClientError.forEach(error, (error) => console.error(error));
          return "Error";
        })
        .with(
          AsyncData.P.Done(Result.P.Ok(P.select())),
          ({ accountMembership }) => {
            if (accountMembership?.account == null) {
              return <div>No membership</div>;
            }

            return (
              <div>
                <div>Account membership id: {accountMembership.id}</div>
                <AccountMembershipList
                  data={accountMembership.account.memberships}
                  onPressNextPage={setAfter}
                  isLoading={isLoading}
                />
              </div>
            );
          },
        )
        .exhaustive()}
    </div>
  );
};
