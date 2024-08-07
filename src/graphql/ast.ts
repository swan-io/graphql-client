import {
  ASTNode,
  DirectiveNode,
  DocumentNode,
  FieldNode,
  FragmentDefinitionNode,
  InlineFragmentNode,
  Kind,
  OperationDefinitionNode,
  SelectionNode,
  SelectionSetNode,
  ValueNode,
  visit,
} from "@0no-co/graphql.web";
import { Array, Option } from "@swan-io/boxed";
import { P, match } from "ts-pattern";

/**
 * Returns a Set<string> with all keys selected within the direct selection sets
 * of a given `FieldNode` or `OperationDefinitionNode`.
 *
 * { user { id, firstName, lastName } }
 * => Set{"id", "firstName", "lastName"}
 *
 * @param fieldNode FieldNode | OperationDefinitionNode
 * @returns selectedKeys Set<string>
 */
export const getSelectedKeys = (
  fieldNode: FieldNode | OperationDefinitionNode,
  variables: Record<string, unknown>,
): Set<symbol> => {
  const selectedKeys = new Set<symbol>();

  const traverse = (selections: SelectionSetNode) => {
    // We only need to care about FieldNode & InlineFragment node
    // as we inline all fragments in the query
    selections.selections.forEach((selection) => {
      if (selection.kind === Kind.FIELD) {
        const fieldNameWithArguments = getFieldNameWithArguments(
          selection,
          variables,
        );
        selectedKeys.add(fieldNameWithArguments);
      } else if (selection.kind === Kind.INLINE_FRAGMENT) {
        traverse(selection.selectionSet);
      }
    });
  };

  if (fieldNode.selectionSet) {
    traverse(fieldNode.selectionSet);
  }

  return selectedKeys;
};

/**
 * Serializes the field name and arguments as a symbol.
 *
 * { user {id} }
 * => Symbol(`user`)
 *
 * { user(id: "1") {id} }
 * => Symbol(`user({"id":"1"})`)
 *
 * { user(id: $id) {id} } with variables `{"id": "2"}`
 * => Symbol(`user({"id":"2"})`)
 *
 * @param fieldNode
 * @param variables The variables of the GraphQL operation
 * @returns symbol
 */
export const getFieldNameWithArguments = (
  fieldNode: FieldNode,
  variables: Record<string, unknown>,
): symbol => {
  const fieldName = getFieldName(fieldNode);
  const args = extractArguments(fieldNode, variables);
  if (Object.keys(args).length === 0) {
    return Symbol.for(fieldName);
  }
  return Symbol.for(`${fieldName}(${JSON.stringify(args)})`);
};

/**
 * Returns a record representation of the arguments passed to a given field
 *
 * @param fieldNode
 * @param variables
 * @returns Record<string, any>
 */
export const extractArguments = (
  fieldNode: FieldNode,
  variables: Record<string, unknown>,
): Record<string, unknown> => {
  const args = fieldNode.arguments ?? [];
  return Object.fromEntries(
    args.map(({ name: { value: name }, value }) => [
      name,
      extractValue(value, variables),
    ]),
  );
};

/**
 * Resolves and serializes a GraphQL value
 *
 * @param valueNode: ValueNode
 * @param variables: Record<string, any>
 * @returns Record<string, any>
 */
const extractValue = (
  valueNode: ValueNode,
  variables: Record<string, unknown>,
): unknown => {
  return match(valueNode)
    .with({ kind: Kind.NULL }, () => null)
    .with(
      {
        kind: P.union(
          Kind.INT,
          Kind.FLOAT,
          Kind.STRING,
          Kind.BOOLEAN,
          Kind.ENUM,
        ),
      },
      ({ value }) => value,
    )
    .with({ kind: Kind.LIST }, ({ values }) =>
      values.map((value) => extractValue(value, variables)),
    )
    .with({ kind: Kind.OBJECT }, ({ fields }) =>
      Object.fromEntries(
        fields.map(({ name: { value: name }, value }) => [
          name,
          extractValue(value, variables),
        ]),
      ),
    )
    .with(
      { kind: Kind.VARIABLE },
      ({ name: { value: name } }) => variables[name],
    )
    .exhaustive();
};

/**
 * Gets the field name in the response payload from its AST definition
 *
 * @param fieldNode
 * @returns field name
 */
export const getFieldName = (fieldNode: FieldNode) => {
  return fieldNode.alias ? fieldNode.alias.value : fieldNode.name.value;
};

