import { FragmentOf, readFragment } from "gql.tada";
import { graphql } from "../graphql";
import { Transaction, transactionFragment } from "./Transaction";
import { useAfterPagination } from "../../src/react/usePagination";

export const transactionListFragment = graphql(
  `
    fragment TransactionList on TransactionConnection {
      edges {
        node {
          id
          ...Transaction
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
      totalCount
    }
  `,
  [transactionFragment]
);

type Props = {
  data: FragmentOf<typeof transactionListFragment>;
  onPressNextPage: (cursor: string | null) => void;
};

export const TransactionList = ({ data, onPressNextPage }: Props) => {
  const transactions = useAfterPagination(
    readFragment(transactionListFragment, data)
  );

  return (
    <div>
      <h1>Transactions</h1>
      <div>
        <div>Total: {transactions.totalCount}</div>

        <div>
          {transactions.edges.map((data) => {
            return <Transaction key={data.node.id} data={data.node} />;
          })}
        </div>

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
