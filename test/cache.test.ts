import { Option, Result } from "@swan-io/boxed";
import { expect, test } from "vitest";
import { ClientCache } from "../src/cache/cache";
import { readOperationFromCache } from "../src/cache/read";
import { writeOperationToCache } from "../src/cache/write";
import { addTypenames, inlineFragments } from "../src/graphql/ast";
import {
  appQuery,
  bindAccountMembershipMutation,
  bindMembershipMutationRejectionResponse,
  bindMembershipMutationSuccessResponse,
  getAppQueryResponse,
} from "./data";

test("Write & read in cache", () => {
  const cache = new ClientCache();

  const preparedAppQuery = inlineFragments(addTypenames(appQuery));

  writeOperationToCache(
    cache,
    preparedAppQuery,
    getAppQueryResponse({
      user2LastName: "Last",
      user1IdentificationLevels: null,
    }),
    {
      id: "1",
    },
  );

  expect(cache.dump()).toMatchSnapshot();

  expect(
    readOperationFromCache(cache, preparedAppQuery, {
      id: "1",
    }),
  ).toMatchObject(
    Option.Some(
      Result.Ok(
        getAppQueryResponse({
          user2LastName: "Last",
          user1IdentificationLevels: null,
        }),
      ),
    ),
  );

  const preparedBindAccountMembershipMutation = inlineFragments(
    addTypenames(bindAccountMembershipMutation),
  );

  writeOperationToCache(
    cache,
    preparedBindAccountMembershipMutation,
    bindMembershipMutationRejectionResponse,
    {
      id: "account-membership-2",
    },
  );

  expect(
    readOperationFromCache(cache, preparedAppQuery, {
      id: "1",
    }),
  ).toMatchObject(
    Option.Some(
      Result.Ok(
        getAppQueryResponse({
          user2LastName: "Last",
          user1IdentificationLevels: null,
        }),
      ),
    ),
  );

  writeOperationToCache(
    cache,
    preparedBindAccountMembershipMutation,
    bindMembershipMutationSuccessResponse,
    {
      id: "account-membership-2",
    },
  );

  expect(cache.dump()).toMatchSnapshot();

  expect(
    readOperationFromCache(cache, preparedAppQuery, {
      id: "1",
    }),
  ).toMatchObject(
    Option.Some(
      Result.Ok(
        getAppQueryResponse({
          user2LastName: "Acthernoene",
          user1IdentificationLevels: null,
        }),
      ),
    ),
  );

  writeOperationToCache(
    cache,
    preparedAppQuery,
    getAppQueryResponse({
      user2LastName: "Acthernoene",
      user1IdentificationLevels: {
        expert: true,
        PVID: true,
        QES: true,
      },
    }),
    {
      id: "1",
    },
  );

  expect(cache.dump()).toMatchSnapshot();

  expect(
    readOperationFromCache(cache, preparedAppQuery, {
      id: "1",
    }),
  ).toMatchObject(
    Option.Some(
      Result.Ok(
        getAppQueryResponse({
          user2LastName: "Acthernoene",
          user1IdentificationLevels: {
            expert: true,
            PVID: true,
            QES: true,
          },
        }),
      ),
    ),
  );

  const values = Option.all([
    readOperationFromCache(cache, preparedAppQuery, {
      id: "1",
    }),
    readOperationFromCache(cache, preparedAppQuery, {
      id: "1",
    }),
  ]);

  if (values.isSome()) {
    const [a, b] = values.get();
    expect(a).toBe(b);
  } else {
    expect(true).toBe(false);
  }
});
