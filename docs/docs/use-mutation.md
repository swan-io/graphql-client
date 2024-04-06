---
title: useMutation
sidebar_label: useMutation
---

## useMutation(mutation, config?)

### Params

- `mutation`: your mutation document node
- `config`:
  - `connectionUpdates`: configuration to prepend/append/remove edges from connections on mutation

### Returns

This hook returns a tuple you can extract like a `useState`:

```ts
const [commitMutation, mutationData] = useMutation(...)
```

- `commitMutation(variables)`: function commit the mutation, returns a `Future<Result<Data, ClientError>>`
- `mutationData` (`AsyncData<Result<Data, ClientError>>`): the mutation data

## Example

```ts
import { useMutation } from "@swan-io/graphql-client";
// ...

const updateUsernameMutation = graphql(`
  mutation UpdateUsername($userId: ID!, $username: String!) {
    updateUsername(id: $userId, username: $username) {
      ... on UpdateUsernameSuccessPayload {
        user {
          id
          username
          avatar
        }
      }
      ... on InvalidUsernameRejection {
        message
      }
    }
  }
`);

type Props = {
  userId: string;
};

const UserPage = ({ userId }: Props) => {
  const [updateUsername, usernameUpdate] = useMutation(updateUsernameMutation);
  const [username, setUsername] = useState("");

  // ...
  const onSubmit = (event) => {
    event.preventDefault();
    updateUsername({ userId, username });
  };

  const isLoading = usernameUpdate.isLoading();

  return (
    <form onSubmit={onSubmit}>
      <input
        value={username}
        readOnly={isLoading}
        onChange={(event) => setUsername(event.target.value)}
      />

      <button type="submit" readOnly={isLoading}>
        Submit
      </button>
    </form>
  );
};
```

## Handling connections

```ts
useMutation(BlockUser, {
  connectionUpdates: [
    ({ data, append }) =>
      Option.fromNullable(data.blockUser).map(({ user }) =>
        append(blockedUsers, [user]),
      ),
    ({ data, prepend }) =>
      Option.fromNullable(data.blockUser).map(({ user }) =>
        prepend(lastBlockedUsers, [user]),
      ),
  ],
});

useMutation(Unfriend, {
  connectionUpdates: [
    ({ data, variables, remove }) =>
      Option.fromNullable(data.unfriend).map(() =>
        remove(friends, [variables.id]),
      ),
  ],
});
```
