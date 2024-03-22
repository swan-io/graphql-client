import { FragmentOf, readFragment } from "gql.tada";
import { graphql } from "../graphql";
import {
  AccountMembership,
  accountMembershipFragment,
} from "./AccountMembership";
import { useForwardPagination } from "../../src/react/usePagination";

export const accountMembershipListFragment = graphql(
  `
    fragment AccountMembershipList on AccountMembershipConnection {
      edges {
        node {
          id
          ...AccountMembership
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
      totalCount
    }
  `,
  [accountMembershipFragment]
);

type Props = {
  data: FragmentOf<typeof accountMembershipListFragment>;
  onPressNextPage: (cursor: string | null) => void;
  isLoading: boolean;
};

export const AccountMembershipList = ({
  data,
  onPressNextPage,
  isLoading,
}: Props) => {
  const transactions = useForwardPagination(
    readFragment(accountMembershipListFragment, data)
  );

  return (
    <div>
      <h1>Memberships</h1>
      <div>
        <div>Total: {transactions.totalCount}</div>

        <div>
          {transactions.edges.map((data) => {
            return <AccountMembership key={data.node.id} data={data.node} />;
          })}
        </div>

        {isLoading ? <div>Loading next results …</div> : null}

        <button
          disabled={!transactions.pageInfo.hasNextPage}
          onClick={() => onPressNextPage(transactions.pageInfo.endCursor)}
        >
          Load next page
        </button>
      </div>
    </div>
  );
};
