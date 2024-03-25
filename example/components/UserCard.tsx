import { AsyncData, Result } from "@swan-io/boxed";
import { P, match } from "ts-pattern";
import { ClientError, useQuery } from "../../src";
import { graphql } from "../graphql";

export const accountMembershipUserDetailQuery = graphql(`
  query AccountMembershipUserDetail($accountMembershipId: ID!) {
    accountMembership(id: $accountMembershipId) {
      id
      user {
        id
        firstName
        lastName
        birthDate
        mobilePhoneNumber
      }
    }
  }
`);

type Props = {
  accountMembershipId: string;
};

const formatter = new Intl.DateTimeFormat();

export const UserCard = ({ accountMembershipId }: Props) => {
  const [data] = useQuery(
    accountMembershipUserDetailQuery,
    {
      accountMembershipId,
    },
    { optimize: true },
  );

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
          return null;
        }
        const user = accountMembership.user;
        if (user == null) {
          return <div>No user</div>;
        }
        return (
          <div className="User">
            <ul>
              <li>
                <strong>ID:</strong> {user.id}
              </li>
              <li>
                <strong>First name:</strong> {user.firstName}
              </li>
              <li>
                <strong>Last name:</strong> {user.lastName}
              </li>
              {user.birthDate != null ? (
                <li>
                  <strong>Birthdate:</strong>{" "}
                  {formatter.format(new Date(user.birthDate))}
                </li>
              ) : null}
              <li>
                <strong>Mobile phone number:</strong> {user.mobilePhoneNumber}
              </li>
            </ul>
          </div>
        );
      },
    )
    .exhaustive();
};
