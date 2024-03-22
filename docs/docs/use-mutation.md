---
title: useMutation
sidebar_label: useMutation
---

## useMutation(mutation)

### Params

- `mutation`: your mutation document node

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
