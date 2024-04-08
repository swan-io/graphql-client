import { Option, Result } from "@swan-io/boxed";
import { expect, test } from "vitest";
import { Connection } from "../src";
import { ClientCache } from "../src/cache/cache";
import { optimizeQuery, readOperationFromCache } from "../src/cache/read";
import { writeOperationToCache } from "../src/cache/write";
import { addTypenames, inlineFragments } from "../src/graphql/ast";
import { print } from "../src/graphql/print";
import {
  OnboardingInfo,
  addMembership,
  appQuery,
  appQueryWithExtraArrayInfo,
  appQueryWithMoreAccountInfo,
  appQueryWithoutMoreAccountInfo,
  bindAccountMembershipMutation,
  bindMembershipMutationRejectionResponse,
  bindMembershipMutationSuccessResponse,
  getAppQueryResponse,
  onboardingInfoResponse,
  otherAppQuery,
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

  const preparedOnboardingInfo = inlineFragments(addTypenames(OnboardingInfo));

  const preparedBindAccountMembershipMutation = inlineFragments(
    addTypenames(bindAccountMembershipMutation),
  );

  const preparedOtherAppQuery = inlineFragments(addTypenames(otherAppQuery));
  const preparedAppQueryWithExtraArrayInfo = inlineFragments(
    addTypenames(appQueryWithExtraArrayInfo),
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
        __typename: "IdentificationLevels",
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
            __typename: "IdentificationLevels",
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

  expect(
    optimizeQuery(cache, preparedOtherAppQuery, { id: "1" })
      .map(print)
      .getWithDefault("no delta"),
  ).toMatchSnapshot();

  expect(
    optimizeQuery(cache, preparedAppQueryWithExtraArrayInfo, { id: "1" })
      .map(print)
      .getWithDefault("no delta"),
  ).toMatchSnapshot();

  const cache2 = new ClientCache();

  writeOperationToCache(
    cache2,
    preparedOnboardingInfo,
    onboardingInfoResponse,
    {
      id: "d26ed1ed-5f70-4096-9d8e-27ef258e26fa",
      language: "en",
    },
  );

  expect(cache2.dump()).toMatchSnapshot();

  expect(
    readOperationFromCache(cache2, preparedOnboardingInfo, {
      id: "d26ed1ed-5f70-4096-9d8e-27ef258e26fa",
      language: "en",
    }),
  ).toMatchObject(Option.Some(Result.Ok(onboardingInfoResponse)));

  const cache3 = new ClientCache();

  writeOperationToCache(
    cache3,
    preparedAppQuery,
    getAppQueryResponse({
      user2LastName: "Last",
      user1IdentificationLevels: null,
    }),
    {
      id: "1",
    },
  );

  const read = readOperationFromCache(cache3, preparedAppQuery, {
    id: "1",
  });

  expect(
    readOperationFromCache(cache3, appQueryWithoutMoreAccountInfo, {}).isSome(),
  ).toBe(true);

  expect(
    readOperationFromCache(cache3, appQueryWithMoreAccountInfo, {}).isNone(),
  ).toBe(true);

  if (read.isSome()) {
    const cacheResult = read.get();
    if (cacheResult.isOk()) {
      const value = cacheResult.get() as ReturnType<typeof getAppQueryResponse>;
      const accountMemberships =
        value.accountMemberships as unknown as Connection<{
          __typename: "AccountMembership";
          id: string;
          account: {
            __typename: "Account";
            name: string;
          };
          membershipUser: {
            __typename: "User";
            id: string;
            lastName: string;
          };
        }>;
      cache3.updateConnection(accountMemberships, {
        remove: ["account-membership-1"],
      });

      writeOperationToCache(
        cache3,
        inlineFragments(addTypenames(addMembership)),
        {
          __typename: "Mutation",
          addMembership: {
            __typename: "AddMembership",
            membership: {
              __typename: "AccountMembership",
              id: "account-membership-3",
              account: {
                __typename: "Account",
                name: "First",
              },
              membershipUser: {
                __typename: "User",
                id: "user-3",
                lastName: "Le Brun",
              },
            },
          },
        },
        {},
      );

      writeOperationToCache(
        cache3,
        inlineFragments(addTypenames(addMembership)),
        {
          __typename: "Mutation",
          addMembership: {
            __typename: "AddMembership",
            membership: {
              __typename: "AccountMembership",
              id: "account-membership-0",
              account: {
                __typename: "Account",
                name: "First",
              },
              membershipUser: {
                __typename: "User",
                id: "user-0",
                lastName: "Le Brun",
              },
            },
          },
        },
        {},
      );

      cache3.updateConnection(accountMemberships, {
        append: [
          {
            __typename: "AccountMembershipEdge",
            node: {
              __typename: "AccountMembership",
              id: "account-membership-3",
              account: {
                __typename: "Account",
                name: "First",
              },
              membershipUser: {
                __typename: "User",
                id: "user-3",
                lastName: "Le Brun",
              },
            },
          },
        ],
      });
      cache3.updateConnection(accountMemberships, {
        prepend: [
          {
            __typename: "AccountMembershipEdge",
            node: {
              __typename: "AccountMembership",
              id: "account-membership-0",
              account: {
                __typename: "Account",
                name: "First",
              },
              membershipUser: {
                __typename: "User",
                id: "user-0",
                lastName: "Le Brun",
              },
            },
          },
        ],
      });
    }

    expect(
      readOperationFromCache(cache3, preparedAppQuery, {
        id: "1",
      }),
    ).toMatchSnapshot();
  } else {
    expect(true).toBe(false);
  }
});
