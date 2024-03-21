import { FragmentOf, readFragment } from "gql.tada";
import { graphql } from "../graphql";

export const transactionFragment = graphql(`
  fragment Transaction on Transaction {
    id
    amount {
      value
      currency
    }
    label
  }
`);

type Props = {
  data: FragmentOf<typeof transactionFragment>;
};

export const Transaction = ({ data }: Props) => {
  const transaction = readFragment(transactionFragment, data);

  return (
    <div className="Transaction">
      <strong>{transaction.label}</strong> for{" "}
      <strong>
        {transaction.amount.value}
        {transaction.amount.currency}
      </strong>
    </div>
  );
};