/**
 * Simplifies the query for internal processing by inlining all fragments.
 *
 * @param documentNode
 * @returns documentNode
 */
export const inlineFragments = (documentNode: DocumentNode): DocumentNode => {
  const fragmentMap: { [fragmentName: string]: FragmentDefinitionNode } = {};

  // Populate the fragment map
  visit(documentNode, {
    [Kind.FRAGMENT_DEFINITION](node: FragmentDefinitionNode) {
      fragmentMap[node.name.value] = node;
    },
  });

  const inline = (node: ASTNode): unknown => {
    if (node.kind === Kind.FRAGMENT_SPREAD) {
      const fragmentName = node.name.value;
      const fragmentNode = fragmentMap[fragmentName];
      if (!fragmentNode) {
        throw new Error(`Fragment "${fragmentName}" is not defined.`);
      }
      const nextNode: InlineFragmentNode = {
        kind: Kind.INLINE_FRAGMENT,
        typeCondition: fragmentNode.typeCondition,
        selectionSet: fragmentNode.selectionSet,
      };
      return nextNode;
    }

    if (node.kind === Kind.SELECTION_SET) {
      return {
        ...node,
        selections: node.selections.map((selection: SelectionNode) =>
          inline(selection),
        ),
      };
    }

    if ("selectionSet" in node && node.selectionSet != null) {
      return {
        ...node,
        selectionSet: inline(node.selectionSet),
      };
    }

    return node;
  };

  return visit(documentNode, {
    [Kind.FRAGMENT_DEFINITION]: () => null,
    enter: inline,
  });
};

const TYPENAME_NODE: FieldNode = {
  kind: Kind.FIELD,
  name: {
    kind: Kind.NAME,
    value: "__typename",
  },
};

/**
 * Adds `__typename` to all selection sets in the document
 *
 * @param documentNode
 * @returns documentNode
 */
export const addTypenames = (documentNode: DocumentNode): DocumentNode => {
  return visit(documentNode, {
    [Kind.SELECTION_SET]: (selectionSet): SelectionSetNode => {
      if (
        selectionSet.selections.find(
          (selection) =>
            selection.kind === Kind.FIELD &&
            selection.name.value === "__typename",
        )
      ) {
        return selectionSet;
      } else {
        return {
          ...selectionSet,
          selections: [TYPENAME_NODE, ...selectionSet.selections],
        };
      }
    },
  });
};

export const getExecutableOperationName = (document: DocumentNode) => {
  return Array.findMap(document.definitions, (definition) => {
    if (definition.kind === Kind.OPERATION_DEFINITION) {
      return Option.fromNullable(definition.name).map((name) => name.value);
    } else {
      return Option.None();
    }
  });
};

const getIdFieldNode = (selection: SelectionNode): Option<SelectionNode> => {
  return match(selection)
    .with({ kind: Kind.FIELD }, (fieldNode) =>
      fieldNode.name.value === "id" ? Option.Some(fieldNode) : Option.None(),
    )
    .with({ kind: Kind.INLINE_FRAGMENT }, (inlineFragmentNode) => {
      return Array.findMap(
        inlineFragmentNode.selectionSet.selections,
        getIdFieldNode,
      );
    })
    .otherwise(() => Option.None());
};

export const addIdIfPreviousSelected = (
  oldSelectionSet: SelectionSetNode,
  newSelectionSet: SelectionSetNode,
): SelectionSetNode => {
  const idSelection = Array.findMap(oldSelectionSet.selections, getIdFieldNode);
  const idSelectionInNew = Array.findMap(
    newSelectionSet.selections,
    getIdFieldNode,
  );

  if (idSelectionInNew.isSome()) {
    return newSelectionSet;
  }

  return idSelection
    .map((selection) => ({
      ...newSelectionSet,
      selections: [
        selection,
        ...newSelectionSet.selections,
      ] as readonly SelectionNode[],
    }))
    .getOr(newSelectionSet);
};

export const isExcluded = (
  fieldNode: FieldNode,
  variables: Record<string, unknown>,
) => {
  if (!Array.isArray(fieldNode.directives)) {
    return false;
  }

  return fieldNode.directives.some(
    (directive: DirectiveNode) =>
      directive.name.value === "include" &&
      directive.arguments != null &&
      directive.arguments.some((arg) => {
        return (
          arg.name.value === "if" &&
          extractValue(arg.value, variables) === false
        );
      }),
  );
};
