import { registerDecorator, ValidationOptions } from 'class-validator';

function isPlainObject(value: unknown): boolean {
  return (
    typeof value === 'object' && value !== null && !Array.isArray(value)
  );
}

/** class-validator check for the jsonb columns: must be a plain object. */
export function IsJsonObject(options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'isJsonObject',
      target: object.constructor,
      propertyName,
      options: {
        message: `${propertyName} must be a JSON object`,
        ...options,
      },
      validator: { validate: (value: unknown) => isPlainObject(value) },
    });
}
