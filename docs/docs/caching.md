---
title: Caching
sidebar_label: Caching
---

## Cache rules

### `__typename`

The client systematically adds `__typename` the any object that's queried. It helps the cache identifying the objects.

### Objects with `id`

Any object with a `string` `id` property is cached under the `Typename<ID>` key. You should always query the `id` property of any object that has one.

### Field cache

Fields are cached within their closest cached parent (objects with `id`) or their closest operation (`query`). Fields with arguments are cached under the `fieldName(serializedArguments)` key.

### Requested keys

We do not handle partial resolving from cache, queries can be resolved from the cache only if all the requested fields have been cached at some point.
