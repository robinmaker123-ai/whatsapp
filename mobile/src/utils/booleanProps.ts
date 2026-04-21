type BooleanPropOptions = {
  fallback?: boolean;
  debug?: boolean;
};

const isBooleanString = (value: unknown): value is "true" | "false" =>
  value === "true" || value === "false";

export const toBooleanProp = (
  componentName: string,
  propName: string,
  value: unknown,
  options: BooleanPropOptions = {}
) => {
  const { fallback = false, debug = true } = options;

  if (typeof value === "boolean") {
    if (__DEV__ && debug) {
      console.log(`[bool-prop] ${componentName}.${propName}`, {
        value,
        type: "boolean",
      });
    }

    return value;
  }

  if (isBooleanString(value)) {
    const normalizedValue = value === "true";

    if (__DEV__) {
      console.log(`[bool-prop] coerced ${componentName}.${propName}`, {
        originalValue: value,
        originalType: "string",
        normalizedValue,
      });
    }

    return normalizedValue;
  }

  if (__DEV__ && debug) {
    console.log(`[bool-prop] fallback ${componentName}.${propName}`, {
      value,
      type: typeof value,
      fallback,
    });
  }

  return fallback;
};

export const logComponentProps = (
  componentName: string,
  props: Record<string, unknown>
) => {
  if (!__DEV__) {
    return;
  }

  console.log(`[props] ${componentName}`, props);
};
